import { describe, expect, it } from "vitest";
import { db, makeActor, makeUser, setupTestDb } from "../support/db";
import { NotFoundError } from "@/server/errors";
import type { SessionUser } from "@/server/auth/sessions";
import { createSession, validateSessionToken } from "@/server/auth/sessions";
import { createContent, publishContent, saveDraft, setContentArchived } from "@/server/services/contents";
import { createCategory } from "@/server/services/categories";
import { confirmCompletion, openItem } from "@/server/services/learning";
import { addItems, assignTrack, createTrack, getTrackForEdit, setTrackStatus } from "@/server/services/tracks";
import {
  getLibraryContent,
  getLibraryHome,
  listFaqs,
  listMyCompleted,
  rebuildSearchIndex,
  recordView,
  searchLibrary,
  setFavorite,
} from "@/server/services/library";
import { getSearchIndex, MARK_END, MARK_START, toFtsQuery } from "@/server/search/search-index";

setupTestDb();

const doc = (text: string) =>
  JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

async function learner(): Promise<SessionUser> {
  const user = await makeUser();
  const { token } = await createSession(db, user.id);
  return (await validateSessionToken(db, token))!.user;
}

async function article(admin: SessionUser, title: string, body: string, extra: Record<string, string> = {}) {
  const c = await createContent(db, admin, "ARTICLE", { title, body: doc(body), inLibrary: "on", ...extra });
  await publishContent(db, admin, c.id);
  return c;
}

const titles = (r: { items: { title: string }[] }) => r.items.map((i) => i.title);

describe("busca", () => {
  it("encontra por título e texto, sem depender de acentos, com prefixo e título valendo mais", async () => {
    const admin = await makeActor();
    const user = await learner();
    await article(admin, "Configuração da VPN", "Passo a passo para acessar a rede.");
    await article(admin, "Política de férias", "A configuração do período é feita no portal.");
    await article(admin, "Reembolso", "Envie as notas fiscais.");

    expect(titles(await searchLibrary(db, user, { q: "configuracao" }))).toEqual([
      "Configuração da VPN",
      "Política de férias",
    ]);
    expect(titles(await searchLibrary(db, user, { q: "ferias" }))).toEqual(["Política de férias"]);
    expect(titles(await searchLibrary(db, user, { q: "reemb" }))).toEqual(["Reembolso"]);
    expect(titles(await searchLibrary(db, user, { q: "nada disso" }))).toEqual([]);
  });

  it("destaca o trecho encontrado sem gerar HTML e trata entradas estranhas com segurança", async () => {
    const admin = await makeActor();
    const user = await learner();
    await article(admin, "Segurança", 'Nunca clique em <script>alert("x")</script> links suspeitos.');
    const [hit] = (await searchLibrary(db, user, { q: "suspeitos" })).items;
    expect(hit.snippet).toContain(`${MARK_START}suspeitos${MARK_END}`);
    expect(toFtsQuery('" OR 1=1 -- NEAR(')).toBe('"OR"* "1"* "1"* "NEAR"*');
    await expect(searchLibrary(db, user, { q: '"(*' })).resolves.toBeTruthy();
  });

  it("só mostra conteúdo publicado e da biblioteca; acompanha publicação, nova versão e arquivamento", async () => {
    const admin = await makeActor();
    const user = await learner();
    await createContent(db, admin, "ARTICLE", { title: "Rascunho secreto", body: doc("orçamento") });
    const hidden = await article(admin, "Só na trilha", "orçamento interno", { inLibrary: "" });
    const visible = await article(admin, "Orçamento anual", "planejamento");
    expect(titles(await searchLibrary(db, user, { q: "orcamento" }))).toEqual(["Orçamento anual"]);

    await saveDraft(db, admin, visible.id, { title: "Planejamento anual", body: doc("metas"), inLibrary: "on" });
    expect(titles(await searchLibrary(db, user, { q: "orcamento" }))).toEqual(["Orçamento anual"]); // rascunho não muda a busca
    await publishContent(db, admin, visible.id);
    expect(titles(await searchLibrary(db, user, { q: "metas" }))).toEqual(["Planejamento anual"]);

    await setContentArchived(db, admin, visible.id, true);
    expect(titles(await searchLibrary(db, user, { q: "metas" }))).toEqual([]);
    expect(hidden.id).toBeTruthy();
  });

  it("filtra por tipo e categoria (incluindo subcategorias)", async () => {
    const admin = await makeActor();
    const user = await learner();
    const sistemas = await createCategory(db, admin, { name: "Sistemas", description: "", parentId: "" });
    const erp = await createCategory(db, admin, { name: "ERP", description: "", parentId: sistemas.id });
    await article(admin, "Acesso ao ERP", "login", { categoryId: erp.id });
    const faq = await createContent(db, admin, "FAQ", { title: "Esqueci o login do ERP?", body: doc("Peça ao suporte."), categoryId: erp.id, inLibrary: "on" });
    await publishContent(db, admin, faq.id);
    await article(admin, "Login do e-mail", "login");

    expect(titles(await searchLibrary(db, user, { q: "login", categoryId: sistemas.id })).sort()).toEqual(
      ["Acesso ao ERP", "Esqueci o login do ERP?"].sort(),
    );
    expect(titles(await searchLibrary(db, user, { q: "login", type: "FAQ" }))).toEqual(["Esqueci o login do ERP?"]);
    const faqs = await listFaqs(db, user);
    expect(faqs[0].currentVersion?.bodyHtml).toContain("Peça ao suporte.");
  });

  it("reconstrói o índice quando ele está vazio", async () => {
    const admin = await makeActor();
    const user = await learner();
    await article(admin, "Benefícios", "plano de saúde");
    getSearchIndex().clear();
    expect(titles(await searchLibrary(db, user, { q: "saude" }))).toEqual(["Benefícios"]);
    expect(await rebuildSearchIndex(db)).toBe(1);
  });
});

