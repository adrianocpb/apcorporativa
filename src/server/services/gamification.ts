import { z } from "zod";
import type { PointEvent, Prisma } from "@/generated/prisma/client";
import type { Db } from "@/server/db";
import { AppError, NotFoundError } from "@/server/errors";
import { PERMISSIONS } from "@/server/auth/permissions";
import type { RequestMeta, SessionUser } from "@/server/auth/sessions";
import { parseInput } from "@/server/validation";
import { audit } from "@/server/services/audit";
import { assertPermission } from "@/server/services/guard";
import {
  levelFor,
  meetsCriteria,
  parseCriteria,
  type AchievementFacts,
} from "@/lib/gamification";

type DbOrTx = Db | Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Valores iniciais (criados só se ainda não existirem: o administrador pode mudar tudo).
// ---------------------------------------------------------------------------

const DEFAULT_LEVELS = [
  { name: "Explorador", minPoints: 0 },
  { name: "Aprendiz", minPoints: 100 },
  { name: "Praticante", minPoints: 300 },
  { name: "Especialista", minPoints: 600 },
  { name: "Multiplicador de Conhecimento", minPoints: 1000 },
];

const DEFAULT_RULES: { event: PointEvent; points: number }[] = [
  { event: "CONTENT_VIDEO", points: 10 },
  { event: "CONTENT_READING", points: 10 },
  { event: "CONTENT_OTHER", points: 5 },
  { event: "MODULE_COMPLETED", points: 20 },
  { event: "TRACK_COMPLETED", points: 50 },
];

const DEFAULT_ACHIEVEMENTS = [
  {
    key: "primeiros-passos",
    name: "Primeiros passos",
    description: "Concluiu os primeiros cinco conteúdos.",
    criteria: { tipo: "CONTENTS_COMPLETED", minimo: 5 },
    points: 20,
  },
  {
    key: "primeira-trilha",
    name: "Primeira trilha",
    description: "Concluiu a primeira trilha de aprendizagem.",
    criteria: { tipo: "TRACKS_COMPLETED", minimo: 1 },
    points: 30,
  },
  {
    key: "onboarding-concluido",
    name: "Bem-vindo a bordo",
    description: "Concluiu o onboarding.",
    criteria: { tipo: "ONBOARDING_COMPLETED" },
    points: 50,
  },
];

export async function seedGamificationDefaults(db: Db) {
  if ((await db.level.count()) === 0) {
    await db.level.createMany({ data: DEFAULT_LEVELS.map((l, i) => ({ ...l, number: i + 1 })) });
  }
  for (const rule of DEFAULT_RULES) {
    await db.pointRule.upsert({ where: { event: rule.event }, update: {}, create: rule });
  }
  if ((await db.achievement.count()) === 0) {
    await db.achievement.createMany({ data: DEFAULT_ACHIEVEMENTS });
  }
}

// ---------------------------------------------------------------------------
// Concessão de pontos (idempotente)
// ---------------------------------------------------------------------------

async function ruleValue(db: DbOrTx, event: PointEvent) {
  const rule = await db.pointRule.findUnique({ where: { event } });
  return rule?.active ? rule.points : 0;
}

/** Registra pontos uma única vez por (pessoa, evento, origem). Devolve os pontos concedidos. */
async function grant(
  db: DbOrTx,
  data: { userId: string; event: PointEvent; sourceType: string; sourceId: string; description: string; points: number },
) {
  if (data.points === 0) return 0;
  const exists = await db.pointTransaction.findUnique({
    where: {
      userId_event_sourceType_sourceId: {
        userId: data.userId,
        event: data.event,
        sourceType: data.sourceType,
        sourceId: data.sourceId,
      },
    },
  });
  if (exists) return 0;
  try {
    await db.pointTransaction.create({ data });
    return data.points;
  } catch (error) {
    // Requisições simultâneas: a restrição única garante um único lançamento.
    if ((error as { code?: string }).code === "P2002") return 0;
    throw error;
  }
}

