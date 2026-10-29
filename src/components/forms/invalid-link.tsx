import { IconLinkOff } from "@tabler/icons-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

export function InvalidLink() {
  return (
    <EmptyState
      className="py-4"
      icon={<IconLinkOff />}
      title="Link indisponível"
      description="Este link é inválido, já foi usado ou expirou. Peça um novo ao administrador da plataforma."
      action={
        <ButtonLink href="/entrar" variant="tonal">
          Ir para o login
        </ButtonLink>
      }
    />
  );
}
