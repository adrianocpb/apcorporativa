import type { Metadata } from "next";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/auth/permissions";
import { listDepartments } from "@/server/services/users";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { UserForm } from "../user-form";
import { createUserAction } from "../actions";

export const metadata: Metadata = { title: "Novo usuário" };

export default async function NewUserPage() {
  const actor = await requirePermission(PERMISSIONS.USUARIOS_GERENCIAR);
  const departments = await listDepartments(db, actor);
  return (
    <>
      <PageHeader
        title="Novo usuário"
        description="A conta é criada sem senha. Você recebe um link de convite para enviar à pessoa."
        back={{ href: "/admin/usuarios", label: "Usuários" }}
      />
      <Card className="max-w-3xl">
        <CardBody>
          <UserForm mode="create" action={createUserAction} departments={departments} />
        </CardBody>
      </Card>
    </>
  );
}