export async function totalPoints(db: DbOrTx, userId: string) {
  const agg = await db.pointTransaction.aggregate({ where: { userId }, _sum: { points: true } });
  return agg._sum.points ?? 0;
}

export async function getLevelInfo(db: DbOrTx, userId: string) {
  const [levels, total] = await Promise.all([
    db.level.findMany({ orderBy: { minPoints: "asc" } }),
    totalPoints(db, userId),
  ]);
  return levelFor(levels, total);
}

const CONTENT_EVENT: Record<string, PointEvent> = {
  VIDEO: "CONTENT_VIDEO",
  PDF: "CONTENT_READING",
  ARTICLE: "CONTENT_READING",
  FAQ: "CONTENT_READING",
  IMAGE: "CONTENT_OTHER",
  LINK: "CONTENT_OTHER",
};

export type ProgressReward = {
  points: number;
  levelUp: { number: number; name: string } | null;
  achievements: { name: string; points: number }[];
};

/**
 * Concede os pontos de um avanço (conteúdo, etapas e trilhas concluídas), avalia conquistas
 * e avisa sobre novo nível. Pode ser chamada de novo para o mesmo fato sem efeito
 * (os pontos de um conteúdo valem uma vez, mesmo que ele seja revisto ou reconcluído).
 */
export async function rewardProgress(
  db: Db,
  userId: string,
  input: {
    content: { id: string; title: string; type: string } | null;
    modules: { id: string; title: string }[];
    tracks: { id: string; title: string }[];
  },
): Promise<ProgressReward> {
  const before = await getLevelInfo(db, userId);
  let points = 0;

  if (input.content) {
    const event = CONTENT_EVENT[input.content.type] ?? "CONTENT_OTHER";
    points += await grant(db, {
      userId,
      event,
      sourceType: "conteudo",
      sourceId: input.content.id,
      description: `Concluiu “${input.content.title}”`,
      points: await ruleValue(db, event),
    });
  }
  const moduleValue = await ruleValue(db, "MODULE_COMPLETED");
  for (const m of input.modules) {
    points += await grant(db, {
      userId,
      event: "MODULE_COMPLETED",
      sourceType: "etapa",
      sourceId: m.id,
      description: `Finalizou a etapa “${m.title}”`,
      points: moduleValue,
    });
  }
  const trackValue = await ruleValue(db, "TRACK_COMPLETED");
  for (const t of input.tracks) {
    points += await grant(db, {
      userId,
      event: "TRACK_COMPLETED",
      sourceType: "trilha",
      sourceId: t.id,
      description: `Finalizou a trilha “${t.title}”`,
      points: trackValue,
    });
  }

  const achievements = await evaluateAchievements(db, userId);
  points += achievements.reduce((s, a) => s + a.points, 0);

  const after = await getLevelInfo(db, userId);
  let levelUp: ProgressReward["levelUp"] = null;
  if (after.current && before.current && after.current.number > before.current.number) {
    levelUp = { number: after.current.number, name: after.current.name };
    await db.notification.create({
      data: {
        userId,
        type: "nivel",
        title: `Você alcançou o nível ${after.current.number} — ${after.current.name}`,
        body: `${after.total} pontos acumulados.`,
        link: "/conquistas",
      },
    });
  }
  return { points, levelUp, achievements };
}

async function achievementFacts(db: DbOrTx, userId: string): Promise<AchievementFacts> {
  const [contents, completed] = await Promise.all([
    db.completionRecord.findMany({ where: { userId }, distinct: ["contentId"], select: { contentId: true } }),
    db.enrollment.findMany({
      where: { userId, status: "COMPLETED" },
      select: { trackId: true, track: { select: { isOnboarding: true } } },
    }),
  ]);
  return {
    contentsCompleted: contents.length,
    tracksCompleted: completed.length,
    onboardingCompleted: completed.some((e) => e.track.isOnboarding),
    completedTrackIds: new Set(completed.map((e) => e.trackId)),
  };
}

