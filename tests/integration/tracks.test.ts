import { afterEach, describe, expect, it, vi } from "vitest";
import { db, makeActor, makeUser, setupTestDb } from "../support/db";
import { makeMp4, streamOf, tempStorage } from "../support/files";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import type { SessionUser } from "@/server/auth/sessions";
import { createSession, validateSessionToken } from "@/server/auth/sessions";
import { createContent, publishContent, saveDraft, setContentArchived } from "@/server/services/contents";
import { storeUpload } from "@/server/services/files";
import { addGroupMembers, createGroup } from "@/server/services/groups";
import {
  confirmCompletion,
  getItemForLearner,
  getMyTracks,
  getTrackForLearner,
  LockedError,
  openItem,
  recordVideoHeartbeat,
} from "@/server/services/learning";
import {
  addItems,
  addModule,
  assignTrack,
  createTrack,
  getTrackForEdit,
  getTrackProgress,
  removeAssignment,
  reorderTrack,
  setTrackStatus,
  updateItem,
} from "@/server/services/tracks";

setupTestDb();
afterEach(() => vi.useRealTimers());

const doc = (text: string) =>
  JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

async function sessionUserOf(userId: string): Promise<SessionUser> {
  const { token } = await createSession(db, userId);
  return (await validateSessionToken(db, token))!.user;
}

async function published(admin: SessionUser, type: "ARTICLE" | "FAQ" | "LINK", title: string) {
  const fields = type === "LINK" ? { title, url: "https://portal.empresa.test" } : { title, body: doc(title) };
  const c = await createContent(db, admin, type, fields);
  await publishContent(db, admin, c.id);
  return c;
}

/** Trilha: Etapa 1 [A artigo, B FAQ] → Etapa 2 [C link (abre e conclui)]. */
async function buildTrack(opts: { minReadSeconds?: number; sequential?: boolean } = {}) {
  const admin = await makeActor();
  const a = await published(admin, "ARTICLE", "Boas-vindas");
  const b = await published(admin, "FAQ", "Como pedir acesso?");
  const c = await published(admin, "LINK", "Portal do RH");
  const track = await createTrack(db, admin, {
    title: "Onboarding institucional",
    sequential: opts.sequential === false ? "" : "on",
    isOnboarding: "on",
    minReadSeconds: String(opts.minReadSeconds ?? 0),
  });
  const edit = await getTrackForEdit(db, admin, track.id);
  const m1 = edit.modules[0];
  await addItems(db, admin, m1.id, [a.id, b.id]);
  const m2 = await addModule(db, admin, track.id, { title: "Etapa 2" });
  await addItems(db, admin, m2.id, [c.id]);
  await setTrackStatus(db, admin, track.id, "publish");
  const collab = await makeUser();
  await assignTrack(db, admin, track.id, { userIds: [collab.id] });
  const learner = await sessionUserOf(collab.id);
  const items = (await getTrackForEdit(db, admin, track.id)).modules.flatMap((m) => m.items);
  const [ia, ib, ic] = items;
  return { admin, learner, track, ia, ib, ic, contents: { a, b, c } };
}

const stateOf = async (learner: SessionUser, trackId: string) =>
  Object.fromEntries(
    (await getTrackForLearner(db, learner, trackId)).state.items.map((i) => [i.id, i.state]),
  );

describe("desbloqueio sequencial", () => {
  it("bloqueia etapas futuras e libera após conclusão válida", async () => {
    const { learner, track, ia, ib, ic } = await buildTrack();
    expect(await stateOf(learner, track.id)).toEqual({ [ia.id]: "AVAILABLE", [ib.id]: "LOCKED", [ic.id]: "LOCKED" });

    // O servidor recusa abrir, concluir ou ver itens bloqueados, mesmo por chamada direta.
    await expect(getItemForLearner(db, learner, track.id, ib.id)).rejects.toBeInstanceOf(LockedError);
    await expect(openItem(db, learner, track.id, ib.id)).rejects.toBeInstanceOf(LockedError);
    await expect(confirmCompletion(db, learner, track.id, ib.id)).rejects.toBeInstanceOf(LockedError);

    await openItem(db, learner, track.id, ia.id);
    await confirmCompletion(db, learner, track.id, ia.id);
    expect(await stateOf(learner, track.id)).toEqual({ [ia.id]: "COMPLETED", [ib.id]: "AVAILABLE", [ic.id]: "LOCKED" });

    await openItem(db, learner, track.id, ib.id);
    const ev = await confirmCompletion(db, learner, track.id, ib.id);
    expect(ev.modulesCompleted).toHaveLength(1);

    // Link com regra "abrir conclui": a trilha termina.
    const last = await openItem(db, learner, track.id, ic.id);
    expect(last?.trackCompleted).toBe(true);
    const enrollment = await db.enrollment.findFirstOrThrow({ where: { trackId: track.id, userId: learner.id } });
    expect(enrollment.status).toBe("COMPLETED");
    expect(enrollment.completedAt).not.toBeNull();
  });

  it("trilha de acesso livre não bloqueia", async () => {
    const { learner, track, ic } = await buildTrack({ sequential: false });
    await openItem(db, learner, track.id, ic.id);
    expect((await stateOf(learner, track.id))[ic.id]).toBe("COMPLETED");
  });

  it("item opcional não segura a sequência", async () => {
    const { admin, learner, track, ia, ib } = await buildTrack();
    await updateItem(db, admin, ia.id, { required: false, completionRule: "CONFIRM" });
    expect((await stateOf(learner, track.id))[ib.id]).toBe("AVAILABLE");
  });
});

