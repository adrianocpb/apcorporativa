import type { Metadata } from "next";
import { db } from "@/server/db";
import { findUsableToken } from "@/server/services/auth";
import { NewPasswordForm } from "@/components/forms/new-password-form";
import { InvalidLink } from "@/components/forms/invalid-link";
import { resetPasswordAction } from "../../actions";

export const metadata: Metadata = { title: "Redefinir senha" };

export default async function ResetPasswordPage({ params }: PageProps<"/redefinir-senha/[token]">) {
  const { token } = await params;
  const record = await findUsableToken(db, token, "PASSWORD_RESET");
  if (!record) return <InvalidLink />;
  return (
    <>
      <h1 className="text-h5 font-medium text-ink">Redefinir senha</h1>
      <p className="mb-6 text-body text-ink-soft">
        Escolha uma nova senha para <strong className="font-medium text-ink">{record.user.email}</strong>.
        As sessões abertas em outros dispositivos serão encerradas.
      </p>
      <NewPasswordForm
        action={resetPasswordAction.bind(null, token)}
        submitLabel="Salvar nova senha"
        email={record.user.email}
      />
    </>
  );
}
