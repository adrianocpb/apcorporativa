"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { runAction, type ActionState } from "@/server/actions";
import { getRequestMeta, requireUser } from "@/server/auth/current-user";
import { formToObject } from "@/server/validation";
import {
  createCategory,
  moveCategory,
  setCategoryArchived,
  updateCategory,
} from "@/server/services/categories";

export async function createCategoryAction(_prev: ActionState, formData: FormData) {
  return runAction(async () => {
    const actor = await requireUser();
    await createCategory(db, actor, formToObject(formData), await getRequestMeta());
    revalidatePath("/admin", "layout");
    return { message: "Categoria criada." };
  });
}

export async function updateCategoryAction(id: string, _prev: ActionState, formData: FormData) {
  return runAction(async () => {
    const actor = await requireUser();
    await updateCategory(db, actor, id, formToObject(formData), await getRequestMeta());
    revalidatePath("/admin", "layout");
    return { message: "Categoria salva." };
  });
}

export async function moveCategoryAction(id: string, direction: "up" | "down") {
  const actor = await requireUser();
  await moveCategory(db, actor, id, direction, await getRequestMeta());
  revalidatePath("/admin/categorias");
}

export async function archiveCategoryAction(id: string, archived: boolean, _prev: ActionState) {
  return runAction(async () => {
    const actor = await requireUser();
    await setCategoryArchived(db, actor, id, archived, await getRequestMeta());
    revalidatePath("/admin", "layout");
  });
}