describe("conclusão validada no servidor", () => {
  it("exige o tempo mínimo de leitura antes da confirmação", async () => {
    const { learner, track, ia } = await buildTrack({ minReadSeconds: 30 });
    await expect(confirmCompletion(db, learner, track.id, ia.id)).rejects.toThrow(/Abra o conteúdo/);
    await openItem(db, learner, track.id, ia.id);
    await expect(confirmCompletion(db, learner, track.id, ia.id)).rejects.toThrow(/faltam/);
    await db.contentProgress.updateMany({ data: { openedAt: new Date(Date.now() - 31_000) } });
    await confirmCompletion(db, learner, track.id, ia.id);
  });

  it("não registra conclusão nem pontos duplicados ao confirmar de novo", async () => {
    const { learner, track, ia } = await buildTrack();
    await openItem(db, learner, track.id, ia.id);
    const first = await confirmCompletion(db, learner, track.id, ia.id);
    const second = await confirmCompletion(db, learner, track.id, ia.id);
    expect(first.contentCompleted).toBe(true);
    expect(second.contentCompleted).toBe(false);
    expect(await db.completionRecord.count({ where: { userId: learner.id } })).toBe(1);
  });

  it("vídeo: só conclui com o trecho realmente assistido, usando a duração lida do arquivo", async () => {
    const admin = await makeActor();
    const { storage } = tempStorage();
    const file = await storeUpload(
      db,
      admin,
      { kind: "VIDEO", originalName: "boas-vindas.mp4", stream: streamOf(makeMp4(100)) },
      { storage },
    );
    expect(file.durationSeconds).toBe(100);
    const video = await createContent(db, admin, "VIDEO", { title: "Vídeo do CEO", fileId: file.id });
    await publishContent(db, admin, video.id);
    const track = await createTrack(db, admin, { title: "Trilha com vídeo", sequential: "on" });
    const mod = (await getTrackForEdit(db, admin, track.id)).modules[0];
    await addItems(db, admin, mod.id, [video.id]);
    await setTrackStatus(db, admin, track.id, "publish");
    const user = await makeUser();
    await assignTrack(db, admin, track.id, { userIds: [user.id] });
    const learner = await sessionUserOf(user.id);
    const item = (await getTrackForEdit(db, admin, track.id)).modules[0].items[0];

    vi.useFakeTimers({ toFake: ["Date"] });
    let now = new Date("2026-11-03T12:00:00Z").getTime();
    vi.setSystemTime(now);
    await openItem(db, learner, track.id, item.id);

    // Tenta "pular" para o fim informando duração falsa de 10 s: o servidor usa 100 s.
    now += 10_000;
    vi.setSystemTime(now);
    let r = await recordVideoHeartbeat(db, learner, track.id, item.id, { from: 0, to: 100, position: 100, duration: 10 });
    expect(r.completed).toBe(false);
    expect(r.coverage).toBeLessThan(30);

    // Assiste de verdade, com um sinal a cada 10 s.
    for (let t = 10; t < 100; t += 10) {
      now += 10_000;
      vi.setSystemTime(now);
      r = await recordVideoHeartbeat(db, learner, track.id, item.id, { from: t, to: t + 10, position: t + 10, duration: 100 });
    }
    expect(r.completed).toBe(true);
    const record = await db.completionRecord.findFirstOrThrow({ where: { userId: user.id } });
    expect(record.method).toBe("VIDEO_WATCHED");
    const progress = await db.contentProgress.findFirstOrThrow({ where: { userId: user.id } });
    expect(progress.positionSeconds).toBe(100); // retomada
  });
});

