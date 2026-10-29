import type { Metadata } from "next";
import Link from "next/link";
import { IconUsersGroup } from "@tabler/icons-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/auth/permissions";
import { listGroups } from "@/server/services/groups";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { NewGroupButton } from "./new-group-button";

export const metadata: Metadata = { title: "Grupos" };

export default async function GroupsPage() {
  const actor = await requirePermission(PERMISSIONS.GRUPOS_GERENCIAR);
  const groups = await listGroups(db, actor);
  return (
    <>
      <PageHeader
        title="Grupos"
        description="Agrupe pessoas (por turma, área ou função) para atribuir trilhas em conjunto."
        actions={<NewGroupButton />}
      />
      <Card>
        {groups.length === 0 ? (
          <EmptyState
            icon={<IconUsersGroup />}
            title="Nenhum grupo criado"
            description="Crie grupos como “Novos colaboradores — Financeiro” para organizar atribuições."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Grupo</Th>
                <Th>Membros</Th>
                <Th>Atualizado em</Th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Tr key={g.id}>
                  <Td>
                    <Link href={`/admin/grupos/${g.id}`} className="font-medium text-ink hover:underline">
                      {g.name}
                    </Link>
                    {g.description && (
                      <span className="block text-small text-ink-muted">{g.description}</span>
                    )}
                  </Td>
                  <Td>{g._count.members}</Td>
                  <Td className="whitespace-nowrap">{formatDate(g.updatedAt)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
