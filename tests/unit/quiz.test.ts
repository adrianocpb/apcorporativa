import { describe, expect, it } from "vitest";
import {
  cloneQuiz,
  gradeQuiz,
  learnerQuestions,
  quizPublishProblem,
  readQuiz,
  reviewQuestions,
  sanitizeAnswers,
  type QuizDefinition,
} from "@/lib/quiz";

const quiz: QuizDefinition = {
  passPercent: 70,
  maxAttempts: null,
  shuffle: false,
  questions: [
    {
      id: "q1",
      kind: "SINGLE",
      text: "Capital do Brasil?",
      explanation: "Desde 1960.",
      options: [
        { id: "a", text: "Brasília", correct: true },
        { id: "b", text: "Rio", correct: false },
      ],
    },
    {
      id: "q2",
      kind: "MULTIPLE",
      text: "Quais são cores da marca?",
      explanation: "",
      options: [
        { id: "c", text: "Preto", correct: true },
        { id: "d", text: "Papel", correct: true },
        { id: "e", text: "Roxo", correct: false },
      ],
    },
    {
      id: "q3",
      kind: "TRUE_FALSE",
      text: "O gabarito vai para o navegador.",
      explanation: "",
      options: [
        { id: "v", text: "Verdadeiro", correct: false },
        { id: "f", text: "Falso", correct: true },
      ],
    },
  ],
};

describe("correção do quiz", () => {
  it("só conta a pergunta se as marcadas forem exatamente as corretas", () => {
    const r = gradeQuiz(quiz, { q1: ["a"], q2: ["c"], q3: ["f"] });
    expect(r.results).toEqual({ q1: true, q2: false, q3: true });
    expect(r).toMatchObject({ correctCount: 2, totalCount: 3, scorePercent: 67, passed: false });
    expect(gradeQuiz(quiz, { q1: ["a"], q2: ["d", "c"], q3: ["f"] })).toMatchObject({ scorePercent: 100, passed: true });
    expect(gradeQuiz(quiz, { q1: ["a"], q2: ["c", "d", "e"], q3: ["f"] }).results.q2).toBe(false);
  });

  it("aprova exatamente na nota mínima", () => {
    const half = { ...quiz, passPercent: 67 };
    expect(gradeQuiz(half, { q1: ["a"], q2: [], q3: ["f"] }).passed).toBe(true);
  });

  it("normaliza respostas: ids desconhecidos somem e escolha única fica com uma", () => {
    expect(sanitizeAnswers(quiz, { q1: ["a", "b"], q2: ["c", "c", "x"], q3: "f", extra: ["a"] })).toEqual({
      q1: ["a"],
      q2: ["c"],
      q3: [],
    });
    expect(sanitizeAnswers(quiz, null)).toEqual({ q1: [], q2: [], q3: [] });
  });
});

describe("visões do colaborador", () => {
  it("perguntas para responder não levam gabarito nem explicação", () => {
    const json = JSON.stringify(learnerQuestions({ ...quiz, shuffle: true }));
    expect(json).not.toContain("correct");
    expect(json).not.toContain("Desde 1960");
    expect(learnerQuestions(quiz).map((q) => q.id)).toEqual(["q1", "q2", "q3"]);
  });

  it("gabarito comentado marca correta, escolhida e explicação", () => {
    const [first] = reviewQuestions(quiz, { q1: ["b"] });
    expect(first.correct).toBe(false);
    expect(first.explanation).toBe("Desde 1960.");
    expect(first.options).toEqual([
      { id: "a", text: "Brasília", correct: true, selected: false },
      { id: "b", text: "Rio", correct: false, selected: true },
    ]);
  });
});

describe("publicação e leitura", () => {
  it("aponta o que falta para publicar", () => {
    expect(quizPublishProblem(quiz)).toBeNull();
    expect(quizPublishProblem({ ...quiz, questions: [] })).toMatch(/pelo menos uma pergunta/);
    const noCorrect = { ...quiz, questions: [{ ...quiz.questions[0], options: quiz.questions[0].options.map((o) => ({ ...o, correct: false })) }] };
    expect(quizPublishProblem(noCorrect)).toMatch(/Pergunta 1: marque exatamente uma/);
    const twoCorrect = { ...quiz, questions: [{ ...quiz.questions[0], options: quiz.questions[0].options.map((o) => ({ ...o, correct: true })) }] };
    expect(quizPublishProblem(twoCorrect)).toMatch(/exatamente uma/);
    const blank = { ...quiz, questions: [quiz.questions[0], { ...quiz.questions[1], text: "" }] };
    expect(quizPublishProblem(blank)).toMatch(/Pergunta 2: escreva o enunciado/);
  });

  it("dado inválido no banco vira quiz vazio", () => {
    expect(readQuiz(null).questions).toEqual([]);
    expect(readQuiz({ questions: "x" }).questions).toEqual([]);
    expect(readQuiz(quiz)).toEqual(quiz);
  });

  it("duplicar gera ids novos e mantém o conteúdo", () => {
    let n = 0;
    const copy = cloneQuiz(quiz, () => `n${++n}`);
    expect(copy.questions[0].id).toBe("n1");
    expect(copy.questions[0].options.map((o) => o.text)).toEqual(["Brasília", "Rio"]);
    expect(copy.questions.flatMap((q) => q.options.map((o) => o.correct))).toEqual(
      quiz.questions.flatMap((q) => q.options.map((o) => o.correct)),
    );
  });
});
