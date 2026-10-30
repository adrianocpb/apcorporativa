import type { Db } from "@/server/db";
import type { PermissionKey, RoleKey } from "@/server/auth/permissions";
import { generateToken, hashToken } from "@/server/auth/tokens";

export const SESSION_COOKIE = "apc_session";
export const SESSION_IDLE_MS = 8 * 60 * 60 * 1000; // 8h sem atividade encerra a sessão
export const SESSION_ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias no máximo
const SESSION_REFRESH_MS = 5 * 60 * 1000; // evita uma escrita a cada requisição

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  department: string | null;
  roleKey: RoleKey;
  roleName: string;
  permissions: PermissionKey[];
};

export type ValidSession = { sessionId: string; expiresAt: Date; user: SessionUser };

export type RequestMeta = { ip?: string | null; userAgent?: string | null };

export async function createSession(db: Db, userId: string, meta: RequestMeta = {}) {
  const token = generateToken();
  const now = Date.now();
  const absoluteExpiresAt = new Date(now + SESSION_ABSOLUTE_MS);
  await db.session.create({
    data: {
      id: hashToken(token),
      userId,
      expiresAt: new Date(now + SESSION_IDLE_MS),
      absoluteExpiresAt,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent?.slice(0, 255) ?? null,
    },
  });
  return { token, cookieExpiresAt: absoluteExpiresAt };
}

export async function validateSessionToken(db: Db, token: string): Promise<ValidSession | null> {
  const sessionId = hashToken(token);
  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: {
      user: {
        include: { role: { include: { permissions: { include: { permission: true } } } } },
      },
    },
  });
  if (!session) return null;

  const now = Date.now();
  if (now >= session.expiresAt.getTime() || now >= session.absoluteExpiresAt.getTime()) {
    await db.session.deleteMany({ where: { id: sessionId } });
    return null;
  }
  // Usuário desativado perde o acesso imediatamente, mesmo com sessão aberta.
  if (session.user.status !== "ACTIVE") {
    await db.session.deleteMany({ where: { userId: session.userId } });
    return null;
  }

  let expiresAt = session.expiresAt;
  if (now - session.lastSeenAt.getTime() > SESSION_REFRESH_MS) {
    expiresAt = new Date(Math.min(now + SESSION_IDLE_MS, session.absoluteExpiresAt.getTime()));
    await db.session.update({
      where: { id: sessionId },
      data: { expiresAt, lastSeenAt: new Date(now) },
    });
  }

  const { user } = session;
  return {
    sessionId,
    expiresAt,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      department: user.department,
      roleKey: user.role.key as RoleKey,
      roleName: user.role.name,
      permissions: user.role.permissions.map((rp) => rp.permission.key as PermissionKey),
    },
  };
}

export async function invalidateSessionToken(db: Db, token: string) {
  await db.session.deleteMany({ where: { id: hashToken(token) } });
}

export async function invalidateUserSessions(db: Db, userId: string, exceptSessionId?: string) {
  await db.session.deleteMany({
    where: { userId, ...(exceptSessionId ? { NOT: { id: exceptSessionId } } : {}) },
  });
}
