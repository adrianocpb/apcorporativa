"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { CopyField } from "@/components/ui/copy-field";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toaster";
import type { ActionState } from "@/server/actions";

type Action<T = undefined> = (state: ActionState<T>, formData: FormData) => Promise<ActionState<T>>;
type ButtonVariant = "primary" | "tonal" | "outline" | "ghost" | "danger" | "danger-tonal";

/** Botão que pede confirmação antes de executar uma ação (ex.: desativar usuário). */
export function ConfirmActionButton({
  action,
  label,
  icon,
  variant = "tonal",
  title,
  description,
  confirmLabel,
  confirmVariant = "primary",
  successMessage,
  size = "md",
}: {
  action: Action;
  label: string;
  icon?: ReactNode;
  variant?: ButtonVariant;
  size?: "md" | "sm";
  title: string;
  description: ReactNode;
  confirmLabel: string;
  confirmVariant?: ButtonVariant;
  successMessage: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  // Fica aberto desde o clique até chegar um resultado de sucesso posterior à abertura.
  // Guarda o `at` vigente no clique (não depende do relógio do cliente vs. servidor).
  const [openedWith, setOpenedWith] = useState<number | undefined | null>(null);
  const open = openedWith !== null && !(state.ok && state.at !== openedWith);
  const setOpen = (value: boolean) => setOpenedWith(value ? state.at : null);

  useEffect(() => {
    if (state.ok) toast(successMessage);
  }, [state, successMessage]);

  return (
    <>
      <Button variant={variant} size={size} icon={icon} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal open={open} onOpenChange={setOpen} title={title} description={description} size="sm">
        <form action={formAction} className="flex flex-col gap-4">
          {state.ok === false && state.message && <Alert tone="danger">{state.message}</Alert>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="tonal" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant={confirmVariant} loading={pending}>
              {confirmLabel}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/** Gera um link de uso único (convite/redefinição) e o exibe para copiar. */
export function LinkGeneratorButton({
  action,
  label,
  icon,
  title,
  instructions,
}: {
  action: Action<{ url: string; expiresAt: string }>;
  label: string;
  icon?: ReactNode;
  title: string;
  instructions: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  // Abre a cada link gerado, até ser fechado.
  const [closedAt, setClosedAt] = useState<number>();
  const open = !!state.at && state.at !== closedAt;
  const setOpen = (value: boolean) => {
    if (!value) setClosedAt(state.at);
  };

  return (
    <>
      <form action={formAction}>
        <Button type="submit" variant="tonal" icon={icon} loading={pending}>
          {label}
        </Button>
      </form>
      <Modal open={open} onOpenChange={setOpen} title={title} size="md">
        {state.ok && state.data ? (
          <div className="flex flex-col gap-4">
            <div className="text-body text-ink-soft">{instructions}</div>
            <CopyField value={state.data.url} label={title} />
            <p className="text-small text-ink-muted">
              Válido até {state.data.expiresAt}. Gerar um novo link invalida o anterior.
            </p>
            <div className="flex justify-end">
              <Button onClick={() => setOpen(false)}>Concluir</Button>
            </div>
          </div>
        ) : (
          <Alert tone="danger">{state.message}</Alert>
        )}
      </Modal>
    </>
  );
}
