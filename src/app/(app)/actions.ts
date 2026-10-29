"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { runAction, type ActionState } from "@/server/actions";
import { clearSessionCookie, getRequestMeta, requireSession } from "@/server/auth/current-user";
import { SESSION_COOKIE, invalidateSessionToken } from "@/server/auth/sessions";
import { changeOwnPassword } from "@/server/services/auth";
import { AppError } from "@/server/errors";
import { formToObject, parseInput } from "@/server/validation";
import { newPasswordSchema } from "@/lib/validation/users";

export async function logoutAction() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await invalidateSessionToken(db, token);
  await clearSessionCookie();
  redirect("/entrar");
}

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const session = await requireSession();
    const data = formToObject(formData);
    const { password } = parseInput(newPasswordSchema, data);
    if (!data.currentPassword) {
      throw new AppError("Informe a senha atual.", { currentPassword: "Informe a senha atual." });
    }
    await changeOwnPassword(
      db,
      session.user,
      session.sessionId,
      { currentPassword: data.currentPassword, password },
      await getRequestMeta(),
    );
    return { message: "Senha alterada. As sessões em outros dispositivos foram encerradas." };
  });
}
