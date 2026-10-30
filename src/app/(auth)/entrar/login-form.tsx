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
    <form key={state.at ?? 0} action={action} className="flex flex-col gap-5" noValidate>
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <input type="hidden" name="next" value={next} />
      <Field label="E-mail corporativo" name="email" error={state.fieldErrors?.email}>
        {(p) => (
          <Input
            {...p}
            type="email"
            autoComplete="username"
            placeholder="nome@empresa.com.br"
            defaultValue={state.values?.email}
            autoFocus
          />
        )}
      </Field>
      <Field
        label="Senha"
        name="password"
        error={state.fieldErrors?.password}
        labelAside={
          <Link href="/esqueci-senha" className="text-small text-ink underline underline-offset-2 hover:text-ink-muted">
            Esqueci minha senha
          </Link>
        }
      >
        {(p) => <Input {...p} type="password" autoComplete="current-password" />}
      </Field>
      <Button type="submit" loading={pending} className="mt-1 h-11 w-full">
        Entrar
      </Button>
      <p className="text-small text-ink-muted">
        Primeiro acesso? Abra o link de convite que você recebeu do administrador — sua conta começa
        no nível 1.
      </p>
    </form>
  );
}
