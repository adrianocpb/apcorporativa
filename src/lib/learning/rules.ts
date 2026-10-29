// Regras de aprendizagem sem acesso ao banco: desbloqueio sequencial, estado de cada item
// e validação do progresso de vídeo. Testadas em tests/unit/learning-rules.test.ts.

export type ItemState = "LOCKED" | "AVAILABLE" | "IN_PROGRESS" | "COMPLETED";

export type RuleItem = {
  id: string;
  moduleId: string;
  required: boolean;
  /** Conteúdo arquivado: some da trilha para quem não o concluiu e deixa de ser obrigatório. */
  archived: boolean;
  completed: boolean;
  /** Já foi concluído antes, mas uma mudança relevante pede nova conclusão. */
  needsRecompletion: boolean;
  started: boolean;
};

export type RuleModule = { id: string; itemIds: string[] };

export type ComputedItem = RuleItem & { state: ItemState; counts: boolean };

export type TrackComputation = {
  items: ComputedItem[];
  modules: { id: string; completed: boolean; requiredCount: number; completedCount: number }[];
  requiredCount: number;
  completedRequiredCount: number;
  percent: number;
  completed: boolean;
  nextItemId: string | null;
};

/**
 * Calcula o estado de cada item da trilha (na ordem etapa → item).
 * - Trilha livre: tudo disponível.
 * - Sequencial: um item fica disponível quando todos os obrigatórios anteriores estão
 *   concluídos — ou se a pessoa já o iniciou/concluiu (reordenar a trilha nunca bloqueia
 *   de novo algo que ela já alcançou).
 * - Trilha já concluída não é reaberta por mudanças posteriores.
 */
export function computeTrackState(
  modules: RuleModule[],
  itemsById: Map<string, RuleItem>,
  options: { sequential: boolean; enrollmentCompleted: boolean },
): TrackComputation {
  const ordered = modules.flatMap((m) =>
    m.itemIds.map((id) => itemsById.get(id)).filter((i): i is RuleItem => !!i),
  );
  // Itens arquivados só aparecem para quem já os concluiu (como histórico).
  const visible = ordered.filter((i) => !i.archived || i.completed);

  let blockedFromHere = false;
  const items: ComputedItem[] = visible.map((item) => {
    const done = item.completed && (!item.needsRecompletion || options.enrollmentCompleted);
    const counts = item.required && !item.archived;
    let state: ItemState;
    if (done) state = "COMPLETED";
    else if (!options.sequential || !blockedFromHere || item.started) {
      state = item.started ? "IN_PROGRESS" : "AVAILABLE";
    } else state = "LOCKED";
    if (counts && !done) blockedFromHere = true;
    return { ...item, state, counts };
  });

  const byModule = modules.map((m) => {
    const moduleItems = items.filter((i) => i.moduleId === m.id && i.counts);
    const completedCount = moduleItems.filter((i) => i.state === "COMPLETED").length;
    return {
      id: m.id,
      requiredCount: moduleItems.length,
      completedCount,
      completed: moduleItems.length > 0 && completedCount === moduleItems.length,
    };
  });

  const required = items.filter((i) => i.counts);
  const completedRequired = required.filter((i) => i.state === "COMPLETED").length;
  const completed =
    options.enrollmentCompleted || (required.length > 0 && completedRequired === required.length);
  const next =
    items.find((i) => i.state === "IN_PROGRESS") ??
    items.find((i) => i.state === "AVAILABLE" && i.counts) ??
    items.find((i) => i.state === "AVAILABLE");

  return {
    items,
    modules: byModule,
    requiredCount: required.length,
    completedRequiredCount: completedRequired,
    percent: completed ? 100 : required.length ? Math.round((completedRequired / required.length) * 100) : 0,
    completed,
    nextItemId: completed ? null : (next?.id ?? null),
  };
}

// ---------------------------------------------------------------------------
// Vídeo: o navegador informa trechos assistidos; o servidor só aceita o que cabe no
// tempo real decorrido (velocidade máxima de reprodução) e soma intervalos sem repetir.
// ---------------------------------------------------------------------------

export type Range = [number, number];

export const HEARTBEAT = {
  maxPlaybackRate: 2,
  toleranceSeconds: 3,
  /** Tempo máximo considerado entre dois sinais: esperar não "acumula" crédito. */
  maxElapsedSeconds: 30,
  /** Primeiro sinal da sessão: sem referência anterior. */
  firstElapsedSeconds: 15,
};

export function mergeRanges(ranges: Range[]): Range[] {
  const sorted = ranges
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b > a)
    .sort((x, y) => x[0] - y[0]);
  const out: Range[] = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1] + 0.5) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

export function coveredSeconds(ranges: Range[]) {
  return ranges.reduce((sum, [a, b]) => sum + (b - a), 0);
}

export function applyHeartbeat(
  current: { ranges: Range[]; lastHeartbeatAt: Date | null; duration: number },
  beat: { from: number; to: number; at: Date },
) {
  const duration = current.duration;
  const from = Math.max(0, Math.min(beat.from, duration));
  let to = Math.max(0, Math.min(beat.to, duration));
  if (!(to > from)) {
    return { ranges: current.ranges, acceptedSeconds: 0, truncated: false };
  }
  const elapsed = current.lastHeartbeatAt
    ? Math.max(0, (beat.at.getTime() - current.lastHeartbeatAt.getTime()) / 1000)
    : HEARTBEAT.firstElapsedSeconds;
  const allowed =
    Math.min(elapsed, HEARTBEAT.maxElapsedSeconds) * HEARTBEAT.maxPlaybackRate + HEARTBEAT.toleranceSeconds;
  const truncated = to - from > allowed;
  if (truncated) to = from + allowed;
  const before = coveredSeconds(current.ranges);
  const ranges = mergeRanges([...current.ranges, [from, to]]);
  return { ranges, acceptedSeconds: coveredSeconds(ranges) - before, truncated };
}

export function coveragePercent(ranges: Range[], duration: number) {
  if (!(duration > 0)) return 0;
  return Math.min(100, (coveredSeconds(ranges) / duration) * 100);
}
