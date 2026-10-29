import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IconKey, IconMailForward, IconUserCheck, IconUserOff } from "@tabler/icons-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/auth/permissions";
import { NotFoundError } from "@/server/errors";
import { getUser, listDepartments } from "@/server/services/users";
import { listGroupOptions } from "@/server/services/groups";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar, Badge } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { ConfirmActionButton, LinkGeneratorButton } from "@/components/forms/action-buttons";
import { formatDateTime, toDateInputValue } from "@/lib/format";
import { USER_STATUS } from "@/lib/labels";
import { UserForm } from "../user-form";
import { UserGroupsForm } from "./user-groups-form";
import {
  deactivateUserAction,
  generateInviteAction,
  generateResetAction,
  reactivateUserAction,
  setUserGroupsAction,
  updateUserAction,
} from "../actions";

export const metadata: Metadata = { title: "Usuário" };

async function load(actor: Awaited<ReturnType<typeof requirePermission>>, id: string) {
  try {
    return await getUser(db, actor, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
}

export default async function UserDetailPage({ params }: PageProps<"/admin/usuarios/[id]">) {
  const actor = await requirePermission(PERMISSIONS.USUARIOS_GERENCIAR);
  const { id } = await params;
  const [user, departments, groups] = await Promise.all([
    load(actor, id),
    listDepartments(db, actor),
    listGroupOptions(db, actor),
  ]);
  const status = USER_STATUS[user.status];
  const isSelf = user.id === actor.id;

  return (
    <>
      <PageHeader
        title={user.name}
        description={user.email}
        back={{ href: "/admin/usuarios", label: "Usuários" }}
      />
      <div className="grid gap-6 xl:grid-cols-12">
        <div className="flex flex-col gap-6 xl:col-span-4">
          <Card>
            <CardBody className="flex flex-col gap-5">
              <div className="flex items-center gap-4">
                <Avatar name={user.name} size="lg" />
                <div className="min-w-0">
                  <p className="truncate text-h6 font-medium text-ink">{user.name}</p>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-body">
                <dt className="text-small text-ink-muted">Perfil</dt>
                <dd className="text-ink">{user.role.name}</dd>
                <dt className="text-small text-ink-muted">Cadastro</dt>
                <dd className="text-ink">
                  {formatDateTime(user.createdAt)}
                  {user.createdBy && (
                    <span className="block text-small text-ink-muted">por {user.createdBy.name}</span>
                  )}
                </dd>
                <dt className="text-small text-ink-muted">Último acesso</dt>
                <dd className="text-ink">{formatDateTime(user.lastLoginAt)}</dd>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Acesso" subtitle="Convite, senha e status da conta" />
            <CardBody className="flex flex-col items-start gap-3">
              {user.status === "INVITED" && (
                <>
                  <p className="text-small text-ink-soft">
                    A pessoa ainda não definiu a senha. Gere um novo link se o anterior expirou.
                  </p>
                  <LinkGeneratorButton
                    action={generateInviteAction.bind(null, user.id)}
                    label="Gerar link de convite"
                    icon={<IconMailForward />}
                    title="Link de convite"
                    instructions={
                      <>Envie este link para {user.name}. Com ele, a pessoa define a senha e ativa a conta.</>
                    }
                  />
                </>
              )}
              {user.status === "ACTIVE" && !isSelf && (
                <LinkGeneratorButton
                  action={generateResetAction.bind(null, user.id)}
                  label="Gerar link de redefinição de senha"
                  icon={<IconKey />}
                  title="Link de redefinição de senha"
                  instructions={
                    <>
                      Envie este link para {user.name}. A senha atual continua valendo até o link ser
                      usado; ao usá-lo, as sessões abertas são encerradas.
                    </>
                  }
                />
              )}
              {user.status !== "INACTIVE" && !isSelf && (
                <ConfirmActionButton
                  action={deactivateUserAction.bind(null, user.id)}
                  label="Desativar conta"
                  icon={<IconUserOff />}
                  variant="danger-tonal"
                  title="Desativar conta?"
                  description={
                    <>
                      {user.name} perde o acesso imediatamente e as sessões abertas são encerradas.
                      O histórico é preservado e a conta pode ser reativada depois.
                    </>
                  }
                  confirmLabel="Desativar"
                  confirmVariant="danger"
                  successMessage="Conta desativada."
                />
              )}
              {user.status === "INACTIVE" && (
                <ConfirmActionButton
                  action={reactivateUserAction.bind(null, user.id)}
                  label="Reativar conta"
                  icon={<IconUserCheck />}
                  title="Reativar conta?"
                  description={
                    <>
                      {user.name} volta a ter acesso com os mesmos dados e histórico. Se a pessoa
                      nunca definiu senha, a conta volta para convite pendente.
                    </>
                  }
                  confirmLabel="Reativar"
                  successMessage="Conta reativada."
                />
              )}
              {isSelf && (
                <p className="text-small text-ink-muted">
                  Para trocar a sua senha, use a página Minha conta.
                </p>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="flex flex-col gap-6 xl:col-span-8">
          <Card>
            <CardHeader title="Dados cadastrais" />
            <CardBody>
              <UserForm
                mode="edit"
                action={updateUserAction.bind(null, user.id)}
                departments={departments}
                roleLocked={isSelf}
                defaultValues={{
                  name: user.name,
                  email: user.email,
                  username: user.username,
                  department: user.department ?? "",
                  jobTitle: user.jobTitle ?? "",
                  hireDate: toDateInputValue(user.hireDate),
                  roleKey: user.role.key,
                }}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader
              title="Grupos"
              subtitle="Usados para atribuir trilhas a várias pessoas de uma vez"
            />
            <CardBody>
              <UserGroupsForm
                action={setUserGroupsAction.bind(null, user.id)}
                groups={groups}
                selected={user.groups.map((g) => g.group.id)}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
