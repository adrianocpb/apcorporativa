// Regras do quiz sem acesso ao banco: formato salvo na versão do conteúdo, checagem para
// publicar, correção e as visões seguras para o colaborador. Testadas em tests/unit/quiz.test.ts.
import { z } from "zod";

export const QUIZ_KINDS = ["SINGLE", "MULTIPLE", "TRUE_FALSE"] as const;
export type QuizKind = (typeof QUIZ_KINDS)[number];

export const QUIZ_KIND_LABEL: Record<QuizKind, string> = {
  SINGLE: "Escolha única",
  MULTIPLE: "Múltipla escolha",
  TRUE_FALSE: "Verdadeiro ou falso",
};

export const QUIZ_LIMITS = { questions: 50, options: 8, text: 1000, option: 300, explanation: 1000 };

const id = z.string().trim().min(1).max(40);

const optionSchema = z.object({
  id,
  text: z.string().trim().max(QUIZ_LIMITS.option, { error: `Alternativa: no máximo ${QUIZ_LIMITS.option} caracteres.` }),
  correct: z.boolean(),
});

const questionSchema = z.object({
  id,
  kind: z.enum(QUIZ_KINDS),
  text: z.string().trim().max(QUIZ_LIMITS.text, { error: `Pergunta: no máximo ${QUIZ_LIMITS.text} caracteres.` }),
  explanation: z
    .string()
    .trim()
    .max(QUIZ_LIMITS.explanation, { error: `Explicação: no máximo ${QUIZ_LIMITS.explanation} caracteres.` })
    .default(""),
  options: z.array(optionSchema).max(QUIZ_LIMITS.options, { error: `No máximo ${QUIZ_LIMITS.options} alternativas por pergunta.` }),
});

/** Formato aceito ao salvar (rascunho pode estar incompleto; a completude é checada ao publicar). */
export const quizSchema = z.object({
  passPercent: z.number().int().min(1, { error: "Nota mínima entre 1% e 100%." }).max(100, { error: "Nota mínima entre 1% e 100%." }),
  maxAttempts: z.number().int().min(1, { error: "Tentativas: de 1 a 20, ou sem limite." }).max(20, { error: "Tentativas: de 1 a 20, ou sem limite." }).nullable(),
  shuffle: z.boolean(),
  questions: z.array(questionSchema).max(QUIZ_LIMITS.questions, { error: `No máximo ${QUIZ_LIMITS.questions} perguntas.` }),
});

export type QuizDefinition = z.output<typeof quizSchema>;
export type QuizQuestion = QuizDefinition["questions"][number];

export const EMPTY_QUIZ: QuizDefinition = { passPercent: 70, maxAttempts: null, shuffle: false, questions: [] };

/** Lê o quiz salvo no banco; dados inválidos viram quiz vazio (nunca quebram a página). */
export function readQuiz(value: unknown): QuizDefinition {
  const parsed = quizSchema.safeParse(value);
  return parsed.success ? parsed.data : EMPTY_QUIZ;
}

/** O que falta para publicar, com o número da pergunta; null quando está completo. */
export function quizPublishProblem(quiz: QuizDefinition): string | null {
  if (quiz.questions.length === 0) return "Adicione pelo menos uma pergunta antes de publicar.";
  for (const [i, q] of quiz.questions.entries()) {
    const n = `Pergunta ${i + 1}`;
    if (!q.text) return `${n}: escreva o enunciado.`;
    if (q.options.length < 2) return `${n}: inclua pelo menos duas alternativas.`;
    if (q.kind === "TRUE_FALSE" && q.options.length !== 2) return `${n}: verdadeiro ou falso tem exatamente duas alternativas.`;
    if (q.options.some((o) => !o.text)) return `${n}: preencha o texto de todas as alternativas.`;
    const correct = q.options.filter((o) => o.correct).length;
    if (q.kind === "MULTIPLE" && correct === 0) return `${n}: marque pelo menos uma alternativa correta.`;
    if (q.kind !== "MULTIPLE" && correct !== 1) return `${n}: marque exatamente uma alternativa correta.`;
  }
  return null;
}

export type QuizAnswers = Record<string, string[]>;

/** Corrige uma tentativa: a pergunta só conta se as alternativas marcadas forem exatamente as corretas. */
export function gradeQuiz(quiz: QuizDefinition, answers: QuizAnswers) {
  const results: Record<string, boolean> = {};
  for (const q of quiz.questions) {
    const chosen = new Set((answers[q.id] ?? []).filter((x) => q.options.some((o) => o.id === x)));
    const correct = new Set(q.options.filter((o) => o.correct).map((o) => o.id));
    results[q.id] = chosen.size === correct.size && [...correct].every((x) => chosen.has(x));
  }
  const total = quiz.questions.length;
  const correctCount = Object.values(results).filter(Boolean).length;
  const scorePercent = total ? Math.round((correctCount / total) * 100) : 0;
  return { results, correctCount, totalCount: total, scorePercent, passed: total > 0 && scorePercent >= quiz.passPercent };
}

/** Normaliza as respostas recebidas do navegador (só ids conhecidos, uma escolha nas de resposta única). */
export function sanitizeAnswers(quiz: QuizDefinition, raw: unknown): QuizAnswers {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: QuizAnswers = {};
  for (const q of quiz.questions) {
    const value = input[q.id];
    const list = (Array.isArray(value) ? value : []).filter(
      (x): x is string => typeof x === "string" && q.options.some((o) => o.id === x),
    );
    out[q.id] = q.kind === "MULTIPLE" ? [...new Set(list)] : list.slice(0, 1);
  }
  return out;
}

function shuffled<T>(list: T[]): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export type LearnerQuestion = { id: string; kind: QuizKind; text: string; options: { id: string; text: string }[] };

/** Perguntas para responder: sem gabarito nem explicação. Embaralha se configurado. */
export function learnerQuestions(quiz: QuizDefinition): LearnerQuestion[] {
  const questions = quiz.questions.map((q) => {
    const options = q.options.map((o) => ({ id: o.id, text: o.text }));
    return { id: q.id, kind: q.kind, text: q.text, options: quiz.shuffle && q.kind !== "TRUE_FALSE" ? shuffled(options) : options };
  });
  return quiz.shuffle ? shuffled(questions) : questions;
}

export type ReviewQuestion = {
  id: string;
  text: string;
  explanation: string;
  correct: boolean;
  options: { id: string; text: string; correct: boolean; selected: boolean }[];
};

/** Gabarito comentado: só é montado depois que a pessoa foi aprovada. */
export function reviewQuestions(quiz: QuizDefinition, answers: QuizAnswers): ReviewQuestion[] {
  const { results } = gradeQuiz(quiz, answers);
  return quiz.questions.map((q) => ({
    id: q.id,
    text: q.text,
    explanation: q.explanation,
    correct: results[q.id] ?? false,
    options: q.options.map((o) => ({ id: o.id, text: o.text, correct: o.correct, selected: (answers[q.id] ?? []).includes(o.id) })),
  }));
}

/** Copia o quiz com novos ids (usado ao duplicar um conteúdo). */
export function cloneQuiz(quiz: QuizDefinition, newId: () => string): QuizDefinition {
  return {
    ...quiz,
    questions: quiz.questions.map((q) => ({ ...q, id: newId(), options: q.options.map((o) => ({ ...o, id: newId() })) })),
  };
}
