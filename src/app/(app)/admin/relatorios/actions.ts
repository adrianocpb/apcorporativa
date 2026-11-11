"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { runAction, type ActionState } from "@/server/actions";
import { getRequestMeta, requireUser } from "@/server/auth/current-user";
import { releaseQuizAttempts } from "@/server/services/quiz";

export async function releaseQuizAttemptsAction(userId: string, contentId: string, _prev: ActionState) {
  return runAction(async () => {
    const actor = await requireUser();
    await releaseQuizAttempts(db, actor, userId, contentId, await getRequestMeta());
    revalidatePath("/", "layout");
  });
}
