import type { CompletionRule, Prisma, TrackStatus } from "@/generated/prisma/client";
import type { Db } from "@/server/db";
import { AppError, NotFoundError } from "@/server/errors";
import { PERMISSIONS } from "@/server/auth/permissions";
import type { RequestMeta, SessionUser } from "@/server/auth/sessions";
import { moduleInputSchema, structureSchema, trackInputSchema } from "@/lib/validation/tracks";
import { parseInput } from "@/server/validation";
import { audit } from "@/server/services/audit";
import { assertPermission } from "@/server/services/guard";
import { computeTrackForUsers, defaultCompletionRule, syncTrackEnrollments } from "@/server/services/learning";

const RULES_BY_TYPE: Record<string, CompletionRule[]> = {
  VIDEO: ["WATCH", "CONFIRM"],
  PDF: ["CONFIRM", "VIEW"],
  ARTICLE: ["CONFIRM", "VIEW"],
  FAQ: ["CONFIRM", "VIEW"],
  IMAGE: ["VIEW", "CONFIRM"],
  LINK: ["VIEW", "CONFIRM"],
};

export function allowedRules(type: string) {
  return RULES_BY_TYPE[type] ?? ["CONFIRM"];
}

function guard(actor: SessionUser) {
  assertPermission(actor, PERMISSIONS.TRILHAS_GERENCIAR);
}

async function auditTrack(
  db: Db | Prisma.TransactionClient,
  actor: SessionUser,
  trackId: string,
  action: string,
  details: Prisma.InputJsonValue,
  meta: RequestMeta,
) {
  await audit(db, { actorId: actor.id, action, entityType: "trilha", entityId: trackId, details, ip: meta.ip });
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

export async function listTracks(db: Db, actor: SessionUser, filters: { status?: TrackStatus } = {}) {
  guard(actor);
  const tracks = await db.track.findMany({
    where: filters.status ? { status: filters.status } : {},
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: {
      category: { select: { name: true } },
      modules: { select: { _count: { select: { items: true } } } },
      enrollments: { where: { OR: [{ removedAt: null }, { status: "COMPLETED" }] }, select: { status: true } },
    },
  });
  return tracks.map((t) => ({
    ...t,
    itemCount: t.modules.reduce((s, m) => s + m._count.items, 0),
    enrolled: t.enrollments.length,
    completedCount: t.enrollments.filter((e) => e.status === "COMPLETED").length,
  }));
}

export async function getTrackForEdit(db: Db, actor: SessionUser, id: string) {
  guard(actor);
  const track = await db.track.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true } },
      coverFile: { select: { id: true, originalName: true, size: true } },
      createdBy: { select: { name: true } },
      modules: {
        orderBy: { position: "asc" },
        include: {
          items: {
            orderBy: { position: "asc" },
            include: { content: { select: { id: true, title: true, type: true, status: true } } },
          },
        },
      },
      assignments: {
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { id: true, name: true, email: true, status: true } },
          group: { select: { id: true, name: true, _count: { select: { members: true } } } },
        },
      },
    },
  });
  if (!track) throw new NotFoundError("Trilha não encontrada.");
  return track;
}

/** Conteúdos publicados que ainda não estão na trilha (para adicionar). */
export async function listAddableContents(db: Db, actor: SessionUser, trackId: string) {
  guard(actor);
  const inTrack = await db.trackItem.findMany({
    where: { module: { trackId } },
    select: { contentId: true },
  });
  return db.content.findMany({
    where: { status: "PUBLISHED", id: { notIn: inTrack.map((i) => i.contentId) } },
    orderBy: { title: "asc" },
    select: { id: true, title: true, type: true, category: { select: { name: true } } },
  });
}

// ---------------------------------------------------------------------------
// Trilha
// ---------------------------------------------------------------------------

async function validRefs(db: Db, input: { categoryId: string | null; coverFileId: string | null }) {
  if (input.categoryId) {
    const c = await db.category.findUnique({ where: { id: input.categoryId } });
    if (!c || c.status !== "ACTIVE") {
      throw new AppError("Verifique os campos destacados.", { categoryId: "Categoria inválida ou arquivada." });
    }
  }
  if (input.coverFileId) {
    const f = await db.storedFile.findUnique({ where: { id: input.coverFileId } });
    if (!f || f.kind !== "IMAGE") throw new AppError("A capa deve ser uma imagem.");
  }
}

