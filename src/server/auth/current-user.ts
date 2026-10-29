import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { hasPermission, type PermissionKey } from "@/server/auth/permissions";
import {
  SESSION_COOKIE,
  validateSessionToken,
  type RequestMeta,
  type ValidSession,
} from "@/server/auth/sessions";

/** Sessão da requisição atual (validada no banco uma vez por requisição). */
export const getCurrentSession = cache(async (): Promise<ValidSession | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return validateSessionToken(db, token);
});

export async function getCurrentUser() {
  return (await getCurrentSession())?.user ?? null;
}

/** Usado em páginas, layouts e actions: sem sessão válida, vai para o login. */
export async function requireSession(): Promise<ValidSession> {
  const session = await getCurrentSession();
  if (!session) redirect("/entrar");
  return session;
}

export async function requireUser() {
  return (await requireSession()).user;
}

export async function requirePermission(permission: PermissionKey) {
  const user = await requireUser();
  if (!hasPermission(user, permission)) redirect("/acesso-negado");
  return user;
}

export async function getRequestMeta(): Promise<RequestMeta> {
  const h = await headers();
  // Atrás de proxy reverso, configure-o para sobrescrever X-Forwarded-For (ver docs/SEGURANCA.md).
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ip: forwarded || h.get("x-real-ip") || null,
    userAgent: h.get("user-agent"),
  };
}

export async function setSessionCookie(token: string, expires: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}
