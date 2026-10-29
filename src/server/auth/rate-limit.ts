import type { Db } from "@/server/db";

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const MAX_FAILURES_PER_IDENTIFIER = 5;
export const MAX_FAILURES_PER_IP = 20;

export async function isLoginBlocked(db: Db, identifier: string, ip?: string | null) {
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const byIdentifier = await db.loginAttempt.count({
    where: { identifier, success: false, createdAt: { gte: since } },
  });
  if (byIdentifier >= MAX_FAILURES_PER_IDENTIFIER) return true;
  if (ip) {
    const byIp = await db.loginAttempt.count({
      where: { ip, success: false, createdAt: { gte: since } },
    });
    if (byIp >= MAX_FAILURES_PER_IP) return true;
  }
  return false;
}

export async function recordLoginAttempt(
  db: Db,
  identifier: string,
  ip: string | null | undefined,
  success: boolean,
) {
  await db.loginAttempt.create({ data: { identifier, ip: ip ?? null, success } });
  if (success) {
    // Login correto zera o contador daquele identificador.
    await db.loginAttempt.deleteMany({ where: { identifier, success: false } });
  }
}
