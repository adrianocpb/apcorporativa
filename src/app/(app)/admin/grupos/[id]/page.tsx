import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconTrash, IconUserMinus, IconUsers } from "@tabler/icons-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/auth/permissions";
import { NotFoundError } from "@/server/errors";
import { getGroup, listAddableUsers } from "@/server/services/groups";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar, Badge, EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { ConfirmActionButton } from "@/components/forms/action-buttons";
import { USER_STATUS } from "@/lib/labels";
import { GroupForm } from "../group-form";
import { AddMembersForm } from "./add-members-form";
import {
  addMembersAction,
  deleteGroupAction,
  removeMemberAction,
  updateGroupAction,
} from "../actions";

export const metadata: Metadata = { title: "Grupo" };

export default async function GroupDetailPage({ params }: PageProps<"/admin/grupos/[id]">) {
  const actor = await requirePermission(PERMISSIONS.GRUPOS_GERENCIAR);
  const { id } = await params;
  let group;
  try {
    group = await getGroup(db, actor, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  const addable = await listAddableUsers(db, actor, id);

  return (
    <>
      <PageHeader
        title={group.name}
        description={`${group.members.length} membro(s)`}
        back={{ href: "/admin/grupos", label: "Grupos" }}
        actions={
          group.members.length === 0 ? (
            <ConfirmActionButton
              action={deleteGroupAction.bind(null, group.id)}
              label="Excluir grupo"
              icon={<IconTrash />}
              variant="danger-tonal"
              title="Excluir grupo?"
              description="O grupo será removido. Esta ação fica registrada na auditoria."
              confirmLabel="Excluir"
              confirmVariant="danger"
              successMessage="Grupo excluído."
            />
          ) : undefined
        }
      />
      <div className="grid gap-6 xl:grid-cols-12">
        <div className="flex flex-col gap-6 xl:col-span-4">
          <Card>
            <CardHeader title="Dados do grupo" />
            <CardBody>
              <GroupForm
                action={updateGroupAction.bind(null, group.id)}
                submitLabel="Salvar"
                defaultValues={{ name: group.name, description: group.description ?? "" }}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Adicionar membros" subtitle="Usuários ativos ou com convite pendente" />
            <CardBody>
              <AddMembersForm action={addMembersAction.bind(null, group.id)} users={addable} />
            </CardBody>
          </Card>
        </div>
        <Card className="xl:col-span-8">
          <CardHeader title="Membros" />
          {group.members.length === 0 ? (
            <EmptyState
              icon={<IconUsers />}
              title="Grupo sem membros"
              description="Adicione pessoas ao lado. Grupos vazios podem ser excluídos."
            />
          ) : (
            <div className="mt-4">
              <Table>
                <thead>
                  <tr>
                    <Th>Usuário</Th>
                    <Th>Área</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Ações</Th>
                  </tr>
                </thead>
                <tbody>
                  {group.members.map(({ user }) => (
                    <Tr key={user.id}>
                      <Td>
                        <Link href={`/admin/usuarios/${user.id}`} className="flex items-center gap-3 hover:underline">
                          <Avatar name={user.name} size="sm" />
                          <span className="min-w-0">
                            <span className="block font-medium text-ink">{user.name}</span>
                            <span className="block text-small text-ink-muted">{user.email}</span>
                          </span>
                        </Link>
                      </Td>
                      <Td>{user.department ?? "—"}</Td>
                      <Td>
                        <Badge tone={USER_STATUS[user.status].tone}>{USER_STATUS[user.status].label}</Badge>
                      </Td>
                      <Td className="text-right">
                        <ConfirmActionButton
                          action={removeMemberAction.bind(null, group.id, user.id)}
                          label="Remover"
                          icon={<IconUserMinus />}
                          variant="ghost"
                          title="Remover do grupo?"
                          description={`${user.name} deixa de fazer parte de “${group.name}”.`}
                          confirmLabel="Remover"
                          confirmVariant="danger"
                          successMessage="Membro removido."
                        />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
