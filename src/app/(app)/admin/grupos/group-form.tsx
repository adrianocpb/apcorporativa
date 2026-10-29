"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toaster";
import type { ActionState } from "@/server/actions";

export function GroupForm<T>({
  action,
  defaultValues,
  submitLabel,
  onCreatedHref,
}: {
  action: (state: ActionState<T>, formData: FormData) => Promise<ActionState<T>>;
  defaultValues?: { name: string; description: string };
  submitLabel: string;
  /** Na criação: para onde ir depois de salvar (recebe o id criado). */
  onCreatedHref?: (data: T) => string;
}) {
  const [state, formAction, pending] = useFormAction(action);
  const router = useRouter();
  const v = (state.ok === false ? state.values : undefined) ?? defaultValues;

  useEffect(() => {
    if (!state.ok) return;
    if (onCreatedHref && state.data) {
      toast("Grupo criado.");
      router.push(onCreatedHref(state.data));
    } else if (state.message) {
      toast(state.message);
    }
  }, [state, onCreatedHref, router]);

  return (
    <form key={state.at ?? 0} action={formAction} className="flex flex-col gap-4" noValidate>
      {state.ok === false && state.message && <Alert tone="danger">{state.message}</Alert>}
      <Field label="Nome do grupo" name="name" required error={state.fieldErrors?.name}>
        {(p) => <Input {...p} defaultValue={v?.name} maxLength={80} />}
      </Field>
      <Field
        label="Descrição"
        name="description"
        error={state.fieldErrors?.description}
        hint="Opcional. Ex.: novos colaboradores do Financeiro em novembro."
      >
        {(p) => <Textarea {...p} defaultValue={v?.description} maxLength={300} rows={3} />}
      </Field>
      <div>
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
