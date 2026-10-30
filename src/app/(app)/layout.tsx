import { cookies } from "next/headers";
import { AppShell, type NavSection } from "@/components/layout/app-shell";
import type { ThemePreference } from "@/components/layout/theme-toggle";
import { requireUser } from "@/server/auth/current-user";
import { hasPermission, PERMISSIONS } from "@/server/auth/permissions";
import { db } from "@/server/db";
import { getLevelInfo, listNotifications } from "@/server/services/gamification";
import { formatDateTime } from "@/lib/format";
import { logoutAction, markNotificationsReadAction } from "./actions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const themeCookie = (await cookies()).get("apc_theme")?.value;
  const theme: ThemePreference =
    themeCookie === "light" || themeCookie === "dark" ? themeCookie : "system";

  // O menu mostra apenas o que o perfil pode acessar; o servidor valida de novo em cada rota.
  const sections: NavSection[] = [
    {
      items: [
        { href: "/", label: "Painel", icon: "painel", exact: true },
        { href: "/trilhas", label: "Minhas trilhas", icon: "trilhas" },
        { href: "/biblioteca", label: "Central de Conhecimento", icon: "biblioteca" },
        { href: "/conquistas", label: "Conquistas", icon: "conquistas" },
        { href: "/minha-conta", label: "Minha conta", icon: "conta" },
      ],
    },
  ];
  if (hasPermission(user, PERMISSIONS.ADMIN_ACESSAR)) {
    const adminItems: NavSection["items"] = [
      { href: "/admin", label: "Visão geral", icon: "visao", exact: true },
    ];
    if (hasPermission(user, PERMISSIONS.RELATORIOS_VER))
      adminItems.push({ href: "/admin/relatorios", label: "Relatórios", icon: "relatorios" });
    if (hasPermission(user, PERMISSIONS.TRILHAS_GERENCIAR))
      adminItems.push({ href: "/admin/trilhas", label: "Trilhas", icon: "trilhas" });
    if (hasPermission(user, PERMISSIONS.GAMIFICACAO_CONFIGURAR))
      adminItems.push({ href: "/admin/gamificacao", label: "Gamificação", icon: "gamificacao" });
    if (hasPermission(user, PERMISSIONS.CONTEUDOS_GERENCIAR))
      adminItems.push({ href: "/admin/conteudos", label: "Conteúdos", icon: "conteudos" });
    if (hasPermission(user, PERMISSIONS.CATEGORIAS_GERENCIAR))
      adminItems.push({ href: "/admin/categorias", label: "Categorias", icon: "categorias" });
    if (hasPermission(user, PERMISSIONS.USUARIOS_GERENCIAR))
      adminItems.push({ href: "/admin/usuarios", label: "Usuários", icon: "usuarios" });
    if (hasPermission(user, PERMISSIONS.GRUPOS_GERENCIAR))
      adminItems.push({ href: "/admin/grupos", label: "Grupos", icon: "grupos" });
    if (hasPermission(user, PERMISSIONS.AUDITORIA_VER))
      adminItems.push({ href: "/admin/auditoria", label: "Auditoria", icon: "auditoria" });
    sections.push({ title: "Administração", items: adminItems });
  }

  const [notifications, level] = await Promise.all([listNotifications(db, user), getLevelInfo(db, user.id)]);

  return (
    <AppShell
      sections={sections}
      user={{
        name: user.name,
        email: user.email,
        roleName: user.roleName,
        level: level.current ? { number: level.current.number, name: level.current.name } : null,
      }}
      theme={theme}
      logoutAction={logoutAction}
      notifications={{
        unread: notifications.unread,
        items: notifications.items.map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          link: n.link,
          read: !!n.readAt,
          createdAt: formatDateTime(n.createdAt),
        })),
      }}
      markNotificationsRead={markNotificationsReadAction}
    >
      {children}
    </AppShell>
  );
}
