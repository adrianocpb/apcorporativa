import type { Prisma, UserStatus } from "@/generated/prisma/client";
import type { Db } from "@/server/db";
import { AppError, NotFoundError } from "@/server/errors";
import { PERMISSIONS, ROLE_KEYS } from "@/server/auth/permissions";
import type { RequestMeta, SessionUser } from "@/server/auth/sessions";
import { userInputSchema, type UserInput } from "@/lib/validation/users";
import { parseInput } from "@/server/validation";
import { audit } from "@/server/services/audit";
import { issueAuthToken } from "@/server/services/auth";
import { assertPermission } from "@/server/services/guard";

export const USERS_PAGE_SIZE = 20;

export type UserFilters = {
  q?: string;
  status?: UserStatus;
  department?: string;
  roleKey?: string;
  page?: number;
};

export async function listUsers(db: Db, actor: SessionUser, filters: UserFilters = {}) {
  assertPermission(actor, PERMISSIONS.USUARIOS_GERENCIAR);
  const page = Math.max(1, filters.page ?? 1);
  const q = filters.q?.trim();
  const where: Prisma.UserWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.department ? { department: filters.department } : {}),
    ...(filters.roleKey ? { role: { key: filters.roleKey } } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { email: { contains: q.toLowerCase() } },
            { username: { contains: q.toLowerCase() } },
          ],
        }
      : {}),
  };
  const [total, items] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: [{ status: "asc" }, { name: "asc" }],
      skip: (page - 1) * USERS_PAGE_SIZE,
      take: USERS_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        department: true,
        jobTitle: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        role: { select: { key: true, name: true } },
      },
    }),
  ]);
  return { total, items, page, pageCount: Math.max(1, Math.ceil(total / USERS_PAGE_SIZE)) };
}

export async function listDepartments(db: Db, actor: SessionUser) {
  assertPermission(actor, PERMISSIONS.USUARIOS_GERENCIAR);
  const rows = await db.user.findMany({
    where: { department: { not: null } },
    distinct: ["department"],
    select: { department: true },
    orderBy: { department: "asc" },
  });
  return rows.map((r) => r.department!).filter(Boolean);
}

export async function getUser(db: Db, actor: SessionUser, id: string) {
  assertPermission(actor, PERMISSIONS.USUARIOS_GERENCIAR);
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      department: true,
      jobTitle: true,
      hireDate: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
      role: { select: { key: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      groups: { select: { group: { select: { id: true, name: true } } } },
    },
  });
  if (!user) throw new NotFoundError("Usuário não encontrado.");
  return user;
}

async function assertUnique(db: Db, input: UserInput, ignoreId?: string) {
  const conflict = await db.user.findFirst({
    where: {
      OR: [{ email: input.email }, { username: input.username }],
      ...(ignoreId ? { NOT: { id: ignoreId } } : {}),
    },
    select: { email: true, username: true },
  });
  if (!conflict) return;
  const fieldErrors: Record<string, string> = {};
  if (conflict.email === input.email) fieldErrors.email = "Já existe um usuário com este e-mail.";
  if (conflict.username === input.username)
    fieldErrors.username = "Já existe um usuário com este login.";
  throw new AppError("Verifique os campos destacados.", fieldErrors);
}

async function roleIdByKey(db: Db | Prisma.TransactionClient, key: string) {
  const role = await db.role.findUnique({ where: { key } });
  if (!role) throw new AppError("Perfil inválido.");
  return role.id;
}

async function countOtherActiveAdmins(db: Db | Prisma.TransactionClient, userId: string) {
  return db.user.count({
    where: { status: "ACTIVE", role: { key: ROLE_KEYS.ADMIN }, NOT: { id: userId } },
  });
}

