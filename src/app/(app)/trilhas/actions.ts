"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { runAction } from "@/server/actions";
import { requireUser } from "@/server/auth/current-user";
import { confirmCompletion, openItem, type CompletionEvents } from "@/server/services/learning";
import { submitQuizAttempt, type QuizSubmitResult } from "@/server/services/quiz";

/** Registra a abertura do conteúdo (chamada pela página ao montar, não por pré-carregamento). */
export async function openItemAction(trackId: string, itemId: string) {
  return runAction<{ events: CompletionEvents | null }>(async () => {
    const user = await requireUser();
    const events = await openItem(db, user, trackId, itemId);
    if (events) revalidatePath("/", "layout");
    return { data: { events } };
  });
}

export async function confirmItemAction(trackId: string, itemId: string) {
  return runAction<{ events: CompletionEvents }>(async () => {
    const user = await requireUser();
    const events = await confirmCompletion(db, user, trackId, itemId);
    revalidatePath("/", "layout");
    return { data: { events } };
  });
}

/** Envia as respostas do quiz. A correção acontece no servidor. */
export async function submitQuizAction(trackId: string, itemId: string, answers: Record<string, string[]>) {
  return runAction<QuizSubmitResult>(async () => {
    const user = await requireUser();
    const result = await submitQuizAttempt(db, user, trackId, itemId, answers);
    revalidatePath("/", "layout");
    return { data: result };
  });
}
