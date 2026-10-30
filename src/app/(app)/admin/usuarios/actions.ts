"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { runAction, type ActionState } from "@/server/actions";
import { getRequestMeta, requireUser } from "@/server/auth/current-user";
import { formToObject } from "@/server/validation";
import {
  createUser,
  deactivateUser,
  generateInviteLink,
  generatePasswordResetLink,
  reactivateUser,
  setUserGroups,
  updateUser,
} from "@/server/services/users";
import { formatDateTime } from "@/lib/format";

// Cada action reautentica o usuário e o serviço valida a permissão: chamar a action
// diretamente (sem a interface) não contorna nenhuma regra.

export async function createUserAction(
  _prev: ActionState<{ userId: string; name: string; url: string; expiresAt: string }>,
  formData: FormData,
) {
  return runAction(async () => {
    const actor = await requireUser();
    const groupIds = formData.getAll("groupIds").filter((v): v is string => typeof v === "string");
    const { user, invite } = await createUser(
      db,
      actor,
      { ...formToObject(formData), groupIds },
      await getRequestMeta(),
    );
    revalidatePath("/admin", "layout");
    return {
      data: {
        userId: user.id,
        name: user.name,
        url: invite.url,
        expiresAt: formatDateTime(invite.expiresAt),
      },
    };
  });
}

export async function updateUserAction(id: string, _prev: ActionState, formData: FormData) {
  return runAction(async () => {
    const actor = await requireUser();
    await updateUser(db, actor, id, formToObject(formData), await getRequestMeta());
    revalidatePath("/admin", "layout");
    return { message: "Dados do usuário salvos." };
  });
}

export async function deactivateUserAction(id: string, _prev: ActionState) {
  return runAction(async () => {
    const actor = await requireUser();
    await deactivateUser(db, actor, id, await getRequestMeta());
    revalidatePath("/admin", "layout");
  });
}

export async function reactivateUserAction(id: string, _prev: ActionState) {
  return runAction(async () => {
    const actor = await requireUser();
    await reactivateUser(db, actor, id, await getRequestMeta());
    revalidatePath("/admin", "layout");
  });
}

export async function generateInviteAction(
  id: string,
  _prev: ActionState<{ url: string; expiresAt: string }>,
) {
  return runAction(async () => {
    const actor = await requireUser();
    const link = await generateInviteLink(db, actor, id, await getRequestMeta());
    return { data: { url: link.url, expiresAt: formatDateTime(link.expiresAt) } };
  });
}

export async function generateResetAction(
  id: string,
  _prev: ActionState<{ url: string; expiresAt: string }>,
) {
  return runAction(async () => {
    const actor = await requireUser();
    const link = await generatePasswordResetLink(db, actor, id, await getRequestMeta());
    return { data: { url: link.url, expiresAt: formatDateTime(link.expiresAt) } };
  });
}

export async function setUserGroupsAction(id: string, _prev: ActionState, formData: FormData) {
  return runAction(async () => {
    const actor = await requireUser();
    const groupIds = formData.getAll("groupIds").filter((v): v is string => typeof v === "string");
    await setUserGroups(db, actor, id, groupIds, await getRequestMeta());
    revalidatePath("/admin", "layout");
    return { message: "Grupos atualizados." };
  });
}
