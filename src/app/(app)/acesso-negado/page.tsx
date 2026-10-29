import type { Metadata } from "next";
import { IconLock } from "@tabler/icons-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Acesso negado" };

export default function AccessDeniedPage() {
  return (
    <Card>
      <EmptyState
        icon={<IconLock />}
        title="Você não tem acesso a esta área"
        description="Se precisar deste acesso para o seu trabalho, fale com um administrador da plataforma."
        action={<ButtonLink href="/">Voltar ao painel</ButtonLink>}
      />
    </Card>
  );
}
