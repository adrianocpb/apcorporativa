"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { runAction, setFlash, type ActionState } from "@/server/actions";
import { getRequestMeta, requireUser } from "@/server/auth/current-user";
import { formToObject } from "@/server/validation";
import {
  addItems,
  addModule,
  assignTrack,
  createTrack,
  deleteModule,
  removeAssignment,
  removeItem,
  reorderTrack,
  setTrackStatus,
  updateItem,
  updateModule,
  updateTrack,
} from "@/server/services/tracks";

const ids = (formData: FormData, name: string) =>
  formData.getAll(name).filter((v): v is string => typeof v === "string");

function refresh(trackId?: string) {
  revalidatePath("/admin", "layout");
  if (trackId) revalidatePath(`/trilhas/${trackId}`, "layout");
}

export async function createTrackAction(_prev: ActionState, formData: FormData) {
  let id = "";
  const state = await runAction(async () => {
    const actor = await requireUser();
    const track = await createTrack(db, actor, formToObject(formData), await getRequestMeta());
    id = track.id;
    await setFlash("Trilha criada. Agora monte as etapas e adicione os conteúdos.");
  });
  if (state.ok) redirect(`/admin/trilhas/${id}`);
  return state;
}

export async function updateTrackAction(trackId: string, _prev: ActionState, formData: FormData) {
  return runAction(async () => {
    const actor = await requireUser();
    await updateTrack(db, actor, trackId, formToObject(formData), await getRequestMeta());
    refresh(trackId);
    return { message: "Configurações salvas." };
  });
}

export async function trackStatusAction(trackId: string, action: "publish" | "archive" | "restore", _prev: ActionState) {
  return runAction(async () => {
    const actor = await requireUser();
    await setTrackStatus(db, actor, trackId, action, await getRequestMeta());
    refresh(trackId);
  });
}

export async function addModuleAction(trackId: string, _prev: ActionState, formData: FormData) {
  return runAction(async () => {
    const actor = await requireUser();
    await addModule(db, actor, trackId, formToObject(formData), await getRequestMeta());
    refresh(trackId);
    return { message: "Etapa criada." };
  });
}

export async function updateModuleAction(trackId: string, moduleId: string, _prev: ActionState, formData: FormData) {
  return runAction(async () => {
    const actor = await requireUser();
    await updateModule(db, actor, moduleId, formToObject(formData), await getRequestMeta());
    refresh(trackId);
    return { message: "Etapa salva." };
  });
}

export async function deleteModuleAction(trackId: string, moduleId: string, _prev: ActionState) {
  return runAction(async () => {
    const actor = await requireUser();
    await deleteModule(db, actor, moduleId, await getRequestMeta());
    refresh(trackId);
  });
}

export async function addItemsAction(trackId: string, moduleId: string, _prev: ActionState, formData: FormData) {
  return runAction(async () => {
    const actor = await requireUser();
    await addItems(db, actor, moduleId, ids(formData, "contentIds"), await getRequestMeta());
    refresh(trackId);
    return { message: "Conteúdos adicionados." };
  });
}

export async function updateItemAction(
  trackId: string,
  itemId: string,
  input: { required: boolean; completionRule: string },
) {
  return runAction(async () => {
    const actor = await requireUser();
    await updateItem(db, actor, itemId, input, await getRequestMeta());
    refresh(trackId);
  });
}

export async function removeItemAction(trackId: string, itemId: string, _prev: ActionState) {
  return runAction(async () => {
    const actor = await requireUser();
    await removeItem(db, actor, itemId, await getRequestMeta());
    refresh(trackId);
  });
}

export async function reorderTrackAction(trackId: string, structure: { moduleId: string; itemIds: string[] }[]) {
  return runAction(async () => {
    const actor = await requireUser();
    await reorderTrack(db, actor, trackId, structure, await getRequestMeta());
    refresh(trackId);
  });
}

export async function assignTrackAction(trackId: string, _prev: ActionState, formData: FormData) {
  return runAction(async () => {
    const actor = await requireUser();
    const count = await assignTrack(
      db,
      actor,
      trackId,
      { userIds: ids(formData, "userIds"), groupIds: ids(formData, "groupIds") },
      await getRequestMeta(),
    );
    refresh(trackId);
    return { message: count === 1 ? "Atribuição feita." : `${count} atribuições feitas.` };
  });
}

export async function removeAssignmentAction(trackId: string, assignmentId: string, _prev: ActionState) {
  return runAction(async () => {
    const actor = await requireUser();
    await removeAssignment(db, actor, assignmentId, await getRequestMeta());
    refresh(trackId);
  });
}
