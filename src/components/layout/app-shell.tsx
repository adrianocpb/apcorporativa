"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as Menu from "@radix-ui/react-dropdown-menu";
import {
  IconChevronDown,
  IconFileSearch,
  IconLayoutDashboard,
  IconLogout,
  IconMenu2,
  IconUserCircle,
  IconUsers,
  IconUsersGroup,
  IconChartBar,
  IconFiles,
  IconFolders,
  IconRoute,
  IconTrophy,
  IconSparkles,
  IconBooks,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/feedback";
import { BrandMark } from "@/components/layout/brand-mark";
import { ThemeToggle, type ThemePreference } from "@/components/layout/theme-toggle";
import { NotificationBell, type NotificationItem } from "@/components/layout/notification-bell";

const ICONS = {
  painel: IconLayoutDashboard,
  conta: IconUserCircle,
  visao: IconChartBar,
  usuarios: IconUsers,
  grupos: IconUsersGroup,
  auditoria: IconFileSearch,
  conteudos: IconFiles,
  categorias: IconFolders,
  trilhas: IconRoute,
  conquistas: IconTrophy,
  gamificacao: IconSparkles,
  biblioteca: IconBooks,
};

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; exact?: boolean };
export type NavSection = { title?: string; items: NavItem[] };

type ShellUser = { name: string; email: string; roleName: string };

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function Nav({ sections, onNavigate }: { sections: NavSection[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Menu principal" className="flex flex-col gap-1 px-4">
      {sections.map((section, i) => (
        <div key={section.title ?? i} className="flex flex-col gap-1">
          {section.title && (
            <p className="mt-5 mb-1 px-3 text-small font-medium tracking-[0.2px] text-ink-muted uppercase">
              {section.title}
            </p>
          )}
          {section.items.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-body transition-colors",
                  active
                    ? "bg-primary text-on-primary shadow-primary"
                    : "text-ink-soft hover:bg-surface-hover",
                )}
              >
                <Icon className="size-[22px] shrink-0" stroke={1.5} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function AppShell({
  sections,
  user,
  theme,
  logoutAction,
  notifications,
  markNotificationsRead,
  children,
}: {
  sections: NavSection[];
  user: ShellUser;
  theme: ThemePreference;
  logoutAction: () => Promise<void>;
  notifications: { unread: number; items: NotificationItem[] };
  markNotificationsRead: () => Promise<void>;
  children: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  // O formulário de saída fica fora do menu: o menu fecha (e desmonta) antes de um envio interno.
  const logoutFormRef = useRef<HTMLFormElement>(null);

  return (
    <div className="min-h-screen">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70] focus:rounded-md focus:bg-surface focus:px-4 focus:py-2"
      >
        Ir para o conteúdo
      </a>

      {/* Menu lateral fixo (desktop) */}
      <aside className="fixed inset-y-0 left-0 hidden w-[260px] flex-col bg-surface shadow-card lg:flex">
        <div className="flex h-16 items-center px-7">
          <Link href="/" aria-label="Ir para o painel">
            <BrandMark />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <Nav sections={sections} />
        </div>
      </aside>

      {/* Menu lateral em gaveta (tablet e celular) */}
      <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-[#1b1830]/50 lg:hidden" />
          <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col bg-surface shadow-raised lg:hidden">
            <Dialog.Title className="sr-only">Menu</Dialog.Title>
            <Dialog.Description className="sr-only">Navegação principal</Dialog.Description>
            <div className="flex h-16 items-center justify-between px-6">
              <BrandMark />
              <Dialog.Close
                className="rounded-md p-1 text-ink-muted hover:bg-surface-hover"
                aria-label="Fechar menu"
              >
                <IconX className="size-5" />
              </Dialog.Close>
            </div>
            <div className="flex-1 overflow-y-auto pb-6">
              <Nav sections={sections} onNavigate={() => setDrawerOpen(false)} />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="lg:pl-[260px]">
        <div className="mx-auto max-w-[1440px] px-4 pt-4 sm:px-6">
          <header className="flex h-14 items-center justify-between gap-3 rounded-md bg-surface px-3 shadow-raised sm:px-4">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex size-[38px] items-center justify-center rounded-md text-ink-soft hover:bg-surface-hover lg:hidden"
              aria-label="Abrir menu"
            >
              <IconMenu2 className="size-[22px]" />
            </button>
            <div className="lg:hidden">
              <BrandMark showName={false} />
            </div>
            {/* Busca global: leva para a Central de Conhecimento. */}
            <form action="/biblioteca" method="get" role="search" className="relative hidden max-w-md flex-1 md:block">
              <IconSearch className="pointer-events-none absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-ink-muted" aria-hidden="true" />
              <input
                type="search"
                name="q"
                placeholder="Buscar na Central de Conhecimento"
                aria-label="Buscar na Central de Conhecimento"
                className="h-[38px] w-full rounded-md border border-transparent bg-transparent pr-3 pl-10 text-body text-ink placeholder:text-ink-muted hover:bg-surface-hover focus:border-primary focus:bg-surface focus:outline-none"
              />
            </form>
            <Link
              href="/biblioteca"
              className="flex size-[38px] items-center justify-center rounded-md text-ink-soft hover:bg-surface-hover md:hidden"
              aria-label="Buscar na Central de Conhecimento"
            >
              <IconSearch className="size-[22px]" />
            </Link>
            <form ref={logoutFormRef} action={logoutAction} hidden />
            <div className="ml-auto flex items-center gap-1">
              <NotificationBell items={notifications.items} unread={notifications.unread} markRead={markNotificationsRead} />
              <ThemeToggle initial={theme} />
              <Menu.Root>
                <Menu.Trigger
                  className="flex items-center gap-2 rounded-md py-1 pr-2 pl-1 hover:bg-surface-hover"
                  aria-label="Menu do usuário"
                >
                  <Avatar name={user.name} size="sm" />
                  <span className="hidden max-w-[180px] truncate text-body font-medium text-ink sm:block">
                    {user.name}
                  </span>
                  <IconChevronDown className="size-4 text-ink-muted" aria-hidden="true" />
                </Menu.Trigger>
                <Menu.Portal>
                  <Menu.Content
                    align="end"
                    sideOffset={8}
                    className="z-50 min-w-[230px] rounded-md bg-surface p-2 shadow-raised"
                  >
                    <div className="px-3 py-2">
                      <p className="truncate text-body font-medium text-ink">{user.name}</p>
                      <p className="truncate text-small text-ink-muted">{user.email}</p>
                      <p className="text-small text-primary-text">{user.roleName}</p>
                    </div>
                    <Menu.Separator className="my-1 h-px bg-line" />
                    <Menu.Item asChild>
                      <Link
                        href="/minha-conta"
                        className="flex items-center gap-2 rounded-md px-3 py-2 text-body text-ink-soft outline-none data-[highlighted]:bg-surface-hover"
                      >
                        <IconUserCircle className="size-[18px]" aria-hidden="true" />
                        Minha conta
                      </Link>
                    </Menu.Item>
                    <Menu.Item asChild onSelect={() => logoutFormRef.current?.requestSubmit()}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-body text-danger-text outline-none data-[highlighted]:bg-surface-hover"
                        >
                          <IconLogout className="size-[18px]" aria-hidden="true" />
                          Sair
                        </button>
                      </Menu.Item>
                  </Menu.Content>
                </Menu.Portal>
              </Menu.Root>
            </div>
          </header>

          <main id="conteudo" className="py-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
