"use client";

import { IconStar, IconStarFilled } from "@tabler/icons-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { recordViewAction, setFavoriteAction } from "@/app/(app)/biblioteca/actions";

export function FavoriteButton({ contentId, initial }: { contentId: string; initial: boolean }) {
  const [favorite, setFavorite] = useState(initial);
  const [pending, startTransition] = useTransition();
  function toggle() {
    const next = !favorite;
    setFavorite(next);
    startTransition(async () => {
      const r = await setFavoriteAction(contentId, next);
      if (!r.ok) {
        setFavorite(!next);
        toast(r.message ?? "Não foi possível atualizar os favoritos.", "danger");
      } else toast(next ? "Adicionado aos favoritos." : "Removido dos favoritos.");
    });
  }
  return (
    <Button
      variant="tonal"
      onClick={toggle}
      loading={pending}
      aria-pressed={favorite}
      icon={favorite ? <IconStarFilled className="text-warning" /> : <IconStar />}
    >
      {favorite ? "Favorito" : "Favoritar"}
    </Button>
  );
}

/** Registra um acesso ao abrir a página (uma vez por montagem). */
export function ViewRecorder({ contentId }: { contentId: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void recordViewAction(contentId);
  }, [contentId]);
  return null;
}
