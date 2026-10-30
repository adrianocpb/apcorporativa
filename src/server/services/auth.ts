import type { AuthTokenType, Prisma } from "@/generated/prisma/client";
import type { Db } from "@/server/db";
import { AppError } from "@/server/errors";
import {
  checkPasswordPolicy,
  hashPassword,
  verifyAgainstDummy,
  verifyPassword,
} from "@/server/auth/password";
import { isLoginBlocked, recordLoginAttempt } from "@/server/auth/rate-limit";
import {
  createSession,
  invalidateUserSessions,
  type RequestMeta,
  type SessionUser,
} from "@/server/auth/sessions";
import { generateToken, hashToken } from "@/server/auth/tokens";
import { audit } from "@/server/services/audit";

export const TOKEN_TTL_MS: Record<AuthTokenType, number> = {
  INVITE: 72 * 60 * 60 * 1000,
  PASSWORD_RESET: 24 * 60 * 60 * 1000,
};

const TOKEN_PATH: Record<AuthTokenType, string> = {
  INVITE: "/convite",
  PASSWORD_RESET: "/redefinir-senha",
};

export function buildTokenUrl(type: AuthTokenType, token: string) {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${TOKEN_PATH[type]}/${token}`;
}

export type LoginResult =
  | { ok: true; token: string; cookieExpiresAt: Date }
  | { ok: false; error: string };

const INVALID_CREDENTIALS = "E-mail ou senha incorretos.";

export async function login(
  db: Db,
  input: { email: string; password: string },
  meta: RequestMeta = {},
): Promise<LoginResult> {
  const identifier = input.email.trim().toLowerCase();

  if (await isLoginBlocked(db, identifier, meta.ip)) {
    return {
      ok: false,
      error: "Muitas tentativas sem sucesso. Aguarde 15 minutos e tente novamente.",
    };
  }

  const user = await db.user.findFirst({
    where: { email: identifier },
  });

  const passwordOk = user?.passwordHash
    ? await verifyPassword(user.passwordHash, input.password)
    : await verifyAgainstDummy(input.password);

  if (!user || !passwordOk) {
    await recordLoginAttempt(db, identifier, meta.ip, false);
    return { ok: false, error: INVALID_CREDENTIALS };
  }
  if (user.status !== "ACTIVE") {
    await recordLoginAttempt(db, identifier, meta.ip, false);
    return { ok: false, error: "Sua conta está desativada. Procure o administrador." };
  }

  await recordLoginAttempt(db, identifier, meta.ip, true);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const session = await createSession(db, user.id, meta);
  return { ok: true, ...session };
}

/** Gera um novo link de uso único e invalida os anteriores do mesmo tipo. */
export async function issueAuthToken(
  tx: Prisma.TransactionClient | Db,
  params: { userId: string; type: AuthTokenType; createdById: string | null },
) {
  const now = new Date();
  await tx.authToken.updateMany({
    where: { userId: params.userId, type: params.type, usedAt: null, expiresAt: { gt: now } },
    data: { expiresAt: now },
  });
  const token = generateToken();
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS[params.type]);
  await tx.authToken.create({
    data: {
      tokenHash: hashToken(token),
      type: params.type,
      userId: params.userId,
      createdById: params.createdById,
      expiresAt,
    },
  });
  return { url: buildTokenUrl(params.type, token), expiresAt };
}

const REQUIRED_STATUS: Record<AuthTokenType, "INVITED" | "ACTIVE"> = {
  INVITE: "INVITED",
  PASSWORD_RESET: "ACTIVE",
};

/** Retorna o token e o usuário se o link ainda puder ser usado; caso contrário, null. */
export async function findUsableToken(db: Db, token: string, type: AuthTokenType) {
  if (!token || token.length > 100) return null;
  const record = await db.authToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (
    !record ||
    record.type !== type ||
    record.usedAt ||
    record.expiresAt.getTime() <= Date.now() ||
    record.user.status !== REQUIRED_STATUS[type]
  ) {
    return null;
  }
  return record;
}

const INVALID_LINK = "Este link é inválido, já foi usado ou expirou. Peça um novo ao administrador.";

export async function acceptInvite(
  db: Db,
  input: { token: string; password: string },
  meta: RequestMeta = {},
) {
  const record = await findUsableToken(db, input.token, "INVITE");
  if (!record) throw new AppError(INVALID_LINK);

  const policyError = checkPasswordPolicy(input.password, record.user);
  if (policyError) throw new AppError(policyError, { password: policyError });

  const passwordHash = await hashPassword(input.password);
  await db.$transaction(async (tx) => {
    // updateMany com usedAt: null garante uso único mesmo com envios simultâneos.
    const claimed = await tx.authToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) throw new AppError(INVALID_LINK);
    await tx.user.update({
      where: { id: record.userId },
      data: { passwordHash, status: "ACTIVE", lastLoginAt: new Date() },
    });
    await audit(tx, {
      actorId: record.userId,
      action: "usuario.convite_aceito",
      entityType: "usuario",
      entityId: record.userId,
      ip: meta.ip,
    });
  });
  return createSession(db, record.userId, meta);
}

export async function resetPassword(
  db: Db,
  input: { token: string; password: string },
  meta: RequestMeta = {},
) {
  const record = await findUsableToken(db, input.token, "PASSWORD_RESET");
  if (!record) throw new AppError(INVALID_LINK);

  const policyError = checkPasswordPolicy(input.password, record.user);
  if (policyError) throw new AppError(policyError, { password: policyError });

  const passwordHash = await hashPassword(input.password);
  await db.$transaction(async (tx) => {
    const claimed = await tx.authToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) throw new AppError(INVALID_LINK);
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
    // Redefinir a senha encerra todas as sessões abertas.
    await tx.session.deleteMany({ where: { userId: record.userId } });
    await audit(tx, {
      actorId: record.userId,
      action: "usuario.senha_redefinida",
      entityType: "usuario",
      entityId: record.userId,
      ip: meta.ip,
    });
  });
}

export async function changeOwnPassword(
  db: Db,
  actor: SessionUser,
  currentSessionId: string,
  input: { currentPassword: string; password: string },
  meta: RequestMeta = {},
) {
  const user = await db.user.findUniqueOrThrow({ where: { id: actor.id } });
  if (!user.passwordHash || !(await verifyPassword(user.passwordHash, input.currentPassword))) {
    throw new AppError("Senha atual incorreta.", { currentPassword: "Senha atual incorreta." });
  }
  if (input.currentPassword === input.password) {
    const msg = "A nova senha deve ser diferente da atual.";
    throw new AppError(msg, { password: msg });
  }
  const policyError = checkPasswordPolicy(input.password, user);
  if (policyError) throw new AppError(policyError, { password: policyError });

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(input.password) },
  });
  // Mantém a sessão atual e encerra as demais (outros dispositivos).
  await invalidateUserSessions(db, user.id, currentSessionId);
  await audit(db, {
    actorId: user.id,
    action: "usuario.senha_alterada",
    entityType: "usuario",
    entityId: user.id,
    ip: meta.ip,
  });
}
