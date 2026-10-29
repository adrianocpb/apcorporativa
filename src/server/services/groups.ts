import type { Db } from "@/server/db";
import { AppError, NotFoundError } from "@/server/errors";
import { PERMISSIONS } from "@/server/auth/permissions";
import type { RequestMeta, SessionUser } from "@/server/auth/sessions";
import { groupInputSchema } from "@/lib/validation/users";
import { parseInput } from "@/server/validation";
import { audit } from "@/server/services/audit";
import { assertPermission } from "@/server/services/guard";
import { syncEnrollmentsForGroups } from "@/server/services/learning";

export async function listGroups(db: Db, actor: SessionUser) {
  assertPermission(actor, PERMISSIONS.GRUPOS_GERENCIAR);
  return db.group.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { members: true } } },
  });
}

/** Lista enxuta usada em seletores (ex.: grupos de um usuário). */
export async function listGroupOptions(db: Db, actor: SessionUser) {
  assertPermission(actor, PERMISSIONS.USUARIOS_GERENCIAR);
  return db.group.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
}

export async function getGroup(db: Db, actor: SessionUser, id: string) {
  assertPermission(actor, PERMISSIONS.GRUPOS_GERENCIAR);
  const group = await db.group.findUnique({
    where: { id },
    include: {
      members: {
        orderBy: { user: { name: "asc" } },
        include: {
          user: {
            select: { id: true, name: true, email: true, department: true, status: true },
          },
        },
      },
    },
  });
  if (!group) throw new NotFoundError("Grupo não encontrado.");
  return group;
}

async function assertNameFree(db: Db, name: string, ignoreId?: string) {
  const existing = await db.group.findFirst({
    where: { name, ...(ignoreId ? { NOT: { id: ignoreId } } : {}) },
  });
  if (existing) {
    throw new AppError("Verifique os campos destacados.", {
      name: "Já existe um grupo com este nome.",
    });
  }
}

export async function createGroup(
  db: Db,
  actor: SessionUser,
  rawInput: unknown,
  meta: RequestMeta = {},
) {
  assertPermission(actor, PERMISSIONS.GRUPOS_GERENCIAR);
  const input = parseInput(groupInputSchema, rawInput);
  await assertNameFree(db, input.name);
  return db.$transaction(async (tx) => {
    const group = await tx.group.create({ data: input });
    await audit(tx, {
      actorId: actor.id,
      action: "grupo.criado",
      entityType: "grupo",
      entityId: group.id,
      details: { nome: group.name },
      ip: meta.ip,
    });
    return group;
  });
}

export async function updateGroup(
  db: Db,
  actor: SessionUser,
  id: string,
  rawInput: unknown,
  meta: RequestMeta = {},
) {
  assertPermission(actor, PERMISSIONS.GRUPOS_GERENCIAR);
  const input = parseInput(groupInputSchema, rawInput);
  const current = await db.group.findUnique({ where: { id } });
  if (!current) throw new NotFoundError("Grupo não encontrado.");
  await assertNameFree(db, input.name, id);
  return db.$transaction(async (tx) => {
    const group = await tx.group.update({ where: { id }, data: input });
    await audit(tx, {
      actorId: actor.id,
      action: "grupo.editado",
      entityType: "grupo",
      entityId: id,
      details: {
        antes: { nome: current.name, descricao: current.description },
        depois: { nome: group.name, descricao: group.description },
      },
      ip: meta.ip,
    });
    return group;
  });
}

export async function deleteGroup(db: Db, actor: SessionUser, id: string, meta: RequestMeta = {}) {
  assertPermission(actor, PERMISSIONS.GRUPOS_GERENCIAR);
  const group = await db.group.findUnique({
    where: { id },
    include: { _count: { select: { members: true } } },
  });
  if (!group) throw new NotFoundError("Grupo não encontrado.");
  if (group._count.members > 0) {
    throw new AppError("Remova os membros do grupo antes de excluí-lo.");
  }
  await db.$transaction(async (tx) => {
    await tx.group.delete({ where: { id } });
    await audit(tx, {
      actorId: actor.id,
      action: "grupo.excluido",
      entityType: "grupo",
      entityId: id,
      details: { nome: group.name },
      ip: meta.ip,
    });
  });
}

export async function addGroupMembers(
  db: Db,
  actor: SessionUser,
  groupId: string,
  userIds: string[],
  meta: RequestMeta = {},
) {
  assertPermission(actor, PERMISSIONS.GRUPOS_GERENCIAR);
  const group = await db.group.findUnique({
    where: { id: groupId },
    include: { members: { select: { userId: true } } },
  });
  if (!group) throw new NotFoundError("Grupo não encontrado.");
  const existing = new Set(group.members.map((m) => m.userId));
  const candidates = [...new Set(userIds)].filter((id) => !existing.has(id));
  if (candidates.length === 0) throw new AppError("Selecione ao menos um usuário.");
  const users = await db.user.findMany({
    where: { id: { in: candidates } },
    select: { id: true, name: true },
  });
  if (users.length !== candidates.length) throw new AppError("Usuário inválido.");

  await db.$transaction(async (tx) => {
    await tx.groupMember.createMany({
      data: candidates.map((userId) => ({ groupId, userId })),
    });
    await audit(tx, {
      actorId: actor.id,
      action: "grupo.membros_adicionados",
      entityType: "grupo",
      entityId: groupId,
      details: { grupo: group.name, usuarios: users.map((u) => u.name) },
      ip: meta.ip,
    });
    // Novos membros recebem as trilhas atribuídas ao grupo.
    await syncEnrollmentsForGroups(tx, [groupId]);
  });
  return candidates.length;
}

export async function removeGroupMember(
  db: Db,
  actor: SessionUser,
  groupId: string,
  userId: string,
  meta: RequestMeta = {},
) {
  assertPermission(actor, PERMISSIONS.GRUPOS_GERENCIAR);
  const member = await db.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    include: { group: { select: { name: true } }, user: { select: { name: true } } },
  });
  if (!member) throw new NotFoundError("Membro não encontrado no grupo.");
  await db.groupMember.delete({ where: { groupId_userId: { groupId, userId } } });
  await syncEnrollmentsForGroups(db, [groupId]);
  await audit(db, {
    actorId: actor.id,
    action: "grupo.membro_removido",
    entityType: "grupo",
    entityId: groupId,
    details: { grupo: member.group.name, usuario: member.user.name },
    ip: meta.ip,
  });
}

/** Usuários que ainda não estão no grupo, para o seletor de inclusão. */
export async function listAddableUsers(db: Db, actor: SessionUser, groupId: string) {
  assertPermission(actor, PERMISSIONS.GRUPOS_GERENCIAR);
  return db.user.findMany({
    where: { status: { not: "INACTIVE" }, groups: { none: { groupId } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, department: true },
  });
}
