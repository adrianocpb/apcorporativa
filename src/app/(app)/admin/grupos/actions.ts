"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { runAction, setFlash, type ActionState } from "@/server/actions";
import { getRequestMeta, requireUser } from "@/server/auth/current-user";
import { formToObject } from "@/server/validation";
import {
  addGroupMembers,
  createGroup,
  deleteGroup,
  removeGroupMember,
  updateGroup,
} from "@/server/services/groups";

export async function createGroupAction(_prev: ActionState<{ id: string }>, formData: FormData) {
  return runAction(async () => {
    const actor = await requireUser();
    const group = await createGroup(db, actor, formToObject(formData), await getRequestMeta());
    revalidatePath("/admin", "layout");
    return { data: { id: group.id } };
  });
}

export async function updateGroupAction(id: string, _prev: ActionState, formData: FormData) {
  return runAction(async () => {
    const actor = await requireUser();
    await updateGroup(db, actor, id, formToObject(formData), await getRequestMeta());
    revalidatePath("/admin", "layout");
    return { message: "Grupo salvo." };
  });
}

export async function deleteGroupAction(id: string, _prev: ActionState) {
  const state = await runAction(async () => {
    const actor = await requireUser();
    await deleteGroup(db, actor, id, await getRequestMeta());
    await setFlash("Grupo excluído.");
  });
  if (state.ok) redirect("/admin/grupos");
  return state;
}

export async function addMembersAction(groupId: string, _prev: ActionState, formData: FormData) {
  return runAction(async () => {
    const actor = await requireUser();
    const userIds = formData.getAll("userIds").filter((v): v is string => typeof v === "string");
    const count = await addGroupMembers(db, actor, groupId, userIds, await getRequestMeta());
    revalidatePath("/admin", "layout");
    return { message: count === 1 ? "1 membro adicionado." : `${count} membros adicionados.` };
  });
}

export async function removeMemberAction(groupId: string, userId: string, _prev: ActionState) {
  return runAction(async () => {
    const actor = await requireUser();
    await removeGroupMember(db, actor, groupId, userId, await getRequestMeta());
    revalidatePath("/admin", "layout");
  });
}
