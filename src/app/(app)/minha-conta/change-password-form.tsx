"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toaster";
import { PASSWORD_HINT } from "@/components/forms/new-password-form";
import { changePasswordAction } from "../actions";

export function ChangePasswordForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(changePasswordAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && state.message) {
      toast(state.message);
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex max-w-md flex-col gap-4" noValidate>
      {state.ok === false && state.message && <Alert tone="danger">{state.message}</Alert>}
      <input type="email" name="email" value={email} autoComplete="username" readOnly hidden />
      <Field label="Senha atual" name="currentPassword" error={state.fieldErrors?.currentPassword}>
        {(p) => <Input {...p} type="password" autoComplete="current-password" />}
      </Field>
      <Field label="Nova senha" name="password" error={state.fieldErrors?.password} hint={PASSWORD_HINT}>
        {(p) => <Input {...p} type="password" autoComplete="new-password" />}
      </Field>
      <Field
        label="Confirme a nova senha"
        name="confirmPassword"
        error={state.fieldErrors?.confirmPassword}
      >
        {(p) => <Input {...p} type="password" autoComplete="new-password" />}
      </Field>
      <div>
        <Button type="submit" loading={pending}>
          Alterar senha
        </Button>
      </div>
    </form>
  );
}
