import type { Metadata } from "next";
import { requireUser } from "@/server/auth/current-user";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/feedback";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Minha conta" };

export default async function MyAccountPage() {
  const user = await requireUser();
  const rows: [string, string | null][] = [
    ["E-mail", user.email],
    ["Área", user.department],
    ["Perfil", user.roleName],
  ];
  return (
    <>
      <PageHeader title="Minha conta" description="Seus dados e sua senha de acesso." />
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardBody className="flex flex-col gap-5">
            <div className="flex items-center gap-4">
              <Avatar name={user.name} size="lg" />
              <div className="min-w-0">
                <p className="text-h5 font-medium text-ink">{user.name}</p>
                <p className="truncate text-small text-ink-muted">{user.email}</p>
              </div>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
              {rows.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-small text-ink-muted">{label}</dt>
                  <dd className="text-body text-ink">{value || "—"}</dd>
                </div>
              ))}
            </dl>
            <p className="text-small text-ink-muted">
              Para corrigir seus dados cadastrais, fale com um administrador.
            </p>
          </CardBody>
        </Card>
        <Card className="lg:col-span-7">
          <CardHeader title="Alterar senha" subtitle="As sessões em outros dispositivos serão encerradas." />
          <CardBody>
            <ChangePasswordForm email={user.email} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
