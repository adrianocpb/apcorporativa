"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import type { ActionState } from "@/server/actions";

export const PASSWORD_HINT =
  "Mínimo de 10 caracteres. Prefira uma frase fácil de lembrar e difícil de adivinhar.";

/** Formulário de nova senha + confirmação, usado no convite e na redefinição. */
export function NewPasswordForm({
  action,
  submitLabel,
  email,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  email: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      {/* Ajuda gerenciadores de senha a associar a senha ao e-mail correto. */}
      <input type="email" name="email" value={email} autoComplete="username" readOnly hidden />
      <Field
        label="Nova senha"
        name="password"
        error={state.fieldErrors?.password}
        hint={PASSWORD_HINT}
      >
        {(p) => <Input {...p} type="password" autoComplete="new-password" autoFocus />}
      </Field>
      <Field label="Confirme a nova senha" name="confirmPassword" error={state.fieldErrors?.confirmPassword}>
        {(p) => <Input {...p} type="password" autoComplete="new-password" />}
      </Field>
      <Button type="submit" loading={pending} className="mt-2 w-full">
        {submitLabel}
      </Button>
    </form>
  );
}