describe("persistência, retomada e histórico", () => {
  it("guarda onde a pessoa parou e indica a próxima ação", async () => {
    const { learner, track, ia } = await buildTrack();
    await openItem(db, learner, track.id, ia.id);
    const mine = await getMyTracks(db, learner);
    expect(mine.next?.track.id).toBe(track.id);
    expect(mine.next?.nextItem?.id).toBe(ia.id);
    expect((await stateOf(learner, track.id))[ia.id]).toBe("IN_PROGRESS");
    const enrollment = await db.enrollment.findFirstOrThrow({ where: { trackId: track.id } });
    expect(enrollment.status).toBe("IN_PROGRESS");
    expect(enrollment.lastItemId).toBe(ia.id);
  });

  it("concluído não precisa ser revisto; mudança relevante reabre só trilha em andamento", async () => {
    const { admin, learner, track, ia, contents } = await buildTrack();
    await openItem(db, learner, track.id, ia.id);
    await confirmCompletion(db, learner, track.id, ia.id);

    // Nova versão sem mudança relevante: continua concluído.
    await saveDraft(db, admin, contents.a.id, { title: "Boas-vindas", body: doc("v2") });
    await publishContent(db, admin, contents.a.id);
    expect((await stateOf(learner, track.id))[ia.id]).toBe("COMPLETED");

    // Mudança relevante: volta a ficar disponível, e a conclusão antiga continua no histórico.
    await saveDraft(db, admin, contents.a.id, { title: "Boas-vindas", body: doc("v3") });
    await publishContent(db, admin, contents.a.id, { requiresRecompletion: "on" });
    expect((await stateOf(learner, track.id))[ia.id]).toBe("AVAILABLE");
    expect(await db.completionRecord.count({ where: { userId: learner.id, contentId: contents.a.id } })).toBe(1);
  });

  it("conteúdos continuam acessíveis após concluir, mesmo com a trilha arquivada", async () => {
    const { admin, learner, track, ia, ib, ic } = await buildTrack();
    for (const it of [ia, ib, ic]) {
      await openItem(db, learner, track.id, it.id);
      if (it !== ic) await confirmCompletion(db, learner, track.id, it.id);
    }
    await setTrackStatus(db, admin, track.id, "archive");
    const mine = await getMyTracks(db, learner);
    expect(mine.completed.map((t) => t.track.id)).toEqual([track.id]);
    const view = await getItemForLearner(db, learner, track.id, ia.id);
    expect(view.computed.state).toBe("COMPLETED");
    expect(view.version.bodyHtml).toContain("Boas-vindas");
  });

  it("conteúdo arquivado deixa de bloquear a trilha", async () => {
    const { admin, learner, track, ib, contents } = await buildTrack();
    await setContentArchived(db, admin, contents.a.id, true);
    expect((await stateOf(learner, track.id))[ib.id]).toBe("AVAILABLE");
  });
});

describe("atribuição", () => {
  it("por grupo: novos membros recebem a trilha; remover atribuição preserva concluídos", async () => {
    const { admin, track } = await buildTrack();
    const group = await createGroup(db, admin, { name: "Turma de novembro", description: "" });
    await assignTrack(db, admin, track.id, { groupIds: [group.id] });
    const newcomer = await makeUser();
    await addGroupMembers(db, admin, group.id, [newcomer.id]);
    const learner = await sessionUserOf(newcomer.id);
    expect((await getMyTracks(db, learner)).tracks.map((t) => t.track.id)).toEqual([track.id]);
    expect(await db.enrollment.count({ where: { trackId: track.id, removedAt: null } })).toBe(2);

    const assignment = (await getTrackForEdit(db, admin, track.id)).assignments.find((a) => a.groupId)!;
    await removeAssignment(db, admin, assignment.id);
    expect((await getMyTracks(db, learner)).tracks).toHaveLength(0);
    await expect(getTrackForLearner(db, learner, track.id)).rejects.toBeInstanceOf(NotFoundError);
    // A matrícula não é apagada (histórico).
    expect(await db.enrollment.count({ where: { trackId: track.id, userId: newcomer.id } })).toBe(1);
  });

  it("trilha em rascunho não aparece para o colaborador", async () => {
    const admin = await makeActor();
    const a = await published(admin, "ARTICLE", "Texto");
    const track = await createTrack(db, admin, { title: "Rascunho" });
    await addItems(db, admin, (await getTrackForEdit(db, admin, track.id)).modules[0].id, [a.id]);
    const user = await makeUser();
    await assignTrack(db, admin, track.id, { userIds: [user.id] });
    expect((await getMyTracks(db, await sessionUserOf(user.id))).tracks).toHaveLength(0);
  });

  it("relatório mostra percentual e onde cada pessoa parou", async () => {
    const { admin, learner, track, ia, ib } = await buildTrack();
    await openItem(db, learner, track.id, ia.id);
    await confirmCompletion(db, learner, track.id, ia.id);
    const [row] = await getTrackProgress(db, admin, track.id);
    expect(row.percent).toBe(33);
    expect(row.currentItem?.title).toBe("Como pedir acesso?");
    expect(ib.id).toBeTruthy();
  });
});

