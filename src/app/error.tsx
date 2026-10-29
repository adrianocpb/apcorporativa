"use client";

import { IconAlertTriangle } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

// Erros inesperados: mensagem compreensível, sem detalhes internos.
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-[60vh] items-center justify-center p-4">
      <EmptyState
        icon={<IconAlertTriangle />}
        title="Algo deu errado"
        description="Não foi possível carregar esta página. Tente novamente; se o problema continuar, avise o administrador."
        action={<Button onClick={reset}>Tentar novamente</Button>}
      />
    </main>
  );
}