export async function createUser(
  db: Db,
  actor: SessionUser,
  rawInput: unknown,
  meta: RequestMeta = {},
) {
  assertPermission(actor, PERMISSIONS.USUARIOS_GERENCIAR);
  const input = parseInput(userInputSchema, rawInput);
  await assertUnique(db, input);
  const roleId = await roleIdByKey(db, input.roleKey);

  return db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        username: input.username,
        department: input.department,
        jobTitle: input.jobTitle,
        hireDate: input.hireDate,
        roleId,
        status: "INVITED",
        createdById: actor.id,
      },
    });
    const invite = await issueAuthToken(tx, {
      userId: user.id,
      type: "INVITE",
      createdById: actor.id,
    });
    await audit(tx, {
      actorId: actor.id,
      action: "usuario.criado",
      entityType: "usuario",
      entityId: user.id,
      details: { nome: user.name, email: user.email, login: user.username, perfil: input.roleKey },
      ip: meta.ip,
    });
    return { user, invite };
  });
}

export async function updateUser(
  db: Db,
  actor: SessionUser,
  id: string,
  rawInput: unknown,
  meta: RequestMeta = {},
) {
  assertPermission(actor, PERMISSIONS.USUARIOS_GERENCIAR);
  const input = parseInput(userInputSchema, rawInput);
  const current = await db.user.findUnique({ where: { id }, include: { role: true } });
  if (!current) throw new NotFoundError("Usuário não encontrado.");
  await assertUnique(db, input, id);

  if (current.role.key !== input.roleKey) {
    if (id === actor.id) {
      throw new AppError("Você não pode alterar o seu próprio perfil de acesso.", {
        roleKey: "Peça a outro administrador.",
      });
    }
    if (
      current.role.key === ROLE_KEYS.ADMIN &&
      current.status === "ACTIVE" &&
      (await countOtherActiveAdmins(db, id)) === 0
    ) {
      throw new AppError("O sistema precisa de pelo menos um administrador ativo.");
    }
  }

  const roleId = await roleIdByKey(db, input.roleKey);
  const before = {
    nome: current.name,
    email: current.email,
    login: current.username,
    area: current.department,
    cargo: current.jobTitle,
    dataEntrada: current.hireDate?.toISOString().slice(0, 10) ?? null,
    perfil: current.role.key,
  };
  const after = {
    nome: input.name,
    email: input.email,
    login: input.username,
    area: input.department,
    cargo: input.jobTitle,
    dataEntrada: input.hireDate?.toISOString().slice(0, 10) ?? null,
    perfil: input.roleKey,
  };
  const changed = (Object.keys(after) as (keyof typeof after)[]).filter(
    (k) => before[k] !== after[k],
  );
  if (changed.length === 0) return current;

  return db.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id },
      data: {
        name: input.name,
        email: input.email,
        username: input.username,
        department: input.department,
        jobTitle: input.jobTitle,
        hireDate: input.hireDate,
        roleId,
      },
    });
    // Mudança de perfil vale imediatamente: as permissões são lidas da sessão a cada requisição.
    await audit(tx, {
      actorId: actor.id,
      action: "usuario.editado",
      entityType: "usuario",
      entityId: id,
      details: {
        antes: Object.fromEntries(changed.map((k) => [k, before[k]])),
        depois: Object.fromEntries(changed.map((k) => [k, after[k]])),
      },
      ip: meta.ip,
    });
    return user;
  });
}

export async function deactivateUser(
  db: Db,
  actor: SessionUser,
  id: string,
  meta: RequestMeta = {},
) {
  assertPermission(actor, PERMISSIONS.USUARIOS_GERENCIAR);
  if (id === actor.id) throw new AppError("Você não pode desativar a sua própria conta.");
  const user = await db.user.findUnique({ where: { id }, include: { role: true } });
  if (!user) throw new NotFoundError("Usuário não encontrado.");
  if (user.status === "INACTIVE") return;
  if (
    user.role.key === ROLE_KEYS.ADMIN &&
    user.status === "ACTIVE" &&
    (await countOtherActiveAdmins(db, id)) === 0
  ) {
    throw new AppError("O sistema precisa de pelo menos um administrador ativo.");
  }

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { status: "INACTIVE" } });
    await tx.session.deleteMany({ where: { userId: id } });
    await tx.authToken.updateMany({
      where: { userId: id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { expiresAt: new Date() },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "usuario.desativado",
      entityType: "usuario",
      entityId: id,
      details: { statusAnterior: user.status },
      ip: meta.ip,
    });
  });
}