describe("acessos, favoritos e concluídos", () => {
  it("conta acessos (sem inflar com recarregamentos) e mostra os mais acessados", async () => {
    const admin = await makeActor();
    const a = await article(admin, "Muito lido", "x");
    const b = await article(admin, "Pouco lido", "y");
    const u1 = await learner();
    const u2 = await learner();
    expect(await recordView(db, u1, a.id)).toBe(true);
    expect(await recordView(db, u1, a.id)).toBe(false); // mesmo acesso em seguida não conta
    await recordView(db, u2, a.id);
    await recordView(db, u2, b.id);
    const home = await getLibraryHome(db, u1);
    expect(home.popular.map((c) => c.title)).toEqual(["Muito lido", "Pouco lido"]);
    expect(home.recentlyViewed.map((c) => c.title)).toEqual(["Muito lido"]);
    expect((await db.content.findUniqueOrThrow({ where: { id: a.id } })).viewCount).toBe(2);
  });

  it("favoritos são pessoais e idempotentes", async () => {
    const admin = await makeActor();
    const a = await article(admin, "Guia", "x");
    const u1 = await learner();
    const u2 = await learner();
    await setFavorite(db, u1, a.id, true);
    await setFavorite(db, u1, a.id, true);
    expect((await getLibraryHome(db, u1)).favorites.map((c) => c.title)).toEqual(["Guia"]);
    expect((await getLibraryHome(db, u2)).favorites).toEqual([]);
    expect((await getLibraryContent(db, u1, a.id)).isFavorite).toBe(true);
    await setFavorite(db, u1, a.id, false);
    expect((await getLibraryHome(db, u1)).favorites).toEqual([]);
  });

  it("conteúdo só de trilha: acessível a quem tem a trilha ou já concluiu; continua após concluir", async () => {
    const admin = await makeActor();
    const onlyTrack = await article(admin, "Procedimento interno", "passos", { inLibrary: "" });
    const track = await createTrack(db, admin, { title: "Operacional", minReadSeconds: "0" });
    const mod = (await getTrackForEdit(db, admin, track.id)).modules[0];
    await addItems(db, admin, mod.id, [onlyTrack.id]);
    await setTrackStatus(db, admin, track.id, "publish");
    const member = await learner();
    const outsider = await learner();
    await assignTrack(db, admin, track.id, { userIds: [member.id] });

    await expect(getLibraryContent(db, outsider, onlyTrack.id)).rejects.toBeInstanceOf(NotFoundError);
    const view = await getLibraryContent(db, member, onlyTrack.id);
    expect(view.tracks.map((t) => t.title)).toEqual(["Operacional"]);

    const item = (await getTrackForEdit(db, admin, track.id)).modules[0].items[0];
    await openItem(db, member, track.id, item.id);
    await confirmCompletion(db, member, track.id, item.id);
    await setTrackStatus(db, admin, track.id, "archive");
    expect((await getLibraryContent(db, member, onlyTrack.id)).completedAt).not.toBeNull();
    expect((await listMyCompleted(db, member)).map((r) => r.content.title)).toEqual(["Procedimento interno"]);
  });

  it("rascunho e arquivado não abrem na Central", async () => {
    const admin = await makeActor();
    const user = await learner();
    const draft = await createContent(db, admin, "ARTICLE", { title: "Rascunho", body: doc("x") });
    const archived = await article(admin, "Antigo", "x");
    await setContentArchived(db, admin, archived.id, true);
    await expect(getLibraryContent(db, user, draft.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getLibraryContent(db, user, archived.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(recordView(db, user, draft.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("monta as categorias com contagem de conteúdos", async () => {
    const admin = await makeActor();
    const user = await learner();
    const rh = await createCategory(db, admin, { name: "RH", description: "", parentId: "" });
    const ben = await createCategory(db, admin, { name: "Benefícios", description: "", parentId: rh.id });
    await article(admin, "Vale-refeição", "x", { categoryId: ben.id });
    await article(admin, "Organograma", "x", { categoryId: rh.id });
    const home = await getLibraryHome(db, user);
    const node = home.categories.find((c) => c.name === "RH")!;
    expect(node.count).toBe(2);
    expect(node.children.map((c) => [c.name, c.count])).toEqual([["Benefícios", 1]]);
  });
});
