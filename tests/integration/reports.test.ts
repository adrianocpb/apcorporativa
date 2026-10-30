import { describe, expect, it } from "vitest";
import { db, makeActor, setupTestDb } from "../support/db";
import { ForbiddenError } from "@/server/errors";
import type { SessionUser } from "@/server/auth/sessions";
import { createSession, validateSessionToken } from "@/server/auth/sessions";
import { hashPassword } from "@/server/auth/password";
import { createContent, publishContent } from "@/server/services/contents";
import { confirmCompletion, openItem } from "@/server/services/learning";
import { addItems, assignTrack, createTrack, getTrackForEdit, setTrackStatus } from "@/server/services/tracks";
import { recordView } from "@/server/services/library";
import {
  getCompletionHistory,
  getPersonReport,
  getProgressRows,
  getReportOverview,
  median,
  parseReportFilters,
} from "@/server/services/reports";
import { toCsv } from "@/lib/csv";

setupTestDb();

const doc = (t: string) => JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: t }] }] });

let n = 0;
async function person(department: string): Promise<SessionUser> {
  n += 1;
  const role = await db.role.findUniqueOrThrow({ where: { key: "COLABORADOR" } });
  const u = await db.user.create({
    data: {
      name: `Pessoa ${n}`,
      email: `p${n}@empresa.test`,
      department,
      roleId: role.id,
      status: "ACTIVE",
      passwordHash: await hashPassword("senha-de-teste-123"),
    },
  });
  const { token } = await createSession(db, u.id);
  return (await validateSessionToken(db, token))!.user;
}

async function trackWith(admin: SessionUser, title: string, onboarding: boolean, count = 2) {
  const ids = [];
  for (let i = 0; i < count; i++) {
    const c = await createContent(db, admin, "ARTICLE", { title: `${title} ${i + 1}`, body: doc("x"), inLibrary: "on" });
    await publishContent(db, admin, c.id);
    ids.push(c.id);
  }
  const t = await createTrack(db, admin, { title, isOnboarding: onboarding ? "on" : "", minReadSeconds: "0" });
  await addItems(db, admin, (await getTrackForEdit(db, admin, t.id)).modules[0].id, ids);
  await setTrackStatus(db, admin, t.id, "publish");
  const items = (await getTrackForEdit(db, admin, t.id)).modules[0].items;
  return { track: t, items, contentIds: ids };
}

async function finish(u: SessionUser, trackId: string, items: { id: string }[], upTo = items.length) {
  for (const it of items.slice(0, upTo)) {
    await openItem(db, u, trackId, it.id);
    await confirmCompletion(db, u, trackId, it.id);
  }
}

