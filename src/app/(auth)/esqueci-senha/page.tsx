import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Esqueci minha senha" };

// Sem envio de e-mail nesta versão: o administrador gera um link de redefinição de uso único.
export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-h5 font-medium text-ink">Esqueci minha senha</h1>
      <div className="mt-2 flex flex-col gap-3 text-body text-ink-soft">
        <p>Peça a um administrador da plataforma um link de redefinição de senha.</p>
        <p>
          O link é pessoal, vale por 24 horas e só pode ser usado uma vez. Ao abri-lo, você
          escolhe a nova senha e as sessões abertas em outros dispositivos são encerradas.
        </p>
      </div>
      <ButtonLink href="/entrar" variant="tonal" className="mt-6 w-full">
        Voltar para o login
      </ButtonLink>
    </>
  );
}
