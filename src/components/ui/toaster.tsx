"use client";

import { IconCircleCheck, IconAlertCircle, IconX } from "@tabler/icons-react";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";

type Toast = { id: number; message: string; tone: "success" | "danger" };

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function toast(message: string, tone: Toast["tone"] = "success") {
  const id = nextId++;
  toasts = [...toasts, { id, message, tone }];
  emit();
  setTimeout(() => dismiss(id), 5000);
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

const FLASH_COOKIE = "apc_flash";

function readFlash() {
  const raw = document.cookie.split("; ").find((c) => c.startsWith(`${FLASH_COOKIE}=`));
  if (!raw) return;
  document.cookie = `${FLASH_COOKIE}=; Max-Age=0; path=/`;
  try {
    const { message, tone } = JSON.parse(decodeURIComponent(raw.slice(FLASH_COOKIE.length + 1)));
    if (typeof message === "string") toast(message, tone === "danger" ? "danger" : "success");
  } catch {
    // Cookie inválido: ignora.
  }
}

/** Notificações temporárias. Lê também a mensagem deixada por uma Server Action (flash). */
export function Toaster() {
  const pathname = usePathname();
  const items = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => toasts,
    () => toasts,
  );
  useEffect(() => {
    readFlash();
  }, [pathname]);

  return (
    <div
      className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[calc(100%-32px)] max-w-sm flex-col gap-2"
      aria-live="polite"
      role="status"
    >
      {items.map((t) => {
        const Icon = t.tone === "success" ? IconCircleCheck : IconAlertCircle;
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 rounded-md bg-surface px-4 py-3 shadow-raised"
          >
            <Icon
              className={cn(
                "mt-0.5 size-5 shrink-0",
                t.tone === "success" ? "text-success-text" : "text-danger-text",
              )}
              aria-hidden="true"
            />
            <p className="flex-1 text-body text-ink">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="-m-1 rounded-md p-1 text-ink-muted hover:bg-surface-hover"
              aria-label="Fechar notificação"
            >
              <IconX className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