describe("indicadores", () => {
  it("calcula matrículas, conclusão, pendências, onboarding e taxas por trilha e área", async () => {
    const admin = await makeActor();
    const onb = await trackWith(admin, "Onboarding", true);
    const erp = await trackWith(admin, "ERP", false);
    const [ana, bia, caio] = [await person("Financeiro"), await person("Financeiro"), await person("Operações")];
    await assignTrack(db, admin, onb.track.id, { userIds: [ana.id, bia.id, caio.id] });
    await assignTrack(db, admin, erp.track.id, { userIds: [ana.id] });
    await finish(ana, onb.track.id, onb.items);
    await finish(bia, onb.track.id, onb.items, 1);

    const all = await getReportOverview(db, admin);
    expect(all.enrollments).toBe(4);
    expect(all.completed).toBe(1);
    expect(all.pending).toBe(3);
    expect(all.completionRate).toBe(25);
    expect(all.onboarding).toEqual({ people: 3, completed: 1, rate: 33 });
    const onbRow = all.byTrack.find((t) => t.title === "Onboarding")!;
    expect(onbRow).toMatchObject({ enrolled: 3, completed: 1, inProgress: 1, notStarted: 1, rate: 33 });
    expect(all.timedCompletions).toBe(1);

    const fin = await getReportOverview(db, admin, { department: "Financeiro" });
    expect(fin.enrollments).toBe(3);
    expect(fin.byDepartment.map((d) => d.key)).toEqual(["Financeiro"]);
    const onlyErp = await getReportOverview(db, admin, { trackId: erp.track.id });
    expect(onlyErp).toMatchObject({ enrollments: 1, completed: 0, pending: 1 });
  });

  it("período: conta conclusões dentro do intervalo", async () => {
    const admin = await makeActor();
    const t = await trackWith(admin, "Políticas", false, 1);
    const u = await person("RH");
    await assignTrack(db, admin, t.track.id, { userIds: [u.id] });
    await finish(u, t.track.id, t.items);
    const past = { from: new Date("2020-01-01"), to: new Date("2020-12-31") };
    // Matrícula criada depois do período: fora da base.
    expect((await getReportOverview(db, admin, past)).enrollments).toBe(0);
    const now = { from: new Date(Date.now() - 86400000), to: new Date(Date.now() + 86400000) };
    expect((await getReportOverview(db, admin, now)).completed).toBe(1);
  });

  it("mostra os conteúdos mais acessados", async () => {
    const admin = await makeActor();
    const t = await trackWith(admin, "Guias", false, 2);
    const u = await person("TI");
    await recordView(db, u, t.contentIds[1]);
    await recordView(db, admin, t.contentIds[1]);
    await recordView(db, u, t.contentIds[0]);
    const r = await getReportOverview(db, admin);
    expect(r.mostAccessed.map((c) => [c.title, c.views])).toEqual([
      ["Guias 2", 2],
      ["Guias 1", 1],
    ]);
  });

  it("mediana de tempo de conclusão", () => {
    expect(median([])).toBeNull();
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe("acompanhamento", () => {
  it("progresso por pessoa mostra percentual e onde parou; individual traz histórico e pontos", async () => {
    const admin = await makeActor();
    const t = await trackWith(admin, "Onboarding", true, 3);
    const u = await person("Comercial");
    await assignTrack(db, admin, t.track.id, { userIds: [u.id] });
    await finish(u, t.track.id, t.items, 1);
    const [row] = await getProgressRows(db, admin, { userId: u.id });
    expect(row).toMatchObject({ percent: 33, status: "IN_PROGRESS", currentItem: { title: "Onboarding 2" } });

    const person1 = await getPersonReport(db, admin, u.id);
    expect(person1.history.map((h) => h.content.title)).toEqual(["Onboarding 1"]);
    expect(person1.level.total).toBe(10);
    expect((await getCompletionHistory(db, admin, { department: "Comercial" })).length).toBe(1);
  });

  it("colaborador não acessa relatórios", async () => {
    const colaborador = await person("X");
    await expect(getReportOverview(db, colaborador)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getProgressRows(db, colaborador)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getPersonReport(db, colaborador, colaborador.id)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("utilitários", () => {
  it("CSV para Excel em português, com escape e proteção contra fórmulas", () => {
    const csv = toCsv(["Nome", "Obs"], [["Ana; Silva", '=HYPERLINK("x")'], ["Bia", 12.5], ["Caio", true]]);
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).trim().split("\r\n");
    expect(lines[0]).toBe("Nome;Obs");
    expect(lines[1]).toBe(`"Ana; Silva";"'=HYPERLINK(""x"")"`);
    expect(lines[2]).toBe("Bia;12,5");
    expect(lines[3]).toBe("Caio;Sim");
  });

  it("lê filtros da URL e ignora datas inválidas", () => {
    const f = parseReportFilters({ trilha: "t1", area: "RH", de: "2026-11-01", ate: "nao-e-data" });
    expect(f.trackId).toBe("t1");
    expect(f.department).toBe("RH");
    expect(f.from?.toISOString()).toBe("2026-11-01T03:00:00.000Z");
    expect(f.to).toBeUndefined();
  });
});
