"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import { IconBell } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";

export type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
};

/** Sino de notificações: abrir a lista marca as não lidas como lidas. */
export function NotificationBell({
  items,
  unread: initialUnread,
  markRead,
}: {
  items: NotificationItem[];
  unread: number;
  markRead: () => Promise<void>;
}) {
  const router = useRouter();
  const [unread, setUnread] = useState(initialUnread);
  const [seen, setSeen] = useState(initialUnread);

  // Nova contagem do servidor (após navegação) substitui a local.
  if (initialUnread !== seen) {
    setSeen(initialUnread);
    setUnread(initialUnread);
  }

  async function onOpenChange(open: boolean) {
    if (open && unread > 0) {
      setUnread(0);
      await markRead();
      router.refresh();
    }
  }

  return (
    <Menu.Root onOpenChange={onOpenChange}>
      <Menu.Trigger
        className="relative flex size-[38px] items-center justify-center rounded-md text-ink-soft hover:bg-surface-hover"
        aria-label={unread ? `Notificações: ${unread} não lida(s)` : "Notificações"}
      >
        <IconBell className="size-[22px]" aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-caption font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={8} className="z-50 w-[340px] max-w-[calc(100vw-32px)] rounded-md bg-surface p-2 shadow-raised">
          <p className="px-3 py-2 text-small font-medium tracking-[0.2px] text-ink uppercase">Notificações</p>
          {items.length === 0 ? (
            <p className="px-3 py-4 text-body text-ink-muted">Nenhuma notificação.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {items.map((n) => (
                <Menu.Item key={n.id} asChild>
                  <Link
                    href={n.link ?? "/"}
                    className={cn(
                      "flex flex-col gap-0.5 rounded-md px-3 py-2 outline-none data-[highlighted]:bg-surface-hover",
                      !n.read && "bg-primary-subtle",
                    )}
                  >
                    <span className="text-body font-medium text-ink">{n.title}</span>
                    {n.body && <span className="text-small text-ink-soft">{n.body}</span>}
                    <span className="text-caption text-ink-muted">{n.createdAt}</span>
                  </Link>
                </Menu.Item>
              ))}
            </div>
          )}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
