"use client";

import { IconArrowRight, IconCircleCheck } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toaster";
import { confirmItemAction, openItemAction } from "@/app/(app)/trilhas/actions";
import { announceReward } from "./reward";

/**
 * Registra a abertura do conteúdo e oferece a ação de conclusão conforme a regra:
 * - CONFIRM: botão liberado após o tempo mínimo (o servidor confere de novo);
 * - VIEW: abrir já conclui;
 * - WATCH: a conclusão vem do player de vídeo.
 */
export function ItemTracker({
  trackId,
  itemId,
  rule,
  dwellSeconds,
  secondsSinceOpen,
  completed,
  next,
}: {
  trackId: string;
  itemId: string;
  rule: string;
  dwellSeconds: number;
  secondsSinceOpen: number | null;
  completed: boolean;
  next: { href: string; label: string } | null;
}) {
  const router = useRouter();
  const opened = useRef(false);
  const [remaining, setRemaining] = useState(
    Math.max(0, Math.ceil(dwellSeconds - (secondsSinceOpen ?? 0))),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    openItemAction(trackId, itemId).then((r) => {
      if (!r.ok) setError(r.message ?? null);
      else if (r.data?.events) {
        if (r.data.events.trackCompleted) toast("Parabéns! Você concluiu a trilha.");
        announceReward(r.data.events.reward);
        router.refresh();
      }
    });
  }, [trackId, itemId, router]);

  useEffect(() => {
    if (completed || remaining <= 0) return;
    const timer = setInterval(() => setRemaining((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [completed, remaining]);

  function confirm() {
    setError(null);
    startTransition(async () => {
      const r = await confirmItemAction(trackId, itemId);
      if (!r.ok) {
        setError(r.message ?? "Não foi possível concluir.");
        return;
      }
      toast(r.data?.events.trackCompleted ? "Parabéns! Você concluiu a trilha." : "Conteúdo concluído.");
      announceReward(r.data?.events.reward);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-line p-4">
      {error && <Alert tone="danger">{error}</Alert>}
      {completed ? (
        <p className="flex items-center gap-2 text-body font-medium text-success-text">
          <IconCircleCheck className="size-5" aria-hidden="true" /> Concluído
        </p>
      ) : rule === "CONFIRM" ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={confirm} loading={pending} disabled={remaining > 0} icon={<IconCircleCheck />}>
            Concluí este conteúdo
          </Button>
          <span className="text-small text-ink-muted" aria-live="polite">
            {remaining > 0
              ? `Disponível em ${remaining} s — aproveite para ler com atenção.`
              : "Confirme quando terminar de ler."}
          </span>
        </div>
      ) : rule === "WATCH" ? (
        <p className="text-small text-ink-soft">A conclusão é registrada automaticamente ao assistir ao vídeo.</p>
      ) : (
        <p className="text-small text-ink-soft">Registrando…</p>
      )}
      {next && (completed || rule !== "CONFIRM") && (
        <div>
          <ButtonLink href={next.href} variant={completed ? "primary" : "tonal"} icon={<IconArrowRight />}>
            {next.label}
          </ButtonLink>
        </div>
      )}
    </div>
  );
}