/** Atribui automaticamente as conquistas cujo critério foi atingido. */
export async function evaluateAchievements(db: Db, userId: string) {
  const pending = await db.achievement.findMany({
    where: { active: true, users: { none: { userId } } },
  });
  if (!pending.length) return [];
  const facts = await achievementFacts(db, userId);
  const unlocked: { name: string; points: number }[] = [];
  for (const a of pending) {
    const criteria = parseCriteria(a.criteria);
    if (!criteria || !meetsCriteria(criteria, facts)) continue;
    try {
      await db.userAchievement.create({ data: { userId, achievementId: a.id } });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") continue;
      throw error;
    }
    const granted = await grant(db, {
      userId,
      event: "ACHIEVEMENT",
      sourceType: "conquista",
      sourceId: a.id,
      description: `Conquista “${a.name}”`,
      points: a.points,
    });
    await db.notification.create({
      data: {
        userId,
        type: "conquista",
        title: `Nova conquista: ${a.name}`,
        body: granted ? `${a.description} (+${granted} pontos)` : a.description,
        link: "/conquistas",
      },
    });
    unlocked.push({ name: a.name, points: granted });
  }
  return unlocked;
}

// ---------------------------------------------------------------------------
// Colaborador
// ---------------------------------------------------------------------------

export async function getMyGamification(db: Db, user: SessionUser) {
  const [level, history, achievements, earned, trackTitles] = await Promise.all([
    getLevelInfo(db, user.id),
    db.pointTransaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.achievement.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } }),
    db.userAchievement.findMany({ where: { userId: user.id }, include: { achievement: true }, orderBy: { awardedAt: "desc" } }),
    db.track.findMany({ select: { id: true, title: true } }),
  ]);
  const earnedIds = new Set(earned.map((e) => e.achievementId));
  return {
    level,
    history,
    earned,
    locked: achievements.filter((a) => !earnedIds.has(a.id)),
    trackTitle: (id: string) => trackTitles.find((t) => t.id === id)?.title,
  };
}

export async function listNotifications(db: Db, user: SessionUser) {
  const [items, unread] = await Promise.all([
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return { items, unread };
}

export async function markNotificationsRead(db: Db, user: SessionUser) {
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
}

// ---------------------------------------------------------------------------
// Administração
// ---------------------------------------------------------------------------

function guard(actor: SessionUser) {
  assertPermission(actor, PERMISSIONS.GAMIFICACAO_CONFIGURAR);
}

export async function getGamificationConfig(db: Db, actor: SessionUser) {
  guard(actor);
  const [levels, rules, achievements, tracks] = await Promise.all([
    db.level.findMany({ orderBy: { minPoints: "asc" } }),
    db.pointRule.findMany(),
    db.achievement.findMany({ orderBy: { createdAt: "asc" }, include: { _count: { select: { users: true } } } }),
    db.track.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { title: "asc" }, select: { id: true, title: true } }),
  ]);
  return { levels, rules, achievements, tracks };
}

const pointsField = z.coerce
  .number({ error: "Use um número inteiro." })
  .int({ error: "Use um número inteiro." })
  .min(0, { error: "Use 0 ou mais." })
  .max(10000, { error: "No máximo 10.000." });

export async function updatePointRules(db: Db, actor: SessionUser, raw: Record<string, string>, meta: RequestMeta = {}) {
  guard(actor);
  const rules = await db.pointRule.findMany();
  const changes: Record<string, { pontos: number; ativa: boolean }> = {};
  const errors: Record<string, string> = {};
  const parsed = rules.map((r) => {
    const value = pointsField.safeParse(raw[`points_${r.event}`] ?? r.points);
    if (!value.success) errors[`points_${r.event}`] = value.error.issues[0].message;
    return { rule: r, points: value.success ? value.data : r.points, active: raw[`active_${r.event}`] === "on" };
  });
  if (Object.keys(errors).length) throw new AppError("Verifique os campos destacados.", errors);
  await db.$transaction(async (tx) => {
    for (const p of parsed) {
      if (p.points !== p.rule.points || p.active !== p.rule.active) {
        await tx.pointRule.update({ where: { id: p.rule.id }, data: { points: p.points, active: p.active } });
        changes[p.rule.event] = { pontos: p.points, ativa: p.active };
      }
    }
    if (Object.keys(changes).length) {
      await audit(tx, { actorId: actor.id, action: "gamificacao.regras_alteradas", entityType: "gamificacao", details: changes, ip: meta.ip });
    }
  });
}

