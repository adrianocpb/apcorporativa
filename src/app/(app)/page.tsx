import type { Metadata } from "next";
import { IconRoute, IconUsers } from "@tabler/icons-react";
import { requireUser } from "@/server/auth/current-user";
import { hasPermission, PERMISSIONS } from "@/server/auth/permissions";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { firstName, formatLongDate, greeting } from "@/lib/format";

export const metadata: Metadata = { title: "Painel" };

export default async function DashboardPage() {
  const user = await requireUser();
  const isAdmin = hasPermission(user, PERMISSIONS.ADMIN_ACESSAR);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-small text-ink-muted first-letter:uppercase">
          {formatLongDate(new Date())}
        </p>
        <h1 className="text-h4 font-medium text-ink">
          {greeting()}, {firstName(user.name)}!
        </h1>
        <p className="text-body text-ink-soft">
          {[user.jobTitle, user.department].filter(Boolean).join(" · ") || user.roleName}
        </p>
      </div>

      <Card>
        <CardHeader title="Suas trilhas" subtitle="Treinamentos atribuídos a você" />
        <CardBody>
          <EmptyState
            icon={<IconRoute />}
            title="Nenhuma trilha atribuída ainda"
            description="Quando o administrador atribuir uma trilha a você, ela aparecerá aqui com o próximo passo recomendado."
          />
        </CardBody>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader title="Administração" subtitle="Atalhos para a gestão da plataforma" />
          <CardBody className="flex flex-wrap gap-3">
            <ButtonLink href="/admin/usuarios/novo" icon={<IconUsers />}>
              Novo usuário
            </ButtonLink>
            <ButtonLink href="/admin" variant="tonal">
              Visão geral
            </ButtonLink>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
