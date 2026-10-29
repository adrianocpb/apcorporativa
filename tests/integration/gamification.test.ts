import { describe, expect, it } from "vitest";
import { db, makeActor, makeUser, setupTestDb } from "../support/db";
import { ForbiddenError } from "@/server/errors";
import type { SessionUser } from "@/server/auth/sessions";
import { createSession, validateSessionToken } from "@/server/auth/sessions";
import { createContent, publishContent, saveDraft } from "@/server/services/contents";
import { confirmCompletion, openItem } from "@/server/services/learning";
import { addItems, addModule, assignTrack, createTrack, getTrackForEdit, setTrackStatus } from "@/server/services/tracks";
import {
  adjustPoints,
  deleteLevel,
  getLevelInfo,
  getMyGamification,
  saveAchievement,
  saveLevel,
  totalPoints,
  updatePointRules,
} from "@/server/services/gamification";
import { levelFor } from "@/lib/gamification";

setupTestDb();

const doc = (text: string) =>
  JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

async function learnerOf(userId: string): Promise<SessionUser> {
  const { token } = await createSession(db, userId);
  return (await validateSessionToken(db, token))!.user;
}

/** Trilha de onboarding: Etapa 1 [A, B] → Etapa 2 [C], todos artigos (leitura = 10 pts). */
async function setup(opts: { onboarding?: boolean; articles?: number } = {}) {
  const admin = await makeActor();
  const n = opts.articles ?? 3;
  const contents = [];
  for (let i = 0; i < n; i++) {
    const c = await createContent(db, admin, "ARTICLE", { title: `Artigo ${i + 1}`, body: doc(`texto ${i}`) });
    await publishContent(db, admin, c.id);
    contents.push(c);
  }
  const track = await createTrack(db, admin, {
    title: "Onboarding",
    sequential: "on",
    isOnboarding: opts.onboarding === false ? "" : "on",
    minReadSeconds: "0",
  });
  const m1 = (await getTrackForEdit(db, admin, track.id)).modules[0];
  await addItems(db, admin, m1.id, contents.slice(0, n - 1).map((c) => c.id));
  const m2 = await addModule(db, admin, track.id, { title: "Etapa final" });
  await addItems(db, admin, m2.id, [contents[n - 1].id]);
  await setTrackStatus(db, admin, track.id, "publish");
  const user = await makeUser();
  await assignTrack(db, admin, track.id, { userIds: [user.id] });
  const learner = await learnerOf(user.id);
  const items = (await getTrackForEdit(db, admin, track.id)).modules.flatMap((m) => m.items);
  const complete = async (index: number) => {
    await openItem(db, learner, track.id, items[index].id);
    return confirmCompletion(db, learner, track.id, items[index].id);
  };
  return { admin, learner, track, items, contents, complete };
}

describe("pontuação", () => {
  it("concede pontos por conteúdo, etapa e trilha, com origem registrada", async () => {
    const { learner, complete } = await setup({ onboarding: false });
    const first = await complete(0);
    expect(first.reward?.points).toBe(10);
    await complete(1); // conclui a etapa 1: 10 + 20
    const last = await complete(2); // conclui a etapa 2 e a trilha: 10 + 20 + 50 + conquista "Primeira trilha" (30)
    expect(last.reward?.points).toBe(10 + 20 + 50 + 30);
    expect(await totalPoints(db, learner.id)).toBe(10 + 10 + 20 + 10 + 20 + 50 + 30);

    const history = await db.pointTransaction.findMany({ where: { userId: learner.id } });
    expect(new Set(history.map((h) => h.event))).toEqual(
      new Set(["CONTENT_READING", "MODULE_COMPLETED", "TRACK_COMPLETED", "ACHIEVEMENT"]),
    );
    expect(history.every((h) => h.description && h.sourceId && h.createdAt)).toBe(true);
  });

  it("não pontua de novo ao rever, confirmar outra vez ou reconcluir após mudança relevante", async () => {
    const { admin, learner, contents, complete } = await setup({ onboarding: false });
    await complete(0);
    const again = await complete(0);
    expect(again.reward).toBeUndefined();
    await saveDraft(db, admin, contents[0].id, { title: "Artigo 1", body: doc("v2") });
    await publishContent(db, admin, contents[0].id, { requiresRecompletion: "on" });
    const re = await complete(0);
    expect(re.contentCompleted).toBe(true);
    expect(re.reward?.points).toBe(0);
    expect(await totalPoints(db, learner.id)).toBe(10);
  });

  it("sinais simultâneos não duplicam pontos", async () => {
    const { learner, track, items } = await setup({ onboarding: false });
    await openItem(db, learner, track.id, items[0].id);
    await Promise.all([
      confirmCompletion(db, learner, track.id, items[0].id),
      confirmCompletion(db, learner, track.id, items[0].id),
      confirmCompletion(db, learner, track.id, items[0].id),
    ]);
    expect(await db.pointTransaction.count({ where: { userId: learner.id, event: "CONTENT_READING" } })).toBe(1);
  });

  it("respeita as regras configuradas pelo administrador", async () => {
    const { admin, learner, complete } = await setup({ onboarding: false });
    await updatePointRules(db, admin, {
      points_CONTENT_READING: "25",
      active_CONTENT_READING: "on",
      points_MODULE_COMPLETED: "20",
      // etapa desativada (sem "active_")
    });
    await complete(0);
    await complete(1);
    expect(await totalPoints(db, learner.id)).toBe(50);
    await expect(updatePointRules(db, admin, { points_CONTENT_READING: "-5" })).rejects.toMatchObject({
      fieldErrors: { points_CONTENT_READING: expect.any(String) },
    });
  });
});

