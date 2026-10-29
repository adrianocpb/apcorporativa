import "server-only";
import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { AppError } from "@/server/errors";

export type ActionState<T = undefined> = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  data?: T;
  /** Muda a cada envio para que a interface reaja mesmo com o mesmo resultado. */
  at?: number;
};

const GENERIC_ERROR = "Não foi possível concluir a operação. Tente novamente.";

/**
 * Executa a lógica de uma Server Action convertendo erros em estado para o formulário.
 * Erros inesperados são registrados no servidor e nunca expostos ao usuário.
 */
export async function runAction<T = undefined>(
  fn: () => Promise<ActionState<T> | void>,
): Promise<ActionState<T>> {
  try {
    return { ok: true, ...(await fn()), at: Date.now() };
  } catch (error) {
    unstable_rethrow(error); // redirect()/notFound() seguem o fluxo normal do Next
    if (error instanceof AppError) {
      return { ok: false, message: error.message, fieldErrors: error.fieldErrors, at: Date.now() };
    }
    console.error("[action]", error);
    return { ok: false, message: GENERIC_ERROR, at: Date.now() };
  }
}

export const FLASH_COOKIE = "apc_flash";

/** Mensagem exibida como notificação na próxima página (sobrevive a redirect). */
export async function setFlash(message: string, tone: "success" | "danger" = "success") {
  (await cookies()).set(FLASH_COOKIE, JSON.stringify({ message, tone }), {
    path: "/",
    maxAge: 30,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