export async function createTrack(db: Db, actor: SessionUser, raw: unknown, meta: RequestMeta = {}) {
  guard(actor);
  const input = parseInput(trackInputSchema, raw);
  await validRefs(db, input);
  return db.$transaction(async (tx) => {
    const track = await tx.track.create({
      data: {
        ...input,
        createdById: actor.id,
        // Toda trilha nasce com uma etapa para começar a montar.
        modules: { create: { title: "Etapa 1", position: 0 } },
      },
    });
    await auditTrack(tx, actor, track.id, "trilha.criada", { titulo: track.title }, meta);
    return track;
  });
}

export async function updateTrack(db: Db, actor: SessionUser, id: string, raw: unknown, meta: RequestMeta = {}) {
  guard(actor);
  const input = parseInput(trackInputSchema, raw);
  const current = await db.track.findUnique({ where: { id } });
  if (!current) throw new NotFoundError("Trilha não encontrada.");
  await validRefs(db, input);
  return db.$transaction(async (tx) => {
    const track = await tx.track.update({ where: { id }, data: input });
    await auditTrack(
      tx,
      actor,
      id,
      "trilha.editada",
      {
        titulo: track.title,
        sequencial: track.sequential,
        onboarding: track.isOnboarding,
        percentualVideo: track.videoThresholdPct,
        leituraMinima: track.minReadSeconds,
      },
      meta,
    );
    return track;
  });
}

export async function setTrackStatus(
  db: Db,
  actor: SessionUser,
  id: string,
  action: "publish" | "archive" | "restore",
  meta: RequestMeta = {},
) {
  guard(actor);
  const track = await db.track.findUnique({
    where: { id },
    include: { modules: { include: { items: { include: { content: { select: { status: true } } } } } } },
  });
  if (!track) throw new NotFoundError("Trilha não encontrada.");
  const now = new Date();
  let status: TrackStatus;
  if (action === "publish") {
    const usable = track.modules.flatMap((m) => m.items).filter((i) => i.content.status === "PUBLISHED");
    if (usable.length === 0) throw new AppError("Adicione ao menos um conteúdo publicado antes de publicar a trilha.");
    status = "PUBLISHED";
  } else if (action === "archive") {
    status = "ARCHIVED";
  } else {
    status = track.publishedAt ? "PUBLISHED" : "DRAFT";
  }
  await db.$transaction(async (tx) => {
    await tx.track.update({
      where: { id },
      data: {
        status,
        ...(action === "publish" ? { publishedAt: track.publishedAt ?? now, archivedAt: null } : {}),
        ...(action === "archive" ? { archivedAt: now } : {}),
        ...(action === "restore" ? { archivedAt: null } : {}),
      },
    });
    const labels = { publish: "trilha.publicada", archive: "trilha.arquivada", restore: "trilha.restaurada" };
    await auditTrack(tx, actor, id, labels[action], { titulo: track.title }, meta);
    if (status === "PUBLISHED") await syncTrackEnrollments(tx, id);
  });
}

// ---------------------------------------------------------------------------
// Estrutura: etapas e conteúdos
// ---------------------------------------------------------------------------

async function moduleOf(db: Db, moduleId: string) {
  const mod = await db.trackModule.findUnique({ where: { id: moduleId }, include: { track: true } });
  if (!mod) throw new NotFoundError("Etapa não encontrada.");
  return mod;
}

export async function addModule(db: Db, actor: SessionUser, trackId: string, raw: unknown, meta: RequestMeta = {}) {
  guard(actor);
  const input = parseInput(moduleInputSchema, raw);
  const track = await db.track.findUnique({ where: { id: trackId }, include: { modules: true } });
  if (!track) throw new NotFoundError("Trilha não encontrada.");
  const position = Math.max(-1, ...track.modules.map((m) => m.position)) + 1;
  return db.$transaction(async (tx) => {
    const mod = await tx.trackModule.create({ data: { ...input, trackId, position } });
    await auditTrack(tx, actor, trackId, "trilha.estrutura_alterada", { etapaCriada: mod.title }, meta);
    return mod;
  });
}

export async function updateModule(db: Db, actor: SessionUser, moduleId: string, raw: unknown, meta: RequestMeta = {}) {
  guard(actor);
  const input = parseInput(moduleInputSchema, raw);
  const mod = await moduleOf(db, moduleId);
  await db.$transaction(async (tx) => {
    await tx.trackModule.update({ where: { id: moduleId }, data: input });
    await auditTrack(tx, actor, mod.trackId, "trilha.estrutura_alterada", { etapaRenomeada: input.title }, meta);
  });
}

