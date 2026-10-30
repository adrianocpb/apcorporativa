import type { CompletionMethod, CompletionRule, Prisma } from "@/generated/prisma/client";
import type { Db } from "@/server/db";
import { AppError, NotFoundError } from "@/server/errors";
import type { SessionUser } from "@/server/auth/sessions";
import {
  applyHeartbeat,
  computeTrackState,
  coveragePercent,
  coveredSeconds,
  type Range,
  type RuleItem,
  type TrackComputation,
} from "@/lib/learning/rules";
import { rewardProgress, type ProgressReward } from "@/server/services/gamification";

// Progresso do colaborador nas trilhas. Toda regra é aplicada aqui, no servidor:
// a interface só mostra o que este serviço calcula.

type DbOrTx = Db | Prisma.TransactionClient;

export class LockedError extends AppError {
  constructor() {
    super("Este conteúdo ainda está bloqueado. Conclua as etapas anteriores para liberá-lo.");
    this.name = "LockedError";
  }
}

/** Tempo mínimo (s) antes de confirmar leitura, por tipo de conteúdo. */
export function minDwellSeconds(type: string, trackMinRead: number) {
  return type === "PDF" || type === "ARTICLE" ? trackMinRead : Math.min(5, trackMinRead);
}

export function defaultCompletionRule(type: string): CompletionRule {
  if (type === "VIDEO") return "WATCH";
  if (type === "IMAGE" || type === "LINK") return "VIEW";
  return "CONFIRM";
}

// ---------------------------------------------------------------------------
// Matrículas: quem tem a trilha (atribuição direta ou por grupo).
// ---------------------------------------------------------------------------

async function targetedUserIds(db: DbOrTx, trackId: string) {
  const assignments = await db.trackAssignment.findMany({
    where: { trackId },
    include: { group: { include: { members: { select: { userId: true } } } } },
  });
  const ids = new Set<string>();
  for (const a of assignments) {
    if (a.userId) ids.add(a.userId);
    for (const m of a.group?.members ?? []) ids.add(m.userId);
  }
  return ids;
}

/**
 * Sincroniza as matrículas de uma trilha publicada com as atribuições atuais.
 * Matrícula nunca é apagada: quem perde a atribuição antes de concluir fica marcado
 * como removido (histórico preservado); quem já concluiu continua com a trilha.
 */
export async function syncTrackEnrollments(db: DbOrTx, trackId: string) {
  const track = await db.track.findUnique({ where: { id: trackId }, select: { status: true } });
  if (!track || track.status !== "PUBLISHED") return;
  const targeted = await targetedUserIds(db, trackId);
  const existing = await db.enrollment.findMany({ where: { trackId } });
  const byUser = new Map(existing.map((e) => [e.userId, e]));
  const missing = [...targeted].filter((id) => !byUser.has(id));
  if (missing.length) {
    await db.enrollment.createMany({ data: missing.map((userId) => ({ trackId, userId })) });
    await notifyNewTrack(db, trackId, missing);
  }
  for (const e of existing) {
    if (targeted.has(e.userId) && e.removedAt) {
      await db.enrollment.update({ where: { id: e.id }, data: { removedAt: null } });
    } else if (!targeted.has(e.userId) && !e.removedAt && e.status !== "COMPLETED") {
      await db.enrollment.update({ where: { id: e.id }, data: { removedAt: new Date() } });
    }
  }
}

async function notifyNewTrack(db: DbOrTx, trackId: string, userIds: string[]) {
  const track = await db.track.findUnique({ where: { id: trackId }, select: { title: true } });
  if (!track || !userIds.length) return;
  await db.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: "trilha",
      title: `Nova trilha: ${track.title}`,
      body: "Uma trilha foi atribuída a você.",
      link: `/trilhas/${trackId}`,
    })),
  });
}

