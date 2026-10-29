import type { Prisma } from "@/generated/prisma/client";
import type { Db } from "@/server/db";
import { NotFoundError } from "@/server/errors";
import { PERMISSIONS } from "@/server/auth/permissions";
import type { SessionUser } from "@/server/auth/sessions";
import { assertPermission } from "@/server/services/guard";
import { computeTrackForUsers } from "@/server/services/learning";
import { getLevelInfo } from "@/server/services/gamification";

// Relatórios de aprendizagem. Base: matrículas (Enrollment) ativas ou concluídas —
// quem perdeu a atribuição antes de concluir não entra nos indicadores.

export type ReportFilters = {
  trackId?: string;
  department?: string;
  userId?: string;
  /** Período: considera matrículas criadas até "to" e conclusões entre "from" e "to". */
  from?: Date;
  to?: Date;
};

const DAY = 24 * 3600 * 1000;

function guard(actor: SessionUser) {
  assertPermission(actor, PERMISSIONS.RELATORIOS_VER);
}

function enrollmentWhere(f: ReportFilters): Prisma.EnrollmentWhereInput {
  return {
    OR: [{ removedAt: null }, { status: "COMPLETED" }],
    ...(f.trackId ? { trackId: f.trackId } : {}),
    ...(f.userId ? { userId: f.userId } : {}),
    ...(f.department ? { user: { department: f.department } } : {}),
    ...(f.to ? { createdAt: { lte: f.to } } : {}),
  };
}

function completedInPeriod(e: { status: string; completedAt: Date | null }, f: ReportFilters) {
  if (e.status !== "COMPLETED" || !e.completedAt) return false;
  if (f.from && e.completedAt < f.from) return false;
  if (f.to && e.completedAt > f.to) return false;
  return true;
}

export function median(values: number[]) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Dias entre o início real (primeira abertura) e a conclusão. Sem início registrado, não entra. */
function completionDays(e: { startedAt: Date | null; completedAt: Date | null }) {
  if (!e.startedAt || !e.completedAt) return null;
  return Math.max(0, (e.completedAt.getTime() - e.startedAt.getTime()) / DAY);
}

const rate = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0);

export async function getReportOverview(db: Db, actor: SessionUser, f: ReportFilters = {}) {
  guard(actor);
  const [activeUsers, publishedTracks, enrollments, views] = await Promise.all([
    db.user.count({ where: { status: "ACTIVE", ...(f.department ? { department: f.department } : {}) } }),
    db.track.count({ where: { status: "PUBLISHED" } }),
    db.enrollment.findMany({
      where: enrollmentWhere(f),
      select: {
        status: true,
        startedAt: true,
        completedAt: true,
        userId: true,
        trackId: true,
        user: { select: { department: true } },
        track: { select: { title: true, isOnboarding: true, status: true } },
      },
    }),
    db.contentView.groupBy({
      by: ["contentId"],
      where: {
        ...(f.from || f.to ? { viewedAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) } } : {}),
        ...(f.department || f.userId
          ? { user: { ...(f.department ? { department: f.department } : {}), ...(f.userId ? { id: f.userId } : {}) } }
          : {}),
      },
      _count: { _all: true },
      orderBy: { _count: { contentId: "desc" } },
      take: 10,
    }),
  ]);

  const completed = enrollments.filter((e) => completedInPeriod(e, f));
  const pending = enrollments.filter((e) => e.status !== "COMPLETED");
  const days = completed.map(completionDays).filter((d): d is number => d !== null);

  // Onboarding: pessoas com trilha de onboarding e quantas concluíram todas as suas.
  const onboarding = new Map<string, { total: number; done: number }>();
  for (const e of enrollments.filter((x) => x.track.isOnboarding)) {
    const o = onboarding.get(e.userId) ?? { total: 0, done: 0 };
    o.total += 1;
    if (e.status === "COMPLETED") o.done += 1;
    onboarding.set(e.userId, o);
  }
  const onboardingDone = [...onboarding.values()].filter((o) => o.done === o.total).length;

  const group = <K extends string>(key: (e: (typeof enrollments)[number]) => K) => {
    const map = new Map<K, typeof enrollments>();
    for (const e of enrollments) map.set(key(e), [...(map.get(key(e)) ?? []), e]);
    return [...map.entries()].map(([k, list]) => {
      const done = list.filter((e) => completedInPeriod(e, f));
      const d = done.map(completionDays).filter((x): x is number => x !== null);
      return {
        key: k,
        enrolled: list.length,
        completed: done.length,
        inProgress: list.filter((e) => e.status === "IN_PROGRESS").length,
        notStarted: list.filter((e) => e.status === "NOT_STARTED").length,
        rate: rate(done.length, list.length),
        medianDays: median(d),
      };
    });
  };

  const byTrack = group((e) => e.trackId).map((g) => {
    const t = enrollments.find((e) => e.trackId === g.key)!.track;
    return { ...g, title: t.title, isOnboarding: t.isOnboarding, status: t.status };
  });
  const byDepartment = group((e) => e.user.department ?? "Sem área").sort((a, b) => b.enrolled - a.enrolled);

  const contents = await db.content.findMany({
    where: { id: { in: views.map((v) => v.contentId) } },
    select: { id: true, title: true, type: true },
  });

  return {
    activeUsers,
    publishedTracks,
    enrollments: enrollments.length,
    completed: completed.length,
    pending: pending.length,
    completionRate: rate(completed.length, enrollments.length),
    onboarding: { people: onboarding.size, completed: onboardingDone, rate: rate(onboardingDone, onboarding.size) },
    medianCompletionDays: median(days),
    timedCompletions: days.length,
    byTrack: byTrack.sort((a, b) => b.enrolled - a.enrolled),
    byDepartment,
    mostAccessed: views.map((v) => ({
      ...contents.find((c) => c.id === v.contentId)!,
      views: v._count._all,
    })).filter((v) => v.id),
  };
}

