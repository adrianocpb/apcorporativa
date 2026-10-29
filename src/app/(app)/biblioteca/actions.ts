"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { runAction } from "@/server/actions";
import { requireUser } from "@/server/auth/current-user";
import { recordView, setFavorite } from "@/server/services/library";

/** Registra o acesso (chamado pela página no navegador, não por pré-carregamento). */
export async function recordViewAction(contentId: string) {
  return runAction(async () => {
    const user = await requireUser();
    await recordView(db, user, contentId);
  });
}

export async function setFavoriteAction(contentId: string, favorite: boolean) {
  return runAction(async () => {
    const user = await requireUser();
    await setFavorite(db, user, contentId, favorite);
    revalidatePath("/biblioteca", "layout");
  });
}