/** Sincroniza as trilhas ligadas a grupos (após mudanças de membros). */
export async function syncEnrollmentsForGroups(db: DbOrTx, groupIds: string[]) {
  if (!groupIds.length) return;
  const assignments = await db.trackAssignment.findMany({
    where: { groupId: { in: groupIds } },
    select: { trackId: true },
  });
  for (const trackId of new Set(assignments.map((a) => a.trackId))) {
    await syncTrackEnrollments(db, trackId);
  }
}

// ---------------------------------------------------------------------------
// Estrutura da trilha + fatos do colaborador → estado calculado.
// ---------------------------------------------------------------------------

export async function loadTrackStructure(db: DbOrTx, trackId: string) {
  const track = await db.track.findUnique({
    where: { id: trackId },
    include: {
      modules: {
        orderBy: { position: "asc" },
        include: {
          items: {
            orderBy: { position: "asc" },
            include: {
              content: {
                select: {
                  id: true,
                  type: true,
                  title: true,
                  status: true,
                  currentVersionId: true,
                  versions: {
                    where: { status: { in: ["PUBLISHED", "SUPERSEDED"] }, requiresRecompletion: true },
                    select: { number: true },
                    orderBy: { number: "desc" },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!track) return null;
  return track;
}

type Structure = NonNullable<Awaited<ReturnType<typeof loadTrackStructure>>>;

async function loadFacts(db: DbOrTx, userIds: string[], contentIds: string[]) {
  const [completions, progress] = await Promise.all([
    db.completionRecord.findMany({
      where: { userId: { in: userIds }, contentId: { in: contentIds } },
      select: { userId: true, contentId: true, completedAt: true, contentVersion: { select: { number: true } } },
    }),
    db.contentProgress.findMany({
      where: { userId: { in: userIds }, contentId: { in: contentIds } },
      select: { userId: true, contentId: true, contentVersionId: true, status: true, lastActivityAt: true },
    }),
  ]);
  return { completions, progress };
}

function computeForUser(
  structure: Structure,
  facts: Awaited<ReturnType<typeof loadFacts>>,
  userId: string,
  enrollmentCompleted: boolean,
) {
  const items = new Map<string, RuleItem>();
  for (const m of structure.modules) {
    for (const it of m.items) {
      const c = it.content;
      const mine = facts.completions.filter((r) => r.userId === userId && r.contentId === c.id);
      const best = Math.max(0, ...mine.map((r) => r.contentVersion.number));
      const baseline = c.versions[0]?.number ?? 0;
      items.set(it.id, {
        id: it.id,
        moduleId: m.id,
        required: it.required,
        archived: c.status !== "PUBLISHED",
        completed: mine.length > 0,
        needsRecompletion: mine.length > 0 && best < baseline,
        started: facts.progress.some(
          (p) => p.userId === userId && p.contentVersionId === c.currentVersionId && p.status === "IN_PROGRESS",
        ),
      });
    }
  }
  return computeTrackState(
    structure.modules.map((m) => ({ id: m.id, itemIds: m.items.map((i) => i.id) })),
    items,
    { sequential: structure.sequential, enrollmentCompleted },
  );
}

/** Estado da trilha para várias pessoas de uma vez (relatórios e painel). */
export async function computeTrackForUsers(db: DbOrTx, trackId: string, userIds: string[]) {
  const structure = await loadTrackStructure(db, trackId);
  if (!structure) throw new NotFoundError("Trilha não encontrada.");
  const contentIds = structure.modules.flatMap((m) => m.items.map((i) => i.contentId));
  const facts = await loadFacts(db, userIds, contentIds);
  const enrollments = await db.enrollment.findMany({ where: { trackId, userId: { in: userIds } } });
  const result = new Map<string, TrackComputation>();
  for (const userId of userIds) {
    const enrollment = enrollments.find((e) => e.userId === userId);
    result.set(userId, computeForUser(structure, facts, userId, enrollment?.status === "COMPLETED"));
  }
  return { structure, result };
}

// ---------------------------------------------------------------------------
// Consultas do colaborador
// ---------------------------------------------------------------------------

async function syncUserEnrollments(db: DbOrTx, userId: string) {
  const groupIds = (await db.groupMember.findMany({ where: { userId }, select: { groupId: true } })).map(
    (g) => g.groupId,
  );
  const assigned = await db.trackAssignment.findMany({
    where: {
      track: { status: "PUBLISHED" },
      OR: [{ userId }, ...(groupIds.length ? [{ groupId: { in: groupIds } }] : [])],
    },
    select: { trackId: true },
  });
  const trackIds = new Set(assigned.map((a) => a.trackId));
  const existing = await db.enrollment.findMany({ where: { userId } });
  for (const trackId of trackIds) {
    const e = existing.find((x) => x.trackId === trackId);
    if (!e) {
      await db.enrollment.create({ data: { trackId, userId } });
      await notifyNewTrack(db, trackId, [userId]);
    }
    else if (e.removedAt) await db.enrollment.update({ where: { id: e.id }, data: { removedAt: null } });
  }
}

export async function getMyTracks(db: Db, user: SessionUser) {
  await syncUserEnrollments(db, user.id);
  const enrollments = await db.enrollment.findMany({
    where: {
      userId: user.id,
      OR: [
        { removedAt: null, track: { status: "PUBLISHED" } },
        // Concluídas continuam disponíveis para revisão, mesmo se a trilha foi arquivada.
        { status: "COMPLETED" },
      ],
    },
    include: {
      track: {
        select: {
          id: true,
          title: true,
          description: true,
          isOnboarding: true,
          displayOrder: true,
          coverFileId: true,
          status: true,
          category: { select: { name: true } },
        },
      },
    },
    orderBy: [{ lastActivityAt: { sort: "desc", nulls: "last" } }, { createdAt: "asc" }],
  });

  const tracks = [];
  for (const e of enrollments) {
    const { structure, result } = await computeTrackForUsers(db, e.trackId, [user.id]);
    const state = result.get(user.id)!;
    const nextItem = state.nextItemId
      ? structure.modules.flatMap((m) => m.items).find((i) => i.id === state.nextItemId)
      : null;
    tracks.push({
      enrollment: e,
      track: e.track,
      state,
      nextItem: nextItem ? { id: nextItem.id, title: nextItem.content.title, type: nextItem.content.type } : null,
    });
  }

  // A consulta vem pela atividade mais recente; as listas seguem a ordem definida pelo administrador.
  type Entry = { track: { displayOrder: number; title: string }; state: TrackComputation; enrollment: { status: string } };
  const byDisplayOrder = (a: Entry, b: Entry) =>
    a.track.displayOrder - b.track.displayOrder || a.track.title.localeCompare(b.track.title, "pt-BR");
  const isStarted = (t: Entry) =>
    !t.state.completed && (t.state.percent > 0 || t.enrollment.status === "IN_PROGRESS");
  const inProgress = tracks.filter(isStarted).sort(byDisplayOrder);
  const notStarted = tracks.filter((t) => !t.state.completed && !isStarted(t)).sort(byDisplayOrder);
  const completed = tracks.filter((t) => t.state.completed).sort(byDisplayOrder);
  // Grade do painel: trilhas pendentes na ordem do administrador; concluídas ficam à parte, no fim.
  const active = tracks.filter((t) => !t.state.completed).sort(byDisplayOrder);
  // Cartão principal ("continue de onde parou"): a trilha com atividade mais recente;
  // sem nenhuma iniciada, a primeira pendente na ordem do administrador.
  const next = tracks.find(isStarted) ?? notStarted[0] ?? null;
  const required = tracks.reduce((s, t) => s + t.state.requiredCount, 0);
  const done = tracks.reduce((s, t) => s + (t.state.completed ? t.state.requiredCount : t.state.completedRequiredCount), 0);
  return {
    tracks,
    active,
    inProgress,
    notStarted,
    completed,
    next,
    overallPercent: required ? Math.round((done / required) * 100) : 0,
  };
}

async function requireEnrollment(db: DbOrTx, userId: string, trackId: string) {
  const enrollment = await db.enrollment.findUnique({ where: { trackId_userId: { trackId, userId } } });
  const track = await db.track.findUnique({ where: { id: trackId }, select: { status: true } });
  const allowed =
    enrollment &&
    track &&
    (enrollment.status === "COMPLETED" || (!enrollment.removedAt && track.status === "PUBLISHED"));
  if (!allowed) throw new NotFoundError("Trilha não encontrada.");
  return enrollment;
}

export async function getTrackForLearner(db: Db, user: SessionUser, trackId: string) {
  await syncUserEnrollments(db, user.id);
  const enrollment = await requireEnrollment(db, user.id, trackId);
  const { structure, result } = await computeTrackForUsers(db, trackId, [user.id]);
  return { structure, enrollment, state: result.get(user.id)! };
}

export async function getItemForLearner(db: Db, user: SessionUser, trackId: string, itemId: string) {
  const { structure, enrollment, state } = await getTrackForLearner(db, user, trackId);
  const computed = state.items.find((i) => i.id === itemId);
  if (!computed) throw new NotFoundError("Conteúdo não encontrado nesta trilha.");
  if (computed.state === "LOCKED") throw new LockedError();
  const item = structure.modules.flatMap((m) => m.items.map((i) => ({ ...i, module: m }))).find((i) => i.id === itemId)!;
  const version = item.content.currentVersionId
    ? await db.contentVersion.findUnique({
        where: { id: item.content.currentVersionId },
        include: { file: { select: { id: true, originalName: true, mimeType: true, size: true, durationSeconds: true } } },
      })
    : null;
  if (!version) throw new NotFoundError("Conteúdo indisponível.");
  const progress = await db.contentProgress.findUnique({
    where: { userId_contentVersionId: { userId: user.id, contentVersionId: version.id } },
  });
  const index = state.items.findIndex((i) => i.id === itemId);
  const neighbor = (offset: number) => {
    const n = state.items[index + offset];
    return n ? { id: n.id, state: n.state } : null;
  };
  return {
    structure,
    enrollment,
    state,
    item,
    computed,
    version,
    progress,
    previous: neighbor(-1),
    next: neighbor(1),
    dwellSeconds: minDwellSeconds(item.content.type, structure.minReadSeconds),
    secondsSinceOpen: progress ? (Date.now() - progress.openedAt.getTime()) / 1000 : null,
  };
}

// ---------------------------------------------------------------------------
// Registro de progresso
// ---------------------------------------------------------------------------

export type CompletionEvents = {
  contentCompleted: boolean;
  modulesCompleted: string[];
  trackCompleted: boolean;
  reward?: ProgressReward;
};

async function loadAvailableItem(db: DbOrTx, userId: string, trackId: string, itemId: string) {
  await requireEnrollment(db, userId, trackId);
  const { structure, result } = await computeTrackForUsers(db, trackId, [userId]);
  const state = result.get(userId)!;
  const computed = state.items.find((i) => i.id === itemId);
  if (!computed) throw new NotFoundError("Conteúdo não encontrado nesta trilha.");
  if (computed.state === "LOCKED") throw new LockedError();
  const item = structure.modules.flatMap((m) => m.items).find((i) => i.id === itemId)!;
  if (!item.content.currentVersionId || item.content.status !== "PUBLISHED") {
    throw new AppError("Este conteúdo não está mais disponível.");
  }
  return { structure, state, item, versionId: item.content.currentVersionId };
}

/** Registra a abertura do conteúdo (retomada e "onde parou"). Regra VIEW conclui aqui. */
export async function openItem(db: Db, user: SessionUser, trackId: string, itemId: string) {
  const { item, versionId } = await loadAvailableItem(db, user.id, trackId, itemId);
  const now = new Date();
  await db.contentProgress.upsert({
    where: { userId_contentVersionId: { userId: user.id, contentVersionId: versionId } },
    create: { userId: user.id, contentId: item.contentId, contentVersionId: versionId },
    update: { lastActivityAt: now },
  });
  const enrollment = await db.enrollment.findUniqueOrThrow({ where: { trackId_userId: { trackId, userId: user.id } } });
  await db.enrollment.update({
    where: { id: enrollment.id },
    data: {
      lastItemId: itemId,
      lastActivityAt: now,
      ...(enrollment.status === "NOT_STARTED" ? { status: "IN_PROGRESS", startedAt: now } : {}),
    },
  });
  if (item.completionRule === "VIEW") {
    return completeItem(db, user.id, trackId, item.contentId, versionId, "VIEWED", { regra: "abertura" });
  }
  return null;
}

/**
 * Conclui um conteúdo de forma idempotente: a restrição única (pessoa, versão) impede
 * registros repetidos. Atualiza as matrículas de todas as trilhas que usam o conteúdo.
 */
async function completeItem(
  db: Db,
  userId: string,
  trackId: string,
  contentId: string,
  versionId: string,
  method: CompletionMethod,
  evidence: Prisma.InputJsonValue,
): Promise<CompletionEvents> {
  const now = new Date();
  const events: CompletionEvents = { contentCompleted: false, modulesCompleted: [], trackCompleted: false };
  const before = await computeTrackForUsers(db, trackId, [userId]);
  const beforeModules = new Set(before.result.get(userId)!.modules.filter((m) => m.completed).map((m) => m.id));

  const existing = await db.completionRecord.findUnique({
    where: { userId_contentVersionId: { userId, contentVersionId: versionId } },
  });
  if (!existing) {
    try {
      await db.completionRecord.create({
        data: { userId, contentId, contentVersionId: versionId, trackId, method, evidence, completedAt: now },
      });
      events.contentCompleted = true;
    } catch (error) {
      // Dois sinais simultâneos: a restrição única garante um único registro.
      if ((error as { code?: string }).code !== "P2002") throw error;
    }
  }
  await db.contentProgress.updateMany({
    where: { userId, contentVersionId: versionId },
    data: { status: "COMPLETED", completedAt: now, lastActivityAt: now },
  });

  // Recalcula todas as trilhas da pessoa que contêm este conteúdo.
  const enrollments = await db.enrollment.findMany({
    where: { userId, status: { not: "COMPLETED" }, track: { modules: { some: { items: { some: { contentId } } } } } },
  });
  const completedModules: { id: string; title: string }[] = [];
  const completedTracks: { id: string; title: string }[] = [];
  for (const e of enrollments) {
    const { structure, result } = await computeTrackForUsers(db, e.trackId, [userId]);
    const state = result.get(userId)!;
    // Pontos por etapa e trilha são idempotentes: basta informar todas as concluídas.
    for (const m of state.modules.filter((x) => x.completed)) {
      const mod = structure.modules.find((x) => x.id === m.id);
      if (mod) completedModules.push({ id: mod.id, title: mod.title });
    }
    if (state.completed) {
      completedTracks.push({ id: structure.id, title: structure.title });
      await db.enrollment.update({
        where: { id: e.id },
        data: { status: "COMPLETED", completedAt: now, lastActivityAt: now, startedAt: e.startedAt ?? now },
      });
      if (e.trackId === trackId) events.trackCompleted = true;
    }
    if (e.trackId === trackId) {
      events.modulesCompleted = state.modules.filter((m) => m.completed && !beforeModules.has(m.id)).map((m) => m.id);
    }
  }

  const content = await db.content.findUnique({ where: { id: contentId }, select: { id: true, title: true, type: true } });
  events.reward = await rewardProgress(db, userId, {
    content: events.contentCompleted ? content : null,
    modules: completedModules,
    tracks: completedTracks,
  });
  return events;
}

export async function confirmCompletion(db: Db, user: SessionUser, trackId: string, itemId: string) {
  const { structure, item, versionId } = await loadAvailableItem(db, user.id, trackId, itemId);
  if (item.completionRule === "WATCH") {
    throw new AppError("Este vídeo é concluído automaticamente ao ser assistido.");
  }
  const progress = await db.contentProgress.findUnique({
    where: { userId_contentVersionId: { userId: user.id, contentVersionId: versionId } },
  });
  if (!progress) throw new AppError("Abra o conteúdo antes de concluí-lo.");
  if (progress.status === "COMPLETED") {
    return { contentCompleted: false, modulesCompleted: [], trackCompleted: false } satisfies CompletionEvents;
  }
  const required = minDwellSeconds(item.content.type, structure.minReadSeconds);
  const elapsed = (Date.now() - progress.openedAt.getTime()) / 1000;
  if (elapsed < required) {
    const missing = Math.ceil(required - elapsed);
    throw new AppError(`Dedique um pouco mais de tempo ao conteúdo antes de confirmar (faltam ${missing} s).`);
  }
  return completeItem(db, user.id, trackId, item.contentId, versionId, "CONFIRMED", {
    segundosAteConfirmar: Math.round(elapsed),
  });
}

export type HeartbeatInput = { from: number; to: number; position: number; duration: number };

/** Sinal periódico do player: valida o trecho assistido e conclui ao atingir o mínimo. */
export async function recordVideoHeartbeat(
  db: Db,
  user: SessionUser,
  trackId: string,
  itemId: string,
  beat: HeartbeatInput,
) {
  const { structure, item, versionId } = await loadAvailableItem(db, user.id, trackId, itemId);
  if (item.content.type !== "VIDEO") throw new AppError("Conteúdo não é um vídeo.");
  const progress = await db.contentProgress.findUnique({
    where: { userId_contentVersionId: { userId: user.id, contentVersionId: versionId } },
  });
  if (!progress) throw new AppError("Abra o conteúdo antes de assisti-lo.");
  const version = await db.contentVersion.findUniqueOrThrow({
    where: { id: versionId },
    include: { file: { select: { durationSeconds: true } } },
  });
  // Duração: a lida do arquivo pelo servidor prevalece; a do navegador só vale na falta dela
  // e fica fixada no primeiro sinal.
  const clientDuration = Number.isFinite(beat.duration) && beat.duration > 0 ? beat.duration : null;
  const duration =
    version.file?.durationSeconds ?? progress.durationSeconds ?? version.durationSeconds ?? clientDuration;
  if (!duration) throw new AppError("Não foi possível identificar a duração do vídeo.");

  const now = new Date();
  const result = applyHeartbeat(
    // Sem sinal anterior, o tempo conta desde a abertura do conteúdo.
    {
      ranges: (progress.watchedRanges as Range[] | null) ?? [],
      lastHeartbeatAt: progress.lastHeartbeatAt ?? progress.openedAt,
      duration,
    },
    { from: Number(beat.from), to: Number(beat.to), at: now },
  );
  const coverage = coveragePercent(result.ranges, duration);
  const position = Math.max(0, Math.min(Number(beat.position) || 0, duration));
  await db.contentProgress.update({
    where: { id: progress.id },
    data: {
      watchedRanges: result.ranges,
      watchedSeconds: coveredSeconds(result.ranges),
      durationSeconds: duration,
      positionSeconds: position,
      lastHeartbeatAt: now,
      lastActivityAt: now,
    },
  });
  await db.enrollment.update({
    where: { trackId_userId: { trackId, userId: user.id } },
    data: { lastActivityAt: now, lastItemId: itemId },
  });

  let events: CompletionEvents | null = null;
  if (
    progress.status !== "COMPLETED" &&
    item.completionRule === "WATCH" &&
    coverage >= structure.videoThresholdPct
  ) {
    events = await completeItem(db, user.id, trackId, item.contentId, versionId, "VIDEO_WATCHED", {
      cobertura: Math.round(coverage),
      duracao: Math.round(duration),
    });
  }
  return {
    coverage: Math.round(coverage),
    completed: progress.status === "COMPLETED" || !!events,
    events,
  };
}
