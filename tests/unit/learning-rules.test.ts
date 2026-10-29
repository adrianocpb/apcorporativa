import { describe, expect, it } from "vitest";
import {
  applyHeartbeat,
  computeTrackState,
  coveragePercent,
  mergeRanges,
  type RuleItem,
} from "@/lib/learning/rules";

function item(id: string, moduleId: string, patch: Partial<RuleItem> = {}): RuleItem {
  return {
    id,
    moduleId,
    required: true,
    archived: false,
    completed: false,
    needsRecompletion: false,
    started: false,
    ...patch,
  };
}

const modules = [
  { id: "m1", itemIds: ["a", "b"] },
  { id: "m2", itemIds: ["c"] },
];

function state(items: RuleItem[], sequential = true, enrollmentCompleted = false) {
  return computeTrackState(modules, new Map(items.map((i) => [i.id, i])), {
    sequential,
    enrollmentCompleted,
  });
}

const states = (r: ReturnType<typeof state>) => Object.fromEntries(r.items.map((i) => [i.id, i.state]));

describe("desbloqueio sequencial", () => {
  it("começa pelo primeiro item e bloqueia os seguintes", () => {
    const r = state([item("a", "m1"), item("b", "m1"), item("c", "m2")]);
    expect(states(r)).toEqual({ a: "AVAILABLE", b: "LOCKED", c: "LOCKED" });
    expect(r.nextItemId).toBe("a");
    expect(r.percent).toBe(0);
  });

  it("concluir libera o próximo, inclusive na etapa seguinte", () => {
    const r = state([
      item("a", "m1", { completed: true }),
      item("b", "m1", { completed: true }),
      item("c", "m2"),
    ]);
    expect(states(r)).toEqual({ a: "COMPLETED", b: "COMPLETED", c: "AVAILABLE" });
    expect(r.modules[0].completed).toBe(true);
    expect(r.modules[1].completed).toBe(false);
    expect(r.percent).toBe(67);
  });

  it("item opcional não bloqueia os seguintes", () => {
    const r = state([item("a", "m1", { required: false }), item("b", "m1"), item("c", "m2")]);
    expect(states(r)).toEqual({ a: "AVAILABLE", b: "AVAILABLE", c: "LOCKED" });
    expect(r.requiredCount).toBe(2);
  });

  it("trilha de acesso livre não bloqueia nada", () => {
    const r = state([item("a", "m1"), item("b", "m1"), item("c", "m2")], false);
    expect(Object.values(states(r))).toEqual(["AVAILABLE", "AVAILABLE", "AVAILABLE"]);
  });

  it("reordenar não bloqueia de novo o que a pessoa já alcançou", () => {
    // "c" foi iniciado antes de a trilha ser reordenada para depois de itens pendentes.
    const r = state([item("a", "m1"), item("b", "m1"), item("c", "m2", { started: true })]);
    expect(states(r)).toEqual({ a: "AVAILABLE", b: "LOCKED", c: "IN_PROGRESS" });
    expect(r.nextItemId).toBe("c");
  });

  it("conteúdo arquivado deixa de ser obrigatório e some para quem não concluiu", () => {
    const r = state([item("a", "m1", { archived: true }), item("b", "m1"), item("c", "m2")]);
    expect(states(r)).toEqual({ b: "AVAILABLE", c: "LOCKED" });
    const done = state([item("a", "m1", { archived: true, completed: true }), item("b", "m1"), item("c", "m2")]);
    expect(states(done).a).toBe("COMPLETED");
    expect(done.requiredCount).toBe(2);
  });

  it("mudança relevante reabre o item em trilha em andamento, mas não em trilha concluída", () => {
    const items = [
      item("a", "m1", { completed: true, needsRecompletion: true }),
      item("b", "m1", { completed: true }),
      item("c", "m2", { completed: true }),
    ];
    const inProgress = state(items);
    expect(states(inProgress).a).toBe("AVAILABLE");
    expect(inProgress.completed).toBe(false);
    const finished = state(items, true, true);
    expect(states(finished).a).toBe("COMPLETED");
    expect(finished.completed).toBe(true);
    expect(finished.percent).toBe(100);
  });
});

describe("progresso de vídeo", () => {
  const t0 = new Date("2026-10-29T12:00:00Z");
  const at = (s: number) => new Date(t0.getTime() + s * 1000);

  it("aceita trechos compatíveis com o tempo real e soma sem repetir", () => {
    let cur = { ranges: [] as [number, number][], lastHeartbeatAt: null as Date | null, duration: 100 };
    let r = applyHeartbeat(cur, { from: 0, to: 10, at: at(10) });
    expect(r.acceptedSeconds).toBe(10);
    cur = { ...cur, ranges: r.ranges, lastHeartbeatAt: at(10) };
    r = applyHeartbeat(cur, { from: 10, to: 20, at: at(20) });
    cur = { ...cur, ranges: r.ranges, lastHeartbeatAt: at(20) };
    // Rever o mesmo trecho não conta de novo.
    r = applyHeartbeat(cur, { from: 0, to: 20, at: at(40) });
    expect(r.acceptedSeconds).toBe(0);
    expect(r.ranges).toEqual([[0, 20]]);
  });

  it("corta trechos impossíveis (pular para o fim, acelerar além de 2x)", () => {
    const r = applyHeartbeat(
      { ranges: [], lastHeartbeatAt: t0, duration: 600 },
      { from: 0, to: 600, at: at(5) },
    );
    expect(r.truncated).toBe(true);
    expect(r.acceptedSeconds).toBe(5 * 2 + 3);
  });

  it("esperar com a página aberta não acumula crédito", () => {
    const r = applyHeartbeat(
      { ranges: [], lastHeartbeatAt: t0, duration: 3600 },
      { from: 0, to: 3600, at: at(3600) },
    );
    expect(r.acceptedSeconds).toBe(30 * 2 + 3);
  });

  it("ignora valores fora da duração e trechos invertidos", () => {
    const base = { ranges: [] as [number, number][], lastHeartbeatAt: t0, duration: 50 };
    expect(applyHeartbeat(base, { from: 40, to: 10, at: at(10) }).acceptedSeconds).toBe(0);
    expect(applyHeartbeat(base, { from: -20, to: 5, at: at(10) }).ranges).toEqual([[0, 5]]);
    expect(applyHeartbeat(base, { from: 45, to: 90, at: at(10) }).ranges).toEqual([[45, 50]]);
  });

  it("calcula cobertura com intervalos unidos", () => {
    expect(mergeRanges([[10, 20], [0, 5], [4, 12], [30, 31]])).toEqual([[0, 20], [30, 31]]);
    expect(coveragePercent([[0, 45], [50, 95]], 100)).toBe(90);
    expect(coveragePercent([[0, 10]], 0)).toBe(0);
  });
});
