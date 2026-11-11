import { describe, expect, it } from "vitest";
import { db, makeActor, makeUser, setupTestDb } from "../support/db";
import { ForbiddenError } from "@/server/errors";
import type { SessionUser } from "@/server/auth/sessions";
import { createSession, validateSessionToken } from "@/server/auth/sessions";
import { createContent, duplicateContent, publishContent, saveDraft } from "@/server/services/contents";
import { confirmCompletion, getItemForLearner, getTrackForLearner, openItem } from "@/server/services/learning";
import {
  getQuizAttemptsForUser,
  getQuizForLearner,
  getQuizReport,
  releaseQuizAttempts,
  submitQuizAttempt,
} from "@/server/services/quiz";
import { addItems, assignTrack, createTrack, getTrackForEdit, setTrackStatus, updateItem } from "@/server/services/tracks";
import { readQuiz, type QuizDefinition } from "@/lib/quiz";

setupTestDb();

async function sessionUserOf(userId: string): Promise<SessionUser> {
  const { token } = await createSession(db, userId);
  return (await validateSessionToken(db, token))!.user;
}

const QUIZ: QuizDefinition = {
  passPercent: 100,
  maxAttempts: 2,
  shuffle: true,
  questions: [
    {
      id: "q1",
      kind: "SINGLE",
      text: "Onde ficam os manuais?",
      explanation: "Na Central de Conhecimento.",
      options: [
        { id: "a", text: "Central de Conhecimento", correct: true },
        { id: "b", text: "No e-mail", correct: false },
      ],
    },
    {
      id: "q2",
      kind: "TRUE_FALSE",
      text: "Reprovar exige rever o conteúdo.",
      explanation: "",
      options: [
        { id: "v", text: "Verdadeiro", correct: false },
        { id: "f", text: "Falso", correct: true },
      ],
    },
  ],
};
const RIGHT = { q1: ["a"], q2: ["f"] };
const WRONG = { q1: ["b"], q2: ["f"] };

async function publishedQuiz(admin: SessionUser, quiz: QuizDefinition = QUIZ) {
  const c = await createContent(db, admin, "QUIZ", { title: "Quiz de boas-vindas", inLibrary: "on", quiz: JSON.stringify(quiz) });
  await publishContent(db, admin, c.id);
  return c;
}

async function trackWithQuiz(admin: SessionUser, quizId: string, title: string, learnerId: string) {
  const track = await createTrack(db, admin, { title, sequential: "on", minReadSeconds: "0" });
  await addItems(db, admin, (await getTrackForEdit(db, admin, track.id)).modules[0].id, [quizId]);
  await setTrackStatus(db, admin, track.id, "publish");
  await assignTrack(db, admin, track.id, { userIds: [learnerId] });
  const [item] = (await getTrackForEdit(db, admin, track.id)).modules[0].items;
  return { track, item };
}

async function setup() {
  const admin = await makeActor();
  const quiz = await publishedQuiz(admin);
  const learner = await sessionUserOf((await makeUser()).id);
  const { track, item } = await trackWithQuiz(admin, quiz.id, "Onboarding", learner.id);
  await openItem(db, learner, track.id, item.id);
  return { admin, quiz, learner, track, item };
}

describe("cadastro do quiz", () => {
  it("rascunho pode estar incompleto, mas só publica completo; nunca vai para a Central", async () => {
    const admin = await makeActor();
    const draft = await createContent(db, admin, "QUIZ", {
      title: "Quiz em construção",
      inLibrary: "on",
      quiz: JSON.stringify({ ...QUIZ, questions: [{ ...QUIZ.questions[0], text: "" }] }),
    });
    expect(draft.inLibrary).toBe(false);
    await expect(publishContent(db, admin, draft.id)).rejects.toThrow(/Pergunta 1: escreva o enunciado/);
    await saveDraft(db, admin, draft.id, { title: "Quiz pronto", quiz: JSON.stringify(QUIZ) });
    await publishContent(db, admin, draft.id);
    const saved = await db.content.findUniqueOrThrow({ where: { id: draft.id }, include: { currentVersion: true } });
    expect(saved.inLibrary).toBe(false);
    expect(readQuiz(saved.currentVersion?.quiz).questions).toHaveLength(2);
  });

  it("recusa formato inválido e a regra de conclusão é sempre a aprovação", async () => {
    const admin = await makeActor();
    await expect(
      createContent(db, admin, "QUIZ", { title: "Quebrado", quiz: JSON.stringify({ ...QUIZ, passPercent: 150 }) }),
    ).rejects.toThrow(/Nota mínima/);
    const quiz = await publishedQuiz(admin);
    const learner = await makeUser();
    const { item } = await trackWithQuiz(admin, quiz.id, "Trilha de teste", learner.id);
    expect(item.completionRule).toBe("QUIZ");
    await expect(updateItem(db, admin, item.id, { required: true, completionRule: "CONFIRM" })).rejects.toThrow(/Regra/);
  });
});