const levelSchema = z.object({
  name: z.string().trim().min(2, { error: "Informe o nome do nível." }).max(60, { error: "No máximo 60 caracteres." }),
  minPoints: pointsField.max(1_000_000, { error: "Valor muito alto." }),
});

/** Níveis são numerados pela ordem de pontos mínimos; o primeiro sempre começa em 0. */
async function renumberLevels(tx: Prisma.TransactionClient) {
  const levels = await tx.level.findMany({ orderBy: { minPoints: "asc" } });
  // Duas passagens para não violar a unicidade de "number" durante a troca.
  for (const [i, l] of levels.entries()) await tx.level.update({ where: { id: l.id }, data: { number: 1000 + i } });
  for (const [i, l] of levels.entries()) await tx.level.update({ where: { id: l.id }, data: { number: i + 1 } });
}

export async function saveLevel(db: Db, actor: SessionUser, id: string | null, raw: unknown, meta: RequestMeta = {}) {
  guard(actor);
  const input = parseInput(levelSchema, raw);
  const levels = await db.level.findMany({ orderBy: { minPoints: "asc" } });
  const current = id ? levels.find((l) => l.id === id) : null;
  if (id && !current) throw new NotFoundError("Nível não encontrado.");
  if (levels.some((l) => l.minPoints === input.minPoints && l.id !== id)) {
    throw new AppError("Verifique os campos destacados.", { minPoints: "Já existe um nível com esta pontuação." });
  }
  if (current && current.minPoints === 0 && input.minPoints !== 0) {
    throw new AppError("Verifique os campos destacados.", { minPoints: "O primeiro nível começa em 0 ponto." });
  }
  await db.$transaction(async (tx) => {
    if (current) await tx.level.update({ where: { id: current.id }, data: input });
    else await tx.level.create({ data: { ...input, number: 9000 + levels.length } });
    await renumberLevels(tx);
    await audit(tx, {
      actorId: actor.id,
      action: current ? "gamificacao.nivel_editado" : "gamificacao.nivel_criado",
      entityType: "gamificacao",
      details: { nome: input.name, pontosMinimos: input.minPoints },
      ip: meta.ip,
    });
  });
}

export async function deleteLevel(db: Db, actor: SessionUser, id: string, meta: RequestMeta = {}) {
  guard(actor);
  const level = await db.level.findUnique({ where: { id } });
  if (!level) throw new NotFoundError("Nível não encontrado.");
  if (level.minPoints === 0) throw new AppError("O nível inicial não pode ser excluído.");
  await db.$transaction(async (tx) => {
    await tx.level.delete({ where: { id } });
    await renumberLevels(tx);
    await audit(tx, { actorId: actor.id, action: "gamificacao.nivel_excluido", entityType: "gamificacao", details: { nome: level.name }, ip: meta.ip });
  });
}

const achievementSchema = z.object({
  name: z.string().trim().min(2, { error: "Informe o nome." }).max(80, { error: "No máximo 80 caracteres." }),
  description: z.string().trim().min(3, { error: "Descreva a conquista." }).max(200, { error: "No máximo 200 caracteres." }),
  type: z.enum(["CONTENTS_COMPLETED", "TRACKS_COMPLETED", "ONBOARDING_COMPLETED", "TRACK_COMPLETED"], {
    error: "Escolha o critério.",
  }),
  minimum: z.string().optional(),
  trackId: z.string().optional(),
  points: pointsField,
  active: z.string().optional().transform((v) => v === "on"),
});

