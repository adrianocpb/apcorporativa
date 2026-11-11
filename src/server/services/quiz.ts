import type { Prisma } from "@/generated/prisma/client";
import type { Db } from "@/server/db";
import { AppError, NotFoundError } from "@/server/errors";
import { PERMISSIONS } from "@/server/auth/permissions";
import type { RequestMeta, SessionUser } from "@/server/auth/sessions";
import { audit } from "@/server/services/audit";
import { assertPermission } from "@/server/services/guard";
import { completeItem, loadAvailableItem, type CompletionEvents } from "@/server/services/learning";
import {
  gradeQuiz,
  learnerQuestions,
  readQuiz,
  reviewQuestions,
  sanitizeAnswers,
  type QuizAnswers,
  type QuizDefinition,
} from "@/lib/quiz";

// Quiz dentro das trilhas. Regras (decididas com a área):
//  - reprovou: só refaz o quiz (não precisa rever o conteúdo anterior);
//  - o gabarito comentado só aparece depois da aprovação;
//  - a correção acontece aqui; o navegador nunca recebe as respostas certas antes disso.

async function activeAttempts(db: Db, userId: string, versionId: string) {
  return db.quizAttempt.findMany({
    where: { userId, contentVersionId: versionId, voidedAt: null },
    orderBy: { createdAt: "asc" },
  });
}

function attemptsLeft(quiz: QuizDefinition, used: number) {
  return quiz.maxAttempts === null ? null : Math.max(0, quiz.maxAttempts - used);
}

/** Estado do quiz para quem está fazendo: perguntas sem gabarito, tentativas e, se aprovado, a revisão. */
export async function getQuizForLearner(db: Db, user: SessionUser, versionId: string, quizValue: unknown) {
  const quiz = readQuiz(quizValue);
  const attempts = await activeAttempts(db, user.id, versionId);
  const passedAttempt = attempts.find((a) => a.passed) ?? null;
  const last = attempts[attempts.length - 1] ?? null;
  return {
    passPercent: quiz.passPercent,
    questionCount: quiz.questions.length,
    maxAttempts: quiz.maxAttempts,
    attemptsUsed: attempts.length,
    attemptsLeft: attemptsLeft(quiz, attempts.length),
    bestScore: attempts.length ? Math.max(...attempts.map((a) => a.scorePercent)) : null,
    lastScore: last?.scorePercent ?? null,
    passed: !!passedAttempt,
    // Aprovado: não precisa mais responder; mostra o gabarito comentado da tentativa aprovada.
    questions: passedAttempt ? [] : learnerQuestions(quiz),
    review: passedAttempt ? reviewQuestions(quiz, passedAttempt.answers as QuizAnswers) : null,
  };
}

export type QuizSubmitResult = {
  scorePercent: number;
  correctCount: number;
  totalCount: number;
  passed: boolean;
  passPercent: number;
  attemptsLeft: number | null;
  events: CompletionEvents | null;
};

export async function submitQuizAttempt(
  db: Db,
  user: SessionUser,
  trackId: string,
  itemId: string,
  rawAnswers: unknown,
): Promise<QuizSubmitResult> {
  const { item, versionId } = await loadAvailableItem(db, user.id, trackId, itemId);
  if (item.content.type !== "QUIZ") throw new AppError("Este conteúdo não é um quiz.");
  const version = await db.contentVersion.findUniqueOrThrow({ where: { id: versionId }, select: { quiz: true } });
  const quiz = readQuiz(version.quiz);
  if (!quiz.questions.length) throw new AppError("Este quiz ainda não tem perguntas.");

  const attempts = await activeAttempts(db, user.id, versionId);
  if (attempts.some((a) => a.passed)) throw new AppError("Você já foi aprovado neste quiz.");
  if (attemptsLeft(quiz, attempts.length) === 0) {
    throw new AppError("Você usou todas as tentativas deste quiz. Fale com o administrador da trilha para liberar novas.");
  }
  const answers = sanitizeAnswers(quiz, rawAnswers);
  const unanswered = quiz.questions.filter((q) => !answers[q.id]?.length).length;
  if (unanswered) {
    throw new AppError(unanswered === 1 ? "Responda todas as perguntas: falta 1." : `Responda todas as perguntas: faltam ${unanswered}.`);
  }

  const grade = gradeQuiz(quiz, answers);
  await db.quizAttempt.create({
    data: {
      userId: user.id,
      contentId: item.contentId,
      contentVersionId: versionId,
      trackId,
      answers: answers as Prisma.InputJsonValue,
      results: grade.results,
      correctCount: grade.correctCount,
      totalCount: grade.totalCount,
      scorePercent: grade.scorePercent,
      passed: grade.passed,
    },
  });
  const now = new Date();
  await db.contentProgress.updateMany({
    where: { userId: user.id, contentVersionId: versionId },
    data: { lastActivityAt: now },
  });
  await db.enrollment.update({
    where: { trackId_userId: { trackId, userId: user.id } },
    data: { lastActivityAt: now, lastItemId: itemId },
  });

  const events = grade.passed
    ? await completeItem(db, user.id, trackId, item.contentId, versionId, "QUIZ_PASSED", {
        nota: grade.scorePercent,
        notaMinima: quiz.passPercent,
        tentativa: attempts.length + 1,
      })
    : null;

  return {
    scorePercent: grade.scorePercent,
    correctCount: grade.correctCount,
    totalCount: grade.totalCount,
    passed: grade.passed,
    passPercent: quiz.passPercent,
    attemptsLeft: attemptsLeft(quiz, attempts.length + 1),
    events,
  };
}