/** Uma linha por pessoa × trilha, com percentual e onde parou. */
export async function getProgressRows(db: Db, actor: SessionUser, f: ReportFilters = {}) {
  guard(actor);
  const enrollments = await db.enrollment.findMany({
    where: enrollmentWhere(f),
    include: {
      user: { select: { id: true, name: true, email: true, department: true, jobTitle: true, hireDate: true, status: true } },
      track: { select: { id: true, title: true, isOnboarding: true } },
    },
    orderBy: [{ user: { name: "asc" } }, { createdAt: "asc" }],
  });
  const byTrack = new Map<string, string[]>();
  for (const e of enrollments) byTrack.set(e.trackId, [...(byTrack.get(e.trackId) ?? []), e.userId]);
  const computed = new Map<string, Awaited<ReturnType<typeof computeTrackForUsers>>>();
  for (const [trackId, userIds] of byTrack) computed.set(trackId, await computeTrackForUsers(db, trackId, userIds));

  return enrollments.map((e) => {
    const { structure, result } = computed.get(e.trackId)!;
    const state = result.get(e.userId)!;
    const items = structure.modules.flatMap((m) => m.items.map((i) => ({ id: i.id, title: i.content.title, module: m.title })));
    const current = state.completed ? null : items.find((i) => i.id === (state.nextItemId ?? e.lastItemId));
    return {
      enrollmentId: e.id,
      user: e.user,
      track: e.track,
      status: e.status,
      percent: state.percent,
      assignedAt: e.createdAt,
      startedAt: e.startedAt,
      completedAt: e.completedAt,
      lastActivityAt: e.lastActivityAt,
      days: completionDays(e),
      currentItem: current ?? null,
    };
  });
}

/** Histórico de conclusões (somente leitura), filtrável. */
export async function getCompletionHistory(db: Db, actor: SessionUser, f: ReportFilters = {}, take = 5000) {
  guard(actor);
  return db.completionRecord.findMany({
    where: {
      ...(f.userId ? { userId: f.userId } : {}),
      ...(f.trackId ? { trackId: f.trackId } : {}),
      ...(f.department ? { user: { department: f.department } } : {}),
      ...(f.from || f.to ? { completedAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) } } : {}),
    },
    orderBy: { completedAt: "desc" },
    take,
    include: {
      user: { select: { name: true, email: true, department: true } },
      content: { select: { title: true, type: true } },
      contentVersion: { select: { number: true } },
      track: { select: { title: true } },
    },
  });
}

/** Acompanhamento individual: trilhas, progresso, pontos e histórico de uma pessoa. */
export async function getPersonReport(db: Db, actor: SessionUser, userId: string) {
  guard(actor);
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, department: true, jobTitle: true, hireDate: true, status: true, createdAt: true, lastLoginAt: true },
  });
  if (!user) throw new NotFoundError("Pessoa não encontrada.");
  const [rows, history, level, achievements] = await Promise.all([
    getProgressRows(db, actor, { userId }),
    getCompletionHistory(db, actor, { userId }, 200),
    getLevelInfo(db, userId),
    db.userAchievement.findMany({ where: { userId }, include: { achievement: { select: { name: true } } }, orderBy: { awardedAt: "desc" } }),
  ]);
  return { user, rows, history, level, achievements };
}

export async function listReportFilterOptions(db: Db, actor: SessionUser) {
  guard(actor);
  const [tracks, departments, users] = await Promise.all([
    db.track.findMany({ where: { status: { not: "DRAFT" } }, orderBy: { title: "asc" }, select: { id: true, title: true } }),
    db.user.findMany({ where: { department: { not: null } }, distinct: ["department"], select: { department: true }, orderBy: { department: "asc" } }),
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { tracks, departments: departments.map((d) => d.department!), users };
}

/** Lê e valida os filtros da URL (datas no formato AAAA-MM-DD, período inclusivo). */
export function parseReportFilters(sp: Record<string, string | string[] | undefined>): ReportFilters & {
  raw: Record<string, string>;
} {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).slice(0, 60) : "");
  const date = (v: string, end: boolean) =>
    /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)) ? new Date(`${v}T${end ? "23:59:59.999" : "00:00:00.000"}-03:00`) : undefined;
  const raw = { trilha: one("trilha"), area: one("area"), pessoa: one("pessoa"), de: one("de"), ate: one("ate") };
  return {
    trackId: raw.trilha || undefined,
    department: raw.area || undefined,
    userId: raw.pessoa || undefined,
    from: date(raw.de, false),
    to: date(raw.ate, true),
    raw,
  };
}