export async function deleteModule(db: Db, actor: SessionUser, moduleId: string, meta: RequestMeta = {}) {
  guard(actor);
  const mod = await db.trackModule.findUnique({ where: { id: moduleId }, include: { _count: { select: { items: true } } } });
  if (!mod) throw new NotFoundError("Etapa não encontrada.");
  if (mod._count.items > 0) throw new AppError("Remova ou mova os conteúdos da etapa antes de excluí-la.");
  const count = await db.trackModule.count({ where: { trackId: mod.trackId } });
  if (count <= 1) throw new AppError("A trilha precisa de pelo menos uma etapa.");
  await db.$transaction(async (tx) => {
    await tx.trackModule.delete({ where: { id: moduleId } });
    await auditTrack(tx, actor, mod.trackId, "trilha.estrutura_alterada", { etapaExcluida: mod.title }, meta);
  });
}

export async function addItems(
  db: Db,
  actor: SessionUser,
  moduleId: string,
  contentIds: string[],
  meta: RequestMeta = {},
) {
  guard(actor);
  const mod = await moduleOf(db, moduleId);
  const unique = [...new Set(contentIds)];
  if (unique.length === 0) throw new AppError("Selecione ao menos um conteúdo.");
  const contents = await db.content.findMany({ where: { id: { in: unique } } });
  if (contents.length !== unique.length || contents.some((c) => c.status !== "PUBLISHED")) {
    throw new AppError("Só é possível adicionar conteúdos publicados.");
  }
  const already = await db.trackItem.count({ where: { contentId: { in: unique }, module: { trackId: mod.trackId } } });
  if (already > 0) throw new AppError("Um dos conteúdos já está nesta trilha.");
  const last = await db.trackItem.findFirst({ where: { moduleId }, orderBy: { position: "desc" } });
  let position = (last?.position ?? -1) + 1;
  await db.$transaction(async (tx) => {
    for (const id of unique) {
      const content = contents.find((c) => c.id === id)!;
      await tx.trackItem.create({
        data: { moduleId, contentId: id, position: position++, completionRule: defaultCompletionRule(content.type) },
      });
    }
    await auditTrack(
      tx,
      actor,
      mod.trackId,
      "trilha.estrutura_alterada",
      { etapa: mod.title, conteudosAdicionados: contents.map((c) => c.title) },
      meta,
    );
  });
}

export async function updateItem(
  db: Db,
  actor: SessionUser,
  itemId: string,
  input: { required: boolean; completionRule: string },
  meta: RequestMeta = {},
) {
  guard(actor);
  const item = await db.trackItem.findUnique({ where: { id: itemId }, include: { content: true, module: true } });
  if (!item) throw new NotFoundError("Item não encontrado.");
  const rule = input.completionRule as CompletionRule;
  if (!allowedRules(item.content.type).includes(rule)) throw new AppError("Regra de conclusão inválida para este tipo.");
  await db.$transaction(async (tx) => {
    await tx.trackItem.update({ where: { id: itemId }, data: { required: input.required, completionRule: rule } });
    await auditTrack(
      tx,
      actor,
      item.module.trackId,
      "trilha.estrutura_alterada",
      { conteudo: item.content.title, obrigatorio: input.required, regra: rule },
      meta,
    );
  });
}

export async function removeItem(db: Db, actor: SessionUser, itemId: string, meta: RequestMeta = {}) {
  guard(actor);
  const item = await db.trackItem.findUnique({ where: { id: itemId }, include: { content: true, module: true } });
  if (!item) throw new NotFoundError("Item não encontrado.");
  // As conclusões ficam no histórico (são por conteúdo, não por item da trilha).
  await db.$transaction(async (tx) => {
    await tx.trackItem.delete({ where: { id: itemId } });
    await auditTrack(tx, actor, item.module.trackId, "trilha.estrutura_alterada", { conteudoRemovido: item.content.title }, meta);
  });
}

/**
 * Aplica a nova ordem de etapas e itens (inclusive mover itens entre etapas).
 * A estrutura enviada precisa conter exatamente as etapas e itens atuais da trilha.
 */
