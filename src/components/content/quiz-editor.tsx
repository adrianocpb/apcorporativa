"use client";

import { IconArrowDown, IconArrowUp, IconPlus, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import { QUIZ_KIND_LABEL, QUIZ_KINDS, QUIZ_LIMITS, type QuizDefinition, type QuizKind, type QuizQuestion } from "@/lib/quiz";

const newId = () => crypto.randomUUID().slice(0, 12);

function trueFalseOptions(): QuizQuestion["options"] {
  return [
    { id: newId(), text: "Verdadeiro", correct: true },
    { id: newId(), text: "Falso", correct: false },
  ];
}

function newQuestion(): QuizQuestion {
  return {
    id: newId(),
    kind: "SINGLE",
    text: "",
    explanation: "",
    options: [
      { id: newId(), text: "", correct: true },
      { id: newId(), text: "", correct: false },
    ],
  };
}

/**
 * Editor de perguntas do quiz. O estado inteiro vai para o servidor como JSON no campo
 * oculto "quiz"; a validação definitiva (e a checagem para publicar) acontece lá.
 */
export function QuizEditor({ initial, error }: { initial: QuizDefinition; error?: string }) {
  const [quiz, setQuiz] = useState<QuizDefinition>(() =>
    initial.questions.length ? initial : { ...initial, questions: [newQuestion()] },
  );

  const setQuestion = (id: string, patch: (q: QuizQuestion) => QuizQuestion) =>
    setQuiz((s) => ({ ...s, questions: s.questions.map((q) => (q.id === id ? patch(q) : q)) }));

  function move(index: number, offset: number) {
    setQuiz((s) => {
      const list = [...s.questions];
      const [q] = list.splice(index, 1);
      list.splice(index + offset, 0, q);
      return { ...s, questions: list };
    });
  }

  function changeKind(q: QuizQuestion, kind: QuizKind): QuizQuestion {
    if (kind === "TRUE_FALSE") return { ...q, kind, options: trueFalseOptions() };
    if (q.kind === "TRUE_FALSE") return { ...q, kind, options: newQuestion().options };
    if (kind === "SINGLE") {
      // Escolha única: mantém só a primeira marcada como correta.
      const first = q.options.findIndex((o) => o.correct);
      return { ...q, kind, options: q.options.map((o, i) => ({ ...o, correct: i === Math.max(0, first) })) };
    }
    return { ...q, kind };
  }

  return (
    <section className="flex flex-col gap-5" aria-label="Perguntas do quiz">
      <input type="hidden" name="quiz" value={JSON.stringify(quiz)} />
      {error && <Alert tone="danger">{error}</Alert>}

      <fieldset className="grid gap-4 rounded-md border border-line p-4 md:grid-cols-3">
        <legend className="px-1 text-small font-medium text-ink">Regras do quiz</legend>
        <Field label="Nota mínima para aprovar (%)" name="quiz-nota" hint="Percentual de perguntas certas.">
          {(p) => (
            <Input
              {...p}
              type="number"
              min={1}
              max={100}
              value={quiz.passPercent}
              onChange={(e) => setQuiz((s) => ({ ...s, passPercent: Math.max(1, Math.min(100, Math.round(Number(e.target.value) || 1))) }))}
            />
          )}
        </Field>
        <Field label="Tentativas" name="quiz-tentativas" hint="Ao reprovar, a pessoa refaz só o quiz.">
          {(p) => (
            <Select
              {...p}
              value={quiz.maxAttempts ?? ""}
              onChange={(e) => setQuiz((s) => ({ ...s, maxAttempts: e.target.value ? Number(e.target.value) : null }))}
            >
              <option value="">Sem limite</option>
              {[1, 2, 3, 4, 5, 10].map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? "1 tentativa" : `${n} tentativas`}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <label className="flex items-start gap-3 self-center">
          <Checkbox
            checked={quiz.shuffle}
            onChange={(e) => setQuiz((s) => ({ ...s, shuffle: e.target.checked }))}
            className="mt-0.5"
          />
          <span>
            <span className="block text-body text-ink">Embaralhar</span>
            <span className="block text-small text-ink-muted">Perguntas e alternativas em ordem diferente a cada tentativa.</span>
          </span>
        </label>
      </fieldset>

      <ol className="flex flex-col gap-4">
        {quiz.questions.map((q, index) => {
          const multiple = q.kind === "MULTIPLE";
          return (
            <li key={q.id} className="flex flex-col gap-4 rounded-lg border border-line p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-h6 font-medium text-ink">Pergunta {index + 1}</h3>
                <Select
                  aria-label={`Tipo da pergunta ${index + 1}`}
                  value={q.kind}
                  onChange={(e) => setQuestion(q.id, (x) => changeKind(x, e.target.value as QuizKind))}
                  className="ml-auto h-[30px] w-auto! text-small"
                >
                  {QUIZ_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {QUIZ_KIND_LABEL[k]}
                    </option>
                  ))}
                </Select>
                <Button size="sm" variant="ghost" aria-label={`Subir pergunta ${index + 1}`} disabled={index === 0} onClick={() => move(index, -1)} icon={<IconArrowUp />} />
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Descer pergunta ${index + 1}`}
                  disabled={index === quiz.questions.length - 1}
                  onClick={() => move(index, 1)}
                  icon={<IconArrowDown />}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Remover pergunta ${index + 1}`}
                  disabled={quiz.questions.length === 1}
                  onClick={() => setQuiz((s) => ({ ...s, questions: s.questions.filter((x) => x.id !== q.id) }))}
                  icon={<IconTrash />}
                />
              </div>

              <Field label="Enunciado" name={`quiz-${q.id}-texto`}>
                {(p) => (
                  <Textarea
                    {...p}
                    rows={2}
                    maxLength={QUIZ_LIMITS.text}
                    value={q.text}
                    onChange={(e) => setQuestion(q.id, (x) => ({ ...x, text: e.target.value }))}
                  />
                )}
              </Field>

              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1.5 text-small font-medium text-ink">
                  Alternativas{" "}
                  <span className="font-normal text-ink-muted">
                    — marque {multiple ? "todas as corretas" : "a correta"}
                  </span>
                </legend>
                {q.options.map((o, oi) => (
                  <div key={o.id} className={cn("flex items-center gap-2 rounded-md border px-2 py-1.5", o.correct ? "border-success bg-success-subtle" : "border-line")}>
                    <input
                      type={multiple ? "checkbox" : "radio"}
                      name={`quiz-${q.id}-correta`}
                      checked={o.correct}
                      aria-label={`Alternativa ${oi + 1} correta`}
                      onChange={(e) =>
                        setQuestion(q.id, (x) => ({
                          ...x,
                          options: x.options.map((y) =>
                            multiple ? (y.id === o.id ? { ...y, correct: e.target.checked } : y) : { ...y, correct: y.id === o.id },
                          ),
                        }))
                      }
                      className="size-[18px] shrink-0 accent-[var(--success)]"
                    />
                    <Input
                      aria-label={`Texto da alternativa ${oi + 1}`}
                      value={o.text}
                      maxLength={QUIZ_LIMITS.option}
                      readOnly={q.kind === "TRUE_FALSE"}
                      onChange={(e) =>
                        setQuestion(q.id, (x) => ({ ...x, options: x.options.map((y) => (y.id === o.id ? { ...y, text: e.target.value } : y)) }))
                      }
                      className="h-[34px] border-transparent bg-transparent"
                    />
                    {q.kind !== "TRUE_FALSE" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Remover alternativa ${oi + 1}`}
                        disabled={q.options.length <= 2}
                        onClick={() => setQuestion(q.id, (x) => ({ ...x, options: x.options.filter((y) => y.id !== o.id) }))}
                        icon={<IconTrash />}
                      />
                    )}
                  </div>
                ))}
                {q.kind !== "TRUE_FALSE" && q.options.length < QUIZ_LIMITS.options && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="self-start"
                    icon={<IconPlus />}
                    onClick={() => setQuestion(q.id, (x) => ({ ...x, options: [...x.options, { id: newId(), text: "", correct: false }] }))}
                  >
                    Adicionar alternativa
                  </Button>
                )}
              </fieldset>

              <Field
                label="Explicação (opcional)"
                name={`quiz-${q.id}-explicacao`}
                hint="Aparece no gabarito, depois que a pessoa for aprovada."
              >
                {(p) => (
                  <Textarea
                    {...p}
                    rows={2}
                    maxLength={QUIZ_LIMITS.explanation}
                    value={q.explanation}
                    onChange={(e) => setQuestion(q.id, (x) => ({ ...x, explanation: e.target.value }))}
                  />
                )}
              </Field>
            </li>
          );
        })}
      </ol>

      {quiz.questions.length < QUIZ_LIMITS.questions && (
        <Button variant="tonal" className="self-start" icon={<IconPlus />} onClick={() => setQuiz((s) => ({ ...s, questions: [...s.questions, newQuestion()] }))}>
          Adicionar pergunta
        </Button>
      )}
    </section>
  );
}
