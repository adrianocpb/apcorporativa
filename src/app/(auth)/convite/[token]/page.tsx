import type { Metadata } from "next";
import { db } from "@/server/db";
import { findUsableToken } from "@/server/services/auth";
import { NewPasswordForm } from "@/components/forms/new-password-form";
import { InvalidLink } from "@/components/forms/invalid-link";
import { firstName } from "@/lib/format";
import { acceptInviteAction } from "../../actions";

export const metadata: Metadata = { title: "Ativar conta" };

export default async function InvitePage({ params }: PageProps<"/convite/[token]">) {
  const { token } = await params;
  const record = await findUsableToken(db, token, "INVITE");
  if (!record) return <InvalidLink />;
  return (
    <>
      <h1 className="text-h5 font-medium text-ink">Olá, {firstName(record.user.name)}!</h1>
      <p className="mb-6 text-body text-ink-soft">
        Defina sua senha para ativar a conta. Seu login é{" "}
        <strong className="font-medium text-ink">{record.user.username}</strong> (ou o e-mail{" "}
        {record.user.email}).
      </p>
      <NewPasswordForm
        action={acceptInviteAction.bind(null, token)}
        submitLabel="Ativar conta"
        username={record.user.username}
      />
    </>
  );
}
