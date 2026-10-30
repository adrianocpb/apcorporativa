// Regras de gamificação sem acesso ao banco (cálculo de nível e descrição de conquistas).

export type LevelDef = { id: string; number: number; name: string; minPoints: number };

/** Nível atual, próximo e progresso entre eles, a partir dos pontos totais. */
export function levelFor(levels: LevelDef[], total: number) {
  const sorted = [...levels].sort((a, b) => a.minPoints - b.minPoints);
  let current = sorted[0] ?? null;
  for (const level of sorted) if (total >= level.minPoints) current = level;
  const next = current ? (sorted.find((l) => l.minPoints > current!.minPoints) ?? null) : null;
  const span = next && current ? next.minPoints - current.minPoints : 0;
  const progress = next && current ? Math.min(100, Math.round(((total - current.minPoints) / span) * 100)) : 100;
  return {
    levels: sorted,
    current,
    next,
    total,
    pointsToNext: next ? Math.max(0, next.minPoints - total) : 0,
    progress,
  };
}

export const ACHIEVEMENT_TYPES = {
  CONTENTS_COMPLETED: "Concluir uma quantidade de conteúdos",
  TRACKS_COMPLETED: "Concluir uma quantidade de trilhas",
  ONBOARDING_COMPLETED: "Concluir uma trilha de onboarding",
  TRACK_COMPLETED: "Concluir uma trilha específica",
} as const;

export type AchievementType = keyof typeof ACHIEVEMENT_TYPES;

export type AchievementCriteria =
  | { tipo: "CONTENTS_COMPLETED"; minimo: number }
  | { tipo: "TRACKS_COMPLETED"; minimo: number }
  | { tipo: "ONBOARDING_COMPLETED" }
  | { tipo: "TRACK_COMPLETED"; trilhaId: string };

export function parseCriteria(value: unknown): AchievementCriteria | null {
  if (!value || typeof value !== "object") return null;
  const c = value as Record<string, unknown>;
  const min = Number(c.minimo);
  switch (c.tipo) {
    case "CONTENTS_COMPLETED":
    case "TRACKS_COMPLETED":
      return Number.isInteger(min) && min > 0 ? { tipo: c.tipo, minimo: min } : null;
    case "ONBOARDING_COMPLETED":
      return { tipo: "ONBOARDING_COMPLETED" };
    case "TRACK_COMPLETED":
      return typeof c.trilhaId === "string" && c.trilhaId ? { tipo: "TRACK_COMPLETED", trilhaId: c.trilhaId } : null;
    default:
      return null;
  }
}

export type AchievementFacts = {
  contentsCompleted: number;
  tracksCompleted: number;
  onboardingCompleted: boolean;
  completedTrackIds: Set<string>;
};

export function meetsCriteria(criteria: AchievementCriteria, facts: AchievementFacts) {
  switch (criteria.tipo) {
    case "CONTENTS_COMPLETED":
      return facts.contentsCompleted >= criteria.minimo;
    case "TRACKS_COMPLETED":
      return facts.tracksCompleted >= criteria.minimo;
    case "ONBOARDING_COMPLETED":
      return facts.onboardingCompleted;
    case "TRACK_COMPLETED":
      return facts.completedTrackIds.has(criteria.trilhaId);
  }
}

export function describeCriteria(criteria: AchievementCriteria | null, trackTitle?: string) {
  if (!criteria) return "Critério inválido";
  switch (criteria.tipo) {
    case "CONTENTS_COMPLETED":
      return criteria.minimo === 1 ? "Concluir 1 conteúdo" : `Concluir ${criteria.minimo} conteúdos`;
    case "TRACKS_COMPLETED":
      return criteria.minimo === 1 ? "Concluir 1 trilha" : `Concluir ${criteria.minimo} trilhas`;
    case "ONBOARDING_COMPLETED":
      return "Concluir uma trilha de onboarding";
    case "TRACK_COMPLETED":
      return `Concluir a trilha “${trackTitle ?? "removida"}”`;
  }
}

export const POINT_EVENT_LABEL: Record<string, string> = {
  CONTENT_VIDEO: "Concluir um vídeo",
  CONTENT_READING: "Concluir uma leitura (PDF, manual ou pergunta frequente)",
  CONTENT_OTHER: "Concluir imagem ou link",
  MODULE_COMPLETED: "Finalizar uma etapa",
  TRACK_COMPLETED: "Finalizar uma trilha",
  ACHIEVEMENT: "Conquista",
  MANUAL_ADJUSTMENT: "Ajuste manual",
};