describe("fazendo o quiz", () => {
  it("o colaborador recebe as perguntas sem gabarito", async () => {
    const { learner, track, item } = await setup();
    const data = await getItemForLearner(db, learner, track.id, item.id);
    const state = await getQuizForLearner(db, learner, data.version.id, data.version.quiz);
    const json = JSON.stringify(state);
    expect(json).not.toContain("correct");
    expect(json).not.toContain("Na Central de Conhecimento.");
    expect(state).toMatchObject({ passed: false, attemptsUsed: 0, attemptsLeft: 2, review: null });
    await expect(confirmCompletion(db, learner, track.id, item.id)).rejects.toThrow(/aprovado/);
  });

  it("reprovou: registra a nota, não conclui e só refaz o quiz até o limite", async () => {
    const { admin, quiz, learner, track, item } = await setup();
    await expect(submitQuizAttempt(db, learner, track.id, item.id, { q1: ["b"] })).rejects.toThrow(/falta 1/);

    const r1 = await submitQuizAttempt(db, learner, track.id, item.id, WRONG);
    expect(r1).toMatchObject({ passed: false, scorePercent: 50, correctCount: 1, attemptsLeft: 1, events: null });
    expect(await db.completionRecord.count({ where: { userId: learner.id } })).toBe(0);
    await submitQuizAttempt(db, learner, track.id, item.id, WRONG);
    await expect(submitQuizAttempt(db, learner, track.id, item.id, RIGHT)).rejects.toThrow(/todas as tentativas/);

    const [row] = await getQuizAttemptsForUser(db, admin, learner.id);
    expect(row).toMatchObject({ attempts: 2, bestScore: 50, passed: false, blocked: true });

    // O administrador libera novas tentativas; o histórico fica.
    await releaseQuizAttempts(db, admin, learner.id, quiz.id);
    expect(await db.quizAttempt.count({ where: { userId: learner.id } })).toBe(2);
    const r3 = await submitQuizAttempt(db, learner, track.id, item.id, RIGHT);
    expect(r3.passed).toBe(true);
    expect(await db.auditLog.count({ where: { action: "quiz.tentativas_liberadas" } })).toBe(1);
  });

  it("aprovou: conclui o item, dá pontos uma vez e libera o gabarito comentado", async () => {
    const { learner, track, item } = await setup();
    const result = await submitQuizAttempt(db, learner, track.id, item.id, RIGHT);
    expect(result.passed).toBe(true);
    expect(result.events?.trackCompleted).toBe(true);
    const completion = await db.completionRecord.findFirstOrThrow({ where: { userId: learner.id } });
    expect(completion.method).toBe("QUIZ_PASSED");
    expect(await db.pointTransaction.findMany({ where: { userId: learner.id, event: "CONTENT_QUIZ" } })).toHaveLength(1);

    await expect(submitQuizAttempt(db, learner, track.id, item.id, RIGHT)).rejects.toThrow(/já foi aprovado/);
    const data = await getItemForLearner(db, learner, track.id, item.id);
    const state = await getQuizForLearner(db, learner, data.version.id, data.version.quiz);
    expect(state.passed).toBe(true);
    expect(state.questions).toEqual([]);
    expect(state.review?.[0]).toMatchObject({ correct: true, explanation: "Na Central de Conhecimento." });
  });

  it("o mesmo quiz em duas trilhas: aprovar numa conclui nas duas", async () => {
    const { admin, quiz, learner, track, item } = await setup();
    const other = await trackWithQuiz(admin, quiz.id, "Plataforma Pam", learner.id);
    await submitQuizAttempt(db, learner, track.id, item.id, RIGHT);
    const state = await getTrackForLearner(db, learner, other.track.id);
    expect(state.state.completed).toBe(true);
  });
});

describe("administração", () => {
  it("resultados mostram aprovação e taxa de erro por pergunta", async () => {
    const { admin, quiz, learner, track, item } = await setup();
    await submitQuizAttempt(db, learner, track.id, item.id, WRONG);
    await submitQuizAttempt(db, learner, track.id, item.id, RIGHT);
    const report = await getQuizReport(db, admin, quiz.id);
    expect(report).toMatchObject({ attempts: 2, people: 1, approved: 1, passRate: 100, averageScore: 75 });
    expect(report?.questions.map((q) => q.errorRate)).toEqual([50, 0]);
  });

  it("duplicar cria um rascunho independente", async () => {
    const admin = await makeActor();
    const quiz = await publishedQuiz(admin);
    const copy = await duplicateContent(db, admin, quiz.id);
    expect(copy.status).toBe("DRAFT");
    expect(copy.title).toBe("Cópia de Quiz de boas-vindas");
    const version = await db.contentVersion.findFirstOrThrow({ where: { contentId: copy.id } });
    const copied = readQuiz(version.quiz);
    expect(copied.questions.map((q) => q.text)).toEqual(QUIZ.questions.map((q) => q.text));
    expect(copied.questions[0].id).not.toBe("q1");
    // O original não muda.
    const original = await db.contentVersion.findFirstOrThrow({ where: { contentId: quiz.id } });
    expect(readQuiz(original.quiz).questions[0].id).toBe("q1");
  });

  it("colaborador não vê resultados nem libera tentativas", async () => {
    const { quiz, learner } = await setup();
    await expect(getQuizReport(db, learner, quiz.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(releaseQuizAttempts(db, learner, learner.id, quiz.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(duplicateContent(db, learner, quiz.id)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
