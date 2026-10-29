import type { Metadata } from "next";
import Link from "next/link";
import {
  IconFilePencil,
  IconFiles,
  IconMailForward,
  IconUserCheck,
  IconUserOff,
  IconUserPlus,
  IconUsersGroup,
} from "@tabler/icons-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/current-user";
import { hasPermission, PERMISSIONS } from "@/server/auth/permissions";
import { getContentStats } from "@/server/services/contents";
import { getAdminOverview } from "@/server/services/admin-overview";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, StatCard } from "@/components/ui/card";
import { Avatar, Badge, EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { formatDate, formatNumber } from "@/lib/format";
import { USER_STATUS } from "@/lib/labels";

export const metadata: Metadata = { title: "Visão geral" };

export default async function AdminOverviewPage() {
  const actor = await requirePermission(PERMISSIONS.ADMIN_ACESSAR);
  const data = await getAdminOverview(db, actor);
  const contents = hasPermission(actor, PERMISSIONS.CONTEUDOS_GERENCIAR)
    ? await getContentStats(db, actor)
    : null;
  return (
    <>
      <PageHeader
        title="Visão geral"
        description="Situação atual das contas da plataforma."
        actions={
          <ButtonLink href="/admin/usuarios/novo" icon={<IconUserPlus />}>
            Novo usuário
          </ButtonLink>
        }
      />
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Usuários ativos"
          value={formatNumber(data.active)}
          icon={<IconUserCheck />}
          tone="success"
        />
        <StatCard
          label="Convites pendentes"
          value={formatNumber(data.invited)}
          hint="Ainda não definiram a senha"
          icon={<IconMailForward />}
          tone="warning"
        />
        <StatCard
          label="Usuários inativos"
          value={formatNumber(data.inactive)}
          icon={<IconUserOff />}
          tone="secondary"
        />
        <StatCard
          label="Grupos"
          value={formatNumber(data.groups)}
          icon={<IconUsersGroup />}
          tone="info"
        />
      </div>

      {contents && (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Conteúdos publicados" value={formatNumber(contents.published)} icon={<IconFiles />} />
          <StatCard
            label="Rascunhos"
            value={formatNumber(contents.draft)}
            hint="Ainda não publicados"
            icon={<IconFilePencil />}
            tone="warning"
          />
        </div>
      )}

      <Card className="mt-6">
        <CardHeader
          title="Cadastros recentes"
          subtitle="Últimos usuários criados"
          actions={
            <Link href="/admin/usuarios" className="text-small text-primary-text hover:underline">
              Ver todos
            </Link>
          }
        />
        {data.recentUsers.length === 0 ? (
          <EmptyState
            title="Nenhum usuário cadastrado"
            description="Cadastre o primeiro colaborador para enviar o convite de acesso."
          />
        ) : (
          <div className="mt-4">
            <Table>
              <thead>
                <tr>
                  <Th>Usuário</Th>
                  <Th>Status</Th>
                  <Th>Cadastro</Th>
                </tr>
              </thead>
              <tbody>
                {data.recentUsers.map((u) => (
                  <Tr key={u.id}>
                    <Td>
                      <Link href={`/admin/usuarios/${u.id}`} className="flex items-center gap-3">
                        <Avatar name={u.name} size="sm" />
                        <span className="min-w-0">
                          <span className="block font-medium text-ink">{u.name}</span>
                          <span className="block text-small text-ink-muted">{u.email}</span>
                        </span>
                      </Link>
                    </Td>
                    <Td>
                      <Badge tone={USER_STATUS[u.status].tone}>{USER_STATUS[u.status].label}</Badge>
                    </Td>
                    <Td className="whitespace-nowrap">{formatDate(u.createdAt)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card>
    </>
  );
}