describe("níveis", () => {
  it("calcula nível, próximo nível e progresso", () => {
    const levels = [
      { id: "1", number: 1, name: "Explorador", minPoints: 0 },
      { id: "2", number: 2, name: "Aprendiz", minPoints: 100 },
    ];
    expect(levelFor(levels, 40)).toMatchObject({ current: { name: "Explorador" }, pointsToNext: 60, progress: 40 });
    expect(levelFor(levels, 150)).toMatchObject({ current: { name: "Aprendiz" }, next: null, progress: 100 });
  });

  it("avisa ao subir de nível", async () => {
    const { learner, complete } = await setup({ onboarding: false });
    const result = await complete(0); // 10 pontos: continua Explorador
    expect(result.reward?.levelUp).toBeNull();
    await complete(1);
    const final = await complete(2); // 150 pontos: Aprendiz
    expect(final.reward?.levelUp).toEqual({ number: 2, name: "Aprendiz" });
    expect((await getLevelInfo(db, learner.id)).current?.name).toBe("Aprendiz");
    expect(await db.notification.count({ where: { userId: learner.id, type: "nivel" } })).toBe(1);
  });

  it("administrador reorganiza níveis; o inicial não pode sair de 0 nem ser excluído", async () => {
    const admin = await makeActor();
    const initial = await db.level.findFirstOrThrow({ where: { minPoints: 0 } });
    await expect(saveLevel(db, admin, initial.id, { name: "Início", minPoints: "10" })).rejects.toThrow();
    await expect(deleteLevel(db, admin, initial.id)).rejects.toThrow(/inicial/);
    await saveLevel(db, admin, null, { name: "Novato", minPoints: "50" });
    const levels = await db.level.findMany({ orderBy: { number: "asc" } });
    expect(levels.slice(0, 3).map((l) => l.name)).toEqual(["Explorador", "Novato", "Aprendiz"]);
    expect(levels.map((l) => l.number)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("conquistas", () => {
  it("atribui automaticamente onboarding e primeiros conteúdos, uma única vez", async () => {
    const { learner, complete } = await setup({ onboarding: true, articles: 5 });
    for (let i = 0; i < 5; i++) await complete(i);
    const mine = await getMyGamification(db, learner);
    expect(mine.earned.map((e) => e.achievement.name).sort()).toEqual(
      ["Bem-vindo a bordo", "Primeira trilha", "Primeiros passos"].sort(),
    );
    expect(await db.pointTransaction.count({ where: { userId: learner.id, event: "ACHIEVEMENT" } })).toBe(3);
    expect(await db.notification.count({ where: { userId: learner.id, type: "conquista" } })).toBe(3);
  });

  it("conquista por trilha específica criada pelo administrador", async () => {
    const { admin, learner, track, complete } = await setup({ onboarding: false });
    await saveAchievement(db, admin, null, {
      name: "Especialista em ERP",
      description: "Concluiu a trilha do ERP.",
      type: "TRACK_COMPLETED",
      trackId: track.id,
      points: "40",
      active: "on",
    });
    for (let i = 0; i < 3; i++) await complete(i);
    const mine = await getMyGamification(db, learner);
    expect(mine.earned.map((e) => e.achievement.name)).toContain("Especialista em ERP");
  });
});

describe("controle", () => {
  it("ajuste manual é um novo lançamento com motivo e auditoria", async () => {
    const admin = await makeActor();
    const user = await makeUser();
    await adjustPoints(db, admin, { userId: user.id, points: "-15", reason: "Correção de lançamento" });
    expect(await totalPoints(db, user.id)).toBe(-15);
    const log = await db.auditLog.findFirstOrThrow({ where: { action: "gamificacao.pontos_ajustados" } });
    expect(log.entityId).toBe(user.id);
    await expect(adjustPoints(db, admin, { userId: user.id, points: "5", reason: "" })).rejects.toMatchObject({
      fieldErrors: { reason: expect.any(String) },
    });
  });

  it("colaborador não altera pontos, níveis nem regras", async () => {
    const colaborador = await makeActor("COLABORADOR");
    await expect(adjustPoints(db, colaborador, { userId: colaborador.id, points: "1000", reason: "Quero subir" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(updatePointRules(db, colaborador, {})).rejects.toBeInstanceOf(ForbiddenError);
    await expect(saveLevel(db, colaborador, null, { name: "X", minPoints: "1" })).rejects.toBeInstanceOf(ForbiddenError);
    expect(await totalPoints(db, colaborador.id)).toBe(0);
  });

  it("notifica quando uma trilha é atribuída", async () => {
    const { learner } = await setup();
    const n = await db.notification.findFirstOrThrow({ where: { userId: learner.id, type: "trilha" } });
    expect(n.title).toContain("Onboarding");
  });
});