export async function reactivateUser(
  db: Db,
  actor: SessionUser,
  id: string,
  meta: RequestMeta = {},
) {
  assertPermission(actor, PERMISSIONS.USUARIOS_GERENCIAR);
  const user = await db.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError("Usuário não encontrado.");
  if (user.status !== "INACTIVE") return { status: user.status };

  // Quem nunca definiu senha volta para "convite pendente" e precisa de um novo link.
  const status: UserStatus = user.passwordHash ? "ACTIVE" : "INVITED";
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { status } });
    await audit(tx, {
      actorId: actor.id,
      action: "usuario.reativado",
      entityType: "usuario",
      entityId: id,
      details: { novoStatus: status },
      ip: meta.ip,
    });
  });
  return { status };
}

export async function generateInviteLink(
  db: Db,
  actor: SessionUser,
  id: string,
  meta: RequestMeta = {},
) {
  assertPermission(actor, PERMISSIONS.USUARIOS_GERENCIAR);
  const user = await db.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError("Usuário não encontrado.");
  if (user.status !== "INVITED") {
    throw new AppError("Só é possível gerar convite para usuários com convite pendente.");
  }
  return db.$transaction(async (tx) => {
    const invite = await issueAuthToken(tx, { userId: id, type: "INVITE", createdById: actor.id });
    await audit(tx, {
      actorId: actor.id,
      action: "usuario.convite_gerado",
      entityType: "usuario",
      entityId: id,
      ip: meta.ip,
    });
    return invite;
  });
}

export async function generatePasswordResetLink(
  db: Db,
  actor: SessionUser,
  id: string,
  meta: RequestMeta = {},
) {
  assertPermission(actor, PERMISSIONS.USUARIOS_GERENCIAR);
  const user = await db.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError("Usuário não encontrado.");
  if (user.status !== "ACTIVE") {
    throw new AppError("Só é possível redefinir a senha de usuários ativos.");
  }
  return db.$transaction(async (tx) => {
    const link = await issueAuthToken(tx, {
      userId: id,
      type: "PASSWORD_RESET",
      createdById: actor.id,
    });
    await audit(tx, {
      actorId: actor.id,
      action: "usuario.redefinicao_gerada",
      entityType: "usuario",
      entityId: id,
      ip: meta.ip,
    });
    return link;
  });
}

export async function setUserGroups(
  db: Db,
  actor: SessionUser,
  userId: string,
  groupIds: string[],
  meta: RequestMeta = {},
) {
  assertPermission(actor, PERMISSIONS.USUARIOS_GERENCIAR);
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { groups: true },
  });
  if (!user) throw new NotFoundError("Usuário não encontrado.");
  const unique = [...new Set(groupIds)];
  const valid = await db.group.findMany({
    where: { id: { in: [...new Set([...unique, ...user.groups.map((g) => g.groupId)])] } },
    select: { id: true, name: true },
  });
  const nameOf = new Map(valid.map((g) => [g.id, g.name]));
  if (unique.some((id) => !nameOf.has(id))) throw new AppError("Grupo inválido.");

  const currentIds = new Set(user.groups.map((g) => g.groupId));
  const added = unique.filter((g) => !currentIds.has(g));
  const removed = [...currentIds].filter((g) => !unique.includes(g));
  if (added.length === 0 && removed.length === 0) return;

  await db.$transaction(async (tx) => {
    await tx.groupMember.deleteMany({ where: { userId, groupId: { in: removed } } });
    if (added.length) {
      await tx.groupMember.createMany({ data: added.map((groupId) => ({ groupId, userId })) });
    }
    await audit(tx, {
      actorId: actor.id,
      action: "usuario.grupos_alterados",
      entityType: "usuario",
      entityId: userId,
      details: {
        adicionados: added.map((id) => nameOf.get(id) ?? id),
        removidos: removed.map((id) => nameOf.get(id) ?? id),
      },
      ip: meta.ip,
    });
  });
}