describe("administração", () => {
  it("valida estrutura ao reordenar e só publica com conteúdo", async () => {
    const admin = await makeActor();
    const track = await createTrack(db, admin, { title: "Vazia" });
    await expect(setTrackStatus(db, admin, track.id, "publish")).rejects.toThrow(/ao menos um conteúdo/);
    await expect(reorderTrack(db, admin, track.id, [{ moduleId: "x", itemIds: [] }])).rejects.toThrow(/Recarregue/);
  });

  it("não adiciona rascunho nem o mesmo conteúdo duas vezes", async () => {
    const admin = await makeActor();
    const draft = await createContent(db, admin, "ARTICLE", { title: "Rascunho", body: doc("x") });
    const ok = await published(admin, "ARTICLE", "Publicado");
    const track = await createTrack(db, admin, { title: "T" + "rilha" });
    const mod = (await getTrackForEdit(db, admin, track.id)).modules[0];
    await expect(addItems(db, admin, mod.id, [draft.id])).rejects.toThrow(/publicados/);
    await addItems(db, admin, mod.id, [ok.id]);
    await expect(addItems(db, admin, mod.id, [ok.id])).rejects.toThrow(/já está/);
  });

  it("colaborador não administra trilhas nem vê trilha que não é dele", async () => {
    const { learner, track } = await buildTrack();
    await expect(createTrack(db, learner, { title: "Minha" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(assignTrack(db, learner, track.id, { userIds: [learner.id] })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getTrackProgress(db, learner, track.id)).rejects.toBeInstanceOf(ForbiddenError);
    const outsider = await sessionUserOf((await makeUser()).id);
    await expect(getTrackForLearner(db, outsider, track.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("ordem de exibição", () => {
  it("novas trilhas vão para o fim; o administrador reordena; a grade segue a ordem e o cartão segue a última atividade", async () => {
    const { moveTrack, listTracks } = await import("@/server/services/tracks");
    const admin = await makeActor();
    const doc = JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }] });
    const mk = async (title: string) => {
      const c = await createContent(db, admin, "ARTICLE", { title: `${title} — texto`, body: doc });
      await publishContent(db, admin, c.id);
      const t = await createTrack(db, admin, { title, minReadSeconds: "0" });
      await addItems(db, admin, (await getTrackForEdit(db, admin, t.id)).modules[0].id, [c.id]);
      await setTrackStatus(db, admin, t.id, "publish");
      return t;
    };
    const pam = await mk("Plataforma PAM");
    const onboarding = await mk("Onboarding");
    expect((await listTracks(db, admin)).map((t) => t.title)).toEqual(["Plataforma PAM", "Onboarding"]);
    await moveTrack(db, admin, onboarding.id, "up");
    expect((await listTracks(db, admin)).map((t) => t.title)).toEqual(["Onboarding", "Plataforma PAM"]);

    const user = await makeUser();
    await assignTrack(db, admin, pam.id, { userIds: [user.id] });
    await assignTrack(db, admin, onboarding.id, { userIds: [user.id] });
    const learner = await sessionUserOf(user.id);
    let mine = await getMyTracks(db, learner);
    expect(mine.active.map((t) => t.track.title)).toEqual(["Onboarding", "Plataforma PAM"]);
    expect(mine.next?.track.title).toBe("Onboarding");

    // Começar pela PAM: o cartão principal continua de onde parou; a grade mantém a ordem.
    const pamItem = (await getTrackForEdit(db, admin, pam.id)).modules[0].items[0];
    await openItem(db, learner, pam.id, pamItem.id);
    mine = await getMyTracks(db, learner);
    expect(mine.next?.track.title).toBe("Plataforma PAM");
    expect(mine.active.map((t) => t.track.title)).toEqual(["Onboarding", "Plataforma PAM"]);

    // Concluída sai da grade e vai para "Concluídas".
    await confirmCompletion(db, learner, pam.id, pamItem.id);
    mine = await getMyTracks(db, learner);
    expect(mine.active.map((t) => t.track.title)).toEqual(["Onboarding"]);
    expect(mine.completed.map((t) => t.track.title)).toEqual(["Plataforma PAM"]);
  });
});