export async function saveAchievement(db: Db, actor: SessionUser, id: string | null, raw: unknown, meta: RequestMeta = {}) {
  guard(actor);
  const input = parseInput(achievementSchema, raw);
  let criteria: Prisma.InputJsonValue;
  if (input.type === "CONTENTS_COMPLETED" || input.type === "TRACKS_COMPLETED") {
    const min = Number(input.minimum);
    if (!Number.isInteger(min) || min < 1 || min > 1000) {
      throw new AppError("Verifique os campos destacados.", { minimum: "Informe uma quantidade entre 1 e 1000." });
    }
    criteria = { tipo: input.type, minimo: min };
  } else if (input.type === "TRACK_COMPLETED") {
    const track = input.trackId ? await db.track.findUnique({ where: { id: input.trackId } }) : null;
    if (!track) throw new AppError("Verifique os campos destacados.", { trackId: "Escolha a trilha." });
    criteria = { tipo: input.type, trilhaId: track.id };
  } else {
    criteria = { tipo: input.type };
  }
  const data = { name: input.name, description: input.description, points: input.points, active: input.active, criteria };
  await db.$transaction(async (tx) => {
    if (id) {
      const exists = await tx.achievement.findUnique({ where: { id } });
      if (!exists) throw new NotFoundError("Conquista não encontrada.");
      await tx.achievement.update({ where: { id }, data });
    } else {
      await tx.achievement.create({ data: { ...data, key: `conquista-${Date.now().toString(36)}` } });
    }
    await audit(tx, {
      actorId: actor.id,
      action: id ? "gamificacao.conquista_editada" : "gamificacao.conquista_criada",
      entityType: "gamificacao",
      details: { nome: input.name, criterio: criteria, pontos: input.points, ativa: input.active },
      ip: meta.ip,
    });
  });
}

export const POINTS_PAGE_SIZE = 30;

export async function listPointHistory(db: Db, actor: SessionUser, filters: { userId?: string; page?: number }) {
  guard(actor);
  const page = Math.max(1, filters.page ?? 1);
  const where: Prisma.PointTransactionWhereInput = filters.userId ? { userId: filters.userId } : {};
  const [total, items] = await Promise.all([
    db.pointTransaction.count({ where }),
    db.pointTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * POINTS_PAGE_SIZE,
      take: POINTS_PAGE_SIZE,
      include: { user: { select: { id: true, name: true } }, createdBy: { select: { name: true } } },
    }),
  ]);
  return { total, items, page, pageCount: Math.max(1, Math.ceil(total / POINTS_PAGE_SIZE)) };
}

const adjustSchema = z.object({
  userId: z.string().min(1, { error: "Escolha a pessoa." }),
  points: z.coerce
    .number({ error: "Use um número inteiro." })
    .int({ error: "Use um número inteiro." })
    .refine((n) => n !== 0 && Math.abs(n) <= 10000, { error: "Use um valor entre -10.000 e 10.000, diferente de 0." }),
  reason: z.string().trim().min(5, { error: "Explique o motivo do ajuste." }).max(200, { error: "No máximo 200 caracteres." }),
});

/** Ajuste manual: novo lançamento (positivo ou negativo) com motivo, nunca edição do histórico. */
export async function adjustPoints(db: Db, actor: SessionUser, raw: unknown, meta: RequestMeta = {}) {
  guard(actor);
  const input = parseInput(adjustSchema, raw);
  const user = await db.user.findUnique({ where: { id: input.userId } });
  if (!user) throw new AppError("Pessoa não encontrada.");
  await db.$transaction(async (tx) => {
    const t = await tx.pointTransaction.create({
      data: {
        userId: user.id,
        event: "MANUAL_ADJUSTMENT",
        points: input.points,
        sourceType: "ajuste",
        sourceId: `ajuste-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        description: input.reason,
        createdById: actor.id,
      },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "gamificacao.pontos_ajustados",
      entityType: "usuario",
      entityId: user.id,
      details: { pessoa: user.name, pontos: input.points, motivo: input.reason, lancamento: t.id },
      ip: meta.ip,
    });
  });
}
