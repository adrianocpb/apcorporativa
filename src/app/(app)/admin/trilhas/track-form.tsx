"use client";

import { useEffect } from "react";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toaster";
import type { ActionState } from "@/server/actions";

export type TrackFormValues = {
  title: string;
  description: string;
  categoryId: string;
  sequential: boolean;
  isOnboarding: boolean;
  videoThresholdPct: number;
  minReadSeconds: number;
};

/** Dados e regras da trilha (usado na criação e na aba Configurações). */
export function TrackForm({
  action,
  initial,
  categories,
  submitLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  initial: TrackFormValues;
  categories: { id: string; label: string }[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useFormAction(action);
  const err = state.fieldErrors ?? {};
  const sent = state.ok === false ? state.values : undefined;
  const v = {
    title: sent?.title ?? initial.title,
    description: sent?.description ?? initial.description,
    categoryId: sent?.categoryId ?? initial.categoryId,
    sequential: sent ? sent.sequential === "on" : initial.sequential,
    isOnboarding: sent ? sent.isOnboarding === "on" : initial.isOnboarding,
    videoThresholdPct: sent?.videoThresholdPct ?? String(initial.videoThresholdPct),
    minReadSeconds: sent?.minReadSeconds ?? String(initial.minReadSeconds),
  };

  useEffect(() => {
    if (state.ok && state.message) toast(state.message);
  }, [state]);

  return (
    <form key={state.at ?? 0} action={formAction} className="flex flex-col gap-5" noValidate>
      {state.ok === false && state.message && <Alert tone="danger">{state.message}</Alert>}
      <Field label="Nome da trilha" name="title" required error={err.title}>
        {(p) => <Input {...p} defaultValue={v.title} maxLength={160} placeholder="Ex.: Onboarding institucional" />}
      </Field>
      <Field label="Descrição" name="description" error={err.description} hint="O que a pessoa vai aprender e por quê.">
        {(p) => <Textarea {...p} defaultValue={v.description} rows={3} maxLength={2000} />}
      </Field>
      <Field label="Categoria" name="categoryId" error={err.categoryId}>
        {(p) => (
          <Select {...p} defaultValue={v.categoryId}>
            <option value="">Sem categoria</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <fieldset className="flex flex-col gap-3 rounded-md border border-line p-4">
        <legend className="px-1 text-small font-medium text-ink">Regras</legend>
        <label className="flex items-start gap-3">
          <Checkbox name="sequential" defaultChecked={v.sequential} className="mt-0.5" />
          <span>
            <span className="block text-body text-ink">Sequência obrigatória</span>
            <span className="block text-small text-ink-muted">
              Cada conteúdo obrigatório libera o seguinte. Desmarque para acesso livre.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3">
          <Checkbox name="isOnboarding" defaultChecked={v.isOnboarding} className="mt-0.5" />
          <span>
            <span className="block text-body text-ink">Trilha de onboarding</span>
            <span className="block text-small text-ink-muted">
              Aparece primeiro para quem está começando e conta nos indicadores de onboarding.
            </span>
          </span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Vídeo: percentual mínimo assistido"
            name="videoThresholdPct"
            error={err.videoThresholdPct}
            hint="Entre 50 e 100. Padrão: 90%."
          >
            {(p) => <Input {...p} type="number" min={50} max={100} defaultValue={v.videoThresholdPct} />}
          </Field>
          <Field
            label="PDF e artigo: tempo mínimo (segundos)"
            name="minReadSeconds"
            error={err.minReadSeconds}
            hint="Antes de permitir “Concluí a leitura”. Padrão: 30."
          >
            {(p) => <Input {...p} type="number" min={0} max={600} defaultValue={v.minReadSeconds} />}
          </Field>
        </div>
      </fieldset>

      <div>
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