// ---------------------------------------------------------------------------
// Administração
// ---------------------------------------------------------------------------

/** Resultados da versão vigente: participação, aprovação e taxa de erro por pergunta. */
export async function getQuizReport(db: Db, actor: SessionUser, contentId: string) {
  assertPermission(actor, PERMISSIONS.CONTEUDOS_GERENCIAR);
  const content = await db.content.findUnique({
    where: { id: contentId },
    select: { type: true, currentVersion: { select: { id: true, number: true, quiz: true } } },
  });
  if (!content || content.type !== "QUIZ") throw new NotFoundError("Quiz não encontrado.");
  if (!content.currentVersion) return null;
  const quiz = readQuiz(content.currentVersion.quiz);
  const attempts = await db.quizAttempt.findMany({
    where: { contentVersionId: content.currentVersion.id, voidedAt: null },
    select: { userId: true, results: true, scorePercent: true, passed: true },
  });
  const people = new Set(attempts.map((a) => a.userId));
  const approved = new Set(attempts.filter((a) => a.passed).map((a) => a.userId));
  const questions = quiz.questions.map((q, i) => {
    const answered = attempts.filter((a) => q.id in (a.results as Record<string, boolean>));
    const wrong = answered.filter((a) => !(a.results as Record<string, boolean>)[q.id]).length;
    return {
      number: i + 1,
      text: q.text,
      answered: answered.length,
      errorRate: answered.length ? Math.round((wrong / answered.length) * 100) : null,
    };
  });
  return {
    version: content.currentVersion.number,
    attempts: attempts.length,
    people: people.size,
    approved: approved.size,
    passRate: people.size ? Math.round((approved.size / people.size) * 100) : null,
    averageScore: attempts.length ? Math.round(attempts.reduce((s, a) => s + a.scorePercent, 0) / attempts.length) : null,
    questions,
  };
}

/** Quizzes de uma pessoa (relatório individual): melhor nota, tentativas e situação. */
export async function getQuizAttemptsForUser(db: Db, actor: SessionUser, userId: string) {
  assertPermission(actor, PERMISSIONS.RELATORIOS_VER);
  const attempts = await db.quizAttempt.findMany({
    where: { userId, voidedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      contentId: true,
      contentVersionId: true,
      scorePercent: true,
      passed: true,
      createdAt: true,
      content: { select: { title: true, currentVersionId: true } },
      contentVersion: { select: { number: true, quiz: true } },
    },
  });
  const byVersion = new Map<string, typeof attempts>();
  for (const a of attempts) byVersion.set(a.contentVersionId, [...(byVersion.get(a.contentVersionId) ?? []), a]);
  return [...byVersion.values()].map((list) => {
    const first = list[0];
    const quiz = readQuiz(first.contentVersion.quiz);
    const passed = list.some((a) => a.passed);
    return {
      contentId: first.contentId,
      title: first.content.title,
      version: first.contentVersion.number,
      current: first.content.currentVersionId === first.contentVersionId,
      attempts: list.length,
      bestScore: Math.max(...list.map((a) => a.scorePercent)),
      passPercent: quiz.passPercent,
      passed,
      blocked: !passed && attemptsLeft(quiz, list.length) === 0,
      lastAt: list[list.length - 1].createdAt,
    };
  });
}

/** Anula as tentativas (não aprovadas) da versão vigente para a pessoa poder tentar de novo. */
export async function releaseQuizAttempts(
  db: Db,
  actor: SessionUser,
  userId: string,
  contentId: string,
  meta: RequestMeta = {},
) {
  assertPermission(actor, PERMISSIONS.RELATORIOS_VER);
  const content = await db.content.findUnique({ where: { id: contentId }, select: { title: true, type: true, currentVersionId: true } });
  if (!content || content.type !== "QUIZ" || !content.currentVersionId) throw new NotFoundError("Quiz não encontrado.");
  const versionId = content.currentVersionId;
  await db.$transaction(async (tx) => {
    const { count } = await tx.quizAttempt.updateMany({
      where: { userId, contentVersionId: versionId, voidedAt: null, passed: false },
      data: { voidedAt: new Date(), voidedById: actor.id },
    });
    if (!count) throw new AppError("Não há tentativas para liberar.");
    await audit(tx, {
      actorId: actor.id,
      action: "quiz.tentativas_liberadas",
      entityType: "usuario",
      entityId: userId,
      details: { quiz: content.title, tentativasAnuladas: count },
      ip: meta.ip,
    });
  });
}
