"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { runAction, type ActionState } from "@/server/actions";
import { getRequestMeta, requireUser } from "@/server/auth/current-user";
import { formToObject } from "@/server/validation";
import {
  adjustPoints,
  deleteLevel,
  saveAchievement,
  saveLevel,
  updatePointRules,
} from "@/server/services/gamification";

function refresh() {
  revalidatePath("/", "layout");
}

export async function updateRulesAction(_prev: ActionState, formData: FormData) {
  return runAction(async () => {
    const actor = await requireUser();
    await updatePointRules(db, actor, formToObject(formData), await getRequestMeta());
    refresh();
    return { message: "Regras de pontuação salvas. Valem para as próximas conclusões." };
  });
}

export async function saveLevelAction(id: string | null, _prev: ActionState, formData: FormData) {
  return runAction(async () => {
    const actor = await requireUser();
    await saveLevel(db, actor, id, formToObject(formData), await getRequestMeta());
    refresh();
    return { message: id ? "Nível salvo." : "Nível criado." };
  });
}

export async function deleteLevelAction(id: string, _prev: ActionState) {
  return runAction(async () => {
    const actor = await requireUser();
    await deleteLevel(db, actor, id, await getRequestMeta());
    refresh();
  });
}

export async function saveAchievementAction(id: string | null, _prev: ActionState, formData: FormData) {
  return runAction(async () => {
    const actor = await requireUser();
    await saveAchievement(db, actor, id, formToObject(formData), await getRequestMeta());
    refresh();
    return { message: id ? "Conquista salva." : "Conquista criada." };
  });
}

export async function adjustPointsAction(_prev: ActionState, formData: FormData) {
  return runAction(async () => {
    const actor = await requireUser();
    await adjustPoints(db, actor, formToObject(formData), await getRequestMeta());
    refresh();
    return { message: "Ajuste registrado." };
  });
}
