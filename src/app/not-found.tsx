import { IconMapOff } from "@tabler/icons-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <EmptyState
        icon={<IconMapOff />}
        title="Página não encontrada"
        description="O endereço pode ter mudado ou o registro não existe mais."
        action={<ButtonLink href="/">Voltar ao painel</ButtonLink>}
      />
    </main>
  );
}
