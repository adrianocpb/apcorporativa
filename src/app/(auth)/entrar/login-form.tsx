"use client";

import Link from "next/link";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { loginAction } from "../actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useFormAction(loginAction);
  return (
    <form key={state.at ?? 0} action={action} className="flex flex-col gap-4" noValidate>
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <input type="hidden" name="next" value={next} />
      <Field label="E-mail" name="email" error={state.fieldErrors?.email}>
        {(p) => (
          <Input
            {...p}
            type="email"
            autoComplete="username"
            defaultValue={state.values?.email}
            autoFocus
          />
        )}
      </Field>
      <Field label="Senha" name="password" error={state.fieldErrors?.password}>
        {(p) => <Input {...p} type="password" autoComplete="current-password" />}
      </Field>
      <Button type="submit" loading={pending} className="mt-2 w-full">
        Entrar
      </Button>
      <Link
        href="/esqueci-senha"
        className="self-center text-small text-primary-text hover:underline"
      >
        Esqueci minha senha
      </Link>
    </form>
  );
}
