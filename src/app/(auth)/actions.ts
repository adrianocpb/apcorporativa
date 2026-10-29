"use server";

import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { runAction, setFlash, type ActionState } from "@/server/actions";
import { AppError } from "@/server/errors";
import { getRequestMeta, setSessionCookie } from "@/server/auth/current-user";
import { acceptInvite, login, resetPassword } from "@/server/services/auth";
import { loginSchema, newPasswordSchema } from "@/lib/validation/users";
import { formToObject, parseInput } from "@/server/validation";

/** Aceita apenas caminhos internos para evitar redirecionamento aberto. */
function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let destination = "/";
  const state = await runAction(async () => {
    const input = parseInput(loginSchema, formToObject(formData));
    const result = await login(db, input, await getRequestMeta());
    if (!result.ok) throw new AppError(result.error);
    await setSessionCookie(result.token, result.cookieExpiresAt);
    destination = safeNext(formData.get("next"));
  });
  if (state.ok) redirect(destination);
  return state;
}

export async function acceptInviteAction(
  token: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const state = await runAction(async () => {
    const { password } = parseInput(newPasswordSchema, formToObject(formData));
    const session = await acceptInvite(db, { token, password }, await getRequestMeta());
    await setSessionCookie(session.token, session.cookieExpiresAt);
    await setFlash("Senha definida. Boas-vindas!");
  });
  if (state.ok) redirect("/");
  return state;
}

export async function resetPasswordAction(
  token: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const state = await runAction(async () => {
    const { password } = parseInput(newPasswordSchema, formToObject(formData));
    await resetPassword(db, { token, password }, await getRequestMeta());
    await setFlash("Senha redefinida. Entre com a nova senha.");
  });
  if (state.ok) redirect("/entrar");
  return state;
}
