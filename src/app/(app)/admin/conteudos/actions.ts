"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { runAction, setFlash, type ActionState } from "@/server/actions";
import { AppError } from "@/server/errors";
import { getRequestMeta, requireUser } from "@/server/auth/current-user";
import { formToObject } from "@/server/validation";
import {
  createContent,
  deleteUnpublishedContent,
  discardDraft,
  publishContent,
  saveDraft,
  setContentArchived,
} from "@/server/services/contents";

type Intent = "save" | "publish" | "preview";

function intentOf(formData: FormData): Intent {
  const v = formData.get("intent");
  return v === "publish" || v === "preview" ? v : "save";
}

async function publishAfterSave(actor: Awaited<ReturnType<typeof requireUser>>, id: string, fields: Record<string, string>) {
  try {
    await publishContent(db, actor, id, fields, await getRequestMeta());
  } catch (error) {
    if (error instanceof AppError) {
      throw new AppError(`Rascunho salvo, mas não publicado: ${error.message}`);
    }
    throw error;
  }
}

export async function createContentAction(type: string, _prev: ActionState, formData: FormData) {
  const intent = intentOf(formData);
  let id = "";
  const state = await runAction(async () => {
    const actor = await requireUser();
    const fields = formToObject(formData);
    const content = await createContent(db, actor, type, fields, await getRequestMeta());
    id = content.id;
    if (intent === "publish") await publishAfterSave(actor, content.id, fields);
    await setFlash(intent === "publish" ? "Conteúdo publicado." : "Rascunho salvo.");
  });
  if (id) revalidatePath("/admin", "layout");
  if (!state.ok && id && state.message) await setFlash(state.message, "danger");
  // Mesmo que a publicação falhe, o rascunho foi criado: segue para a página de edição.
  if (state.ok || id) {
    redirect(intent === "preview" ? `/admin/conteudos/${id}/previa` : `/admin/conteudos/${id}`);
  }
  return state;
}

export async function saveContentAction(id: string, _prev: ActionState, formData: FormData) {
  const intent = intentOf(formData);
  const state = await runAction(async () => {
    const actor = await requireUser();
    const fields = formToObject(formData);
    await saveDraft(db, actor, id, fields, await getRequestMeta());
    if (intent === "publish") await publishAfterSave(actor, id, fields);
    revalidatePath("/admin", "layout");
    return { message: intent === "publish" ? "Conteúdo publicado." : "Rascunho salvo." };
  });
  if (state.ok && intent === "preview") redirect(`/admin/conteudos/${id}/previa`);
  if (!state.ok) revalidatePath("/admin", "layout");
  return state;
}

export async function archiveContentAction(id: string, archived: boolean, _prev: ActionState) {
  return runAction(async () => {
    const actor = await requireUser();
    await setContentArchived(db, actor, id, archived, await getRequestMeta());
    revalidatePath("/admin", "layout");
  });
}

export async function discardDraftAction(id: string, _prev: ActionState) {
  return runAction(async () => {
    const actor = await requireUser();
    await discardDraft(db, actor, id, await getRequestMeta());
    revalidatePath("/admin", "layout");
  });
}

export async function deleteContentAction(id: string, _prev: ActionState) {
  const state = await runAction(async () => {
    const actor = await requireUser();
    await deleteUnpublishedContent(db, actor, id, await getRequestMeta());
    await setFlash("Conteúdo excluído.");
  });
  if (state.ok) redirect("/admin/conteudos");
  return state;
}