export async function reorderTrack(db: Db, actor: SessionUser, trackId: string, raw: unknown, meta: RequestMeta = {}) {
  guard(actor);
  const structure = structureSchema.safeParse(raw);
  if (!structure.success) throw new AppError("Estrutura inválida.");
  const track = await db.track.findUnique({ where: { id: trackId }, include: { modules: { include: { items: true } } } });
  if (!track) throw new NotFoundError("Trilha não encontrada.");
  const moduleIds = new Set(track.modules.map((m) => m.id));
  const itemIds = new Set(track.modules.flatMap((m) => m.items.map((i) => i.id)));
  const sentModules = structure.data.map((m) => m.moduleId);
  const sentItems = structure.data.flatMap((m) => m.itemIds);
  const same = (a: Set<string>, b: string[]) => a.size === b.length && new Set(b).size === b.length && b.every((x) => a.has(x));
  if (!same(moduleIds, sentModules) || !same(itemIds, sentItems)) {
    throw new AppError("A trilha foi alterada em outra janela. Recarregue a página e tente de novo.");
  }
  await db.$transaction(async (tx) => {
    for (const [mi, m] of structure.data.entries()) {
      await tx.trackModule.update({ where: { id: m.moduleId }, data: { position: mi } });
      for (const [ii, itemId] of m.itemIds.entries()) {
        await tx.trackItem.update({ where: { id: itemId }, data: { moduleId: m.moduleId, position: ii } });
      }
    }
    await auditTrack(tx, actor, trackId, "trilha.estrutura_alterada", { reordenada: true }, meta);
  });
}

// ---------------------------------------------------------------------------
// Atribuições e acompanhamento
// ---------------------------------------------------------------------------

export async function assignTrack(
  db: Db,
  actor: SessionUser,
  trackId: string,
  targets: { userIds?: string[]; groupIds?: string[] },
  meta: RequestMeta = {},
) {
  guard(actor);
  const track = await db.track.findUnique({ where: { id: trackId }, include: { assignments: true } });
  if (!track) throw new NotFoundError("Trilha não encontrada.");
  if (track.status === "ARCHIVED") throw new AppError("Restaure a trilha antes de atribuí-la.");
  const userIds = [...new Set(targets.userIds ?? [])].filter((id) => !track.assignments.some((a) => a.userId === id));
  const groupIds = [...new Set(targets.groupIds ?? [])].filter((id) => !track.assignments.some((a) => a.groupId === id));
  if (!userIds.length && !groupIds.length) throw new AppError("Selecione ao menos uma pessoa ou grupo.");
  const [users, groups] = await Promise.all([
    db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }),
    db.group.findMany({ where: { id: { in: groupIds } }, select: { id: true, name: true } }),
  ]);
  if (users.length !== userIds.length || groups.length !== groupIds.length) throw new AppError("Seleção inválida.");
  await db.$transaction(async (tx) => {
    await tx.trackAssignment.createMany({
      data: [
        ...userIds.map((userId) => ({ trackId, userId, assignedById: actor.id })),
        ...groupIds.map((groupId) => ({ trackId, groupId, assignedById: actor.id })),
      ],
    });
    await syncTrackEnrollments(tx, trackId);
    await auditTrack(
      tx,
      actor,
      trackId,
      "trilha.atribuida",
      { titulo: track.title, pessoas: users.map((u) => u.name), grupos: groups.map((g) => g.name) },
      meta,
    );
  });
  return userIds.length + groupIds.length;
}

export async function removeAssignment(db: Db, actor: SessionUser, assignmentId: string, meta: RequestMeta = {}) {
  guard(actor);
  const a = await db.trackAssignment.findUnique({
    where: { id: assignmentId },
    include: { user: { select: { name: true } }, group: { select: { name: true } } },
  });
  if (!a) throw new NotFoundError("Atribuição não encontrada.");
  await db.$transaction(async (tx) => {
    await tx.trackAssignment.delete({ where: { id: assignmentId } });
    await syncTrackEnrollments(tx, a.trackId);
    await auditTrack(tx, actor, a.trackId, "trilha.atribuicao_removida", { alvo: a.user?.name ?? a.group?.name ?? "" }, meta);
  });
}

/** Onde cada pessoa está na trilha: percentual, item atual, última atividade. */
export async function getTrackProgress(db: Db, actor: SessionUser, trackId: string) {
  guard(actor);
  const enrollments = await db.enrollment.findMany({
    where: { trackId, OR: [{ removedAt: null }, { status: "COMPLETED" }] },
    include: { user: { select: { id: true, name: true, email: true, department: true, status: true } } },
    orderBy: { user: { name: "asc" } },
  });
  if (!enrollments.length) return [];
  const { structure, result } = await computeTrackForUsers(db, trackId, enrollments.map((e) => e.userId));
  const items = structure.modules.flatMap((m) => m.items.map((i) => ({ ...i, moduleTitle: m.title })));
  return enrollments.map((e) => {
    const state = result.get(e.userId)!;
    const current = items.find((i) => i.id === (state.nextItemId ?? e.lastItemId));
    return {
      enrollment: e,
      user: e.user,
      percent: state.percent,
      completed: state.completed,
      currentItem: current ? { title: current.content.title, module: current.moduleTitle } : null,
    };
  });
}
