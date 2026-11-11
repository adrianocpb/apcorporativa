"use client";

import { IconCircleCheck, IconCircleX, IconRefresh, IconSend } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Alert, ProgressBar } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/cn";
import type { LearnerQuestion, ReviewQuestion } from "@/lib/quiz";
import type { QuizSubmitResult } from "@/server/services/quiz";
import { submitQuizAction } from "@/app/(app)/trilhas/actions";
import { announceReward } from "./reward";

export type QuizPlayerState = {
  passPercent: number;
  questionCount: number;
  maxAttempts: number | null;
  attemptsUsed: number;
  attemptsLeft: number | null;
  bestScore: number | null;
  passed: boolean;
  questions: LearnerQuestion[];
  review: ReviewQuestion[] | null;
};

/**
 * Quiz dentro da trilha. As perguntas chegam sem gabarito; a nota vem do servidor.
 * Reprovou: mostra só a nota e permite refazer. Aprovou: mostra o gabarito comentado.
 */
export function QuizPlayer({
  trackId,
  itemId,
  quiz,
}: {
  trackId: string;
  itemId: string;
  quiz: QuizPlayerState;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<QuizSubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (quiz.passed && quiz.review) return <QuizReview quiz={quiz} />;

  const answered = quiz.questions.filter((q) => answers[q.id]?.length).length;
  const blocked = quiz.attemptsLeft === 0;

  function choose(questionId: string, optionId: string, multiple: boolean, checked: boolean) {
    setAnswers((s) => {
      const current = s[questionId] ?? [];
      const list = multiple ? (checked ? [...current, optionId] : current.filter((x) => x !== optionId)) : [optionId];
      return { ...s, [questionId]: list };
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await submitQuizAction(trackId, itemId, answers);
      if (!r.ok || !r.data) {
        setError(r.message ?? "Não foi possível enviar as respostas.");
        return;
      }
      setResult(r.data);
      if (r.data.passed) {
        toast(r.data.events?.trackCompleted ? "Parabéns! Você concluiu a trilha." : "Aprovado no quiz!");
        announceReward(r.data.events?.reward);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
      router.refresh();
    });
  }

  function retry() {
    setAnswers({});
    setResult(null);
    router.refresh(); // nova ordem, se o quiz embaralha
  }

  const rules = (
    <p className="text-small text-ink-muted">
      {quiz.questionCount} pergunta(s) · nota mínima {quiz.passPercent}%
      {quiz.maxAttempts !== null && ` · tentativas: ${quiz.attemptsUsed} de ${quiz.maxAttempts}`}
      {quiz.bestScore !== null && ` · sua melhor nota: ${quiz.bestScore}%`}
    </p>
  );

  if (result && !result.passed) {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-line p-5" role="status">
        <p className="flex items-center gap-2 text-h5 font-medium text-ink">
          <IconCircleX className="size-6 text-danger-text" aria-hidden="true" /> Ainda não foi desta vez
        </p>
        <p className="text-body text-ink-soft">
          Você acertou {result.correctCount} de {result.totalCount} ({result.scorePercent}%). A nota mínima é{" "}
          {result.passPercent}%.
        </p>
        <ProgressBar value={result.scorePercent} label="Sua nota" tone="warning" />
        <p className="text-small text-ink-muted">
          O gabarito aparece depois que você for aprovado.
          {result.attemptsLeft !== null &&
            (result.attemptsLeft > 0
              ? ` Restam ${result.attemptsLeft} tentativa(s).`
              : " Você usou todas as tentativas: fale com o administrador da trilha para liberar novas.")}
        </p>
        {result.attemptsLeft !== 0 && (
          <Button onClick={retry} icon={<IconRefresh />} className="self-start">
            Refazer o quiz
          </Button>
        )}
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="flex flex-col gap-3">
        {rules}
        <Alert tone="warning" title="Tentativas esgotadas">
          Você usou todas as tentativas deste quiz. Fale com o administrador da trilha para liberar novas.
        </Alert>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      {rules}
      {error && <Alert tone="danger">{error}</Alert>}
      <ol className="flex flex-col gap-4">
        {quiz.questions.map((q, i) => {
          const multiple = q.kind === "MULTIPLE";
          return (
            <li key={q.id}>
              <fieldset className="flex flex-col gap-2 rounded-lg border border-line p-4">
                <legend className="sr-only">Pergunta {i + 1}</legend>
                <p className="text-small text-ink-muted">
                  Pergunta {i + 1} de {quiz.questions.length}
                  {multiple && " · marque todas as corretas"}
                </p>
                <p className="font-medium text-ink">{q.text}</p>
                {q.options.map((o) => {
                  const checked = answers[q.id]?.includes(o.id) ?? false;
                  return (
                    <label
                      key={o.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-body transition-colors",
                        checked ? "border-primary bg-primary-subtle text-ink" : "border-line text-ink-soft hover:bg-surface-hover",
                      )}
                    >
                      <input
                        type={multiple ? "checkbox" : "radio"}
                        name={`pergunta-${q.id}`}
                        checked={checked}
                        onChange={(e) => choose(q.id, o.id, multiple, e.target.checked)}
                        className="size-[18px] shrink-0 accent-[var(--primary)]"
                      />
                      {o.text}
                    </label>
                  );
                })}
              </fieldset>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <Button type="submit" loading={pending} disabled={answered < quiz.questions.length} icon={<IconSend />}>
          Enviar respostas
        </Button>
        <span className="text-small text-ink-muted" aria-live="polite">
          Respondidas: {answered} de {quiz.questions.length}
        </span>
      </div>
    </form>
  );
}

function QuizReview({ quiz }: { quiz: QuizPlayerState }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 rounded-lg border border-success bg-success-subtle p-5" role="status">
        <p className="flex items-center gap-2 text-h5 font-medium text-success-text">
          <IconCircleCheck className="size-6" aria-hidden="true" /> Aprovado
        </p>
        <p className="text-body text-ink-soft">
          Sua nota: {quiz.bestScore}% (mínima {quiz.passPercent}%). Confira abaixo o gabarito comentado.
        </p>
      </div>
      <ol className="flex flex-col gap-4">
        {quiz.review!.map((q, i) => (
          <li key={q.id} className="flex flex-col gap-2 rounded-lg border border-line p-4">
            <p className="flex items-center gap-2 text-small text-ink-muted">
              Pergunta {i + 1} ·{" "}
              {q.correct ? (
                <span className="text-success-text">você acertou</span>
              ) : (
                <span className="text-danger-text">você errou</span>
              )}
            </p>
            <p className="font-medium text-ink">{q.text}</p>
            <ul className="flex flex-col gap-1.5">
              {q.options.map((o) => (
                <li
                  key={o.id}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-body",
                    o.correct ? "bg-success-subtle text-success-text" : o.selected ? "bg-danger-subtle text-danger-text" : "text-ink-soft",
                  )}
                >
                  {o.correct ? (
                    <IconCircleCheck className="size-4 shrink-0" aria-hidden="true" />
                  ) : o.selected ? (
                    <IconCircleX className="size-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <span className="size-4 shrink-0" aria-hidden="true" />
                  )}
                  <span>
                    {o.text}
                    {o.correct && " — correta"}
                    {o.selected && " (sua resposta)"}
                  </span>
                </li>
              ))}
            </ul>
            {q.explanation && <p className="text-small text-ink-soft">{q.explanation}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
