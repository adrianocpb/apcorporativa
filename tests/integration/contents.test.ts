import { describe, expect, it } from "vitest";
import { db, makeActor, setupTestDb } from "../support/db";
import { PDF_BYTES, PNG_BYTES, streamOf, tempStorage } from "../support/files";
import { ForbiddenError } from "@/server/errors";
import { storeUpload } from "@/server/services/files";
import {
  createContent,
  deleteUnpublishedContent,
  discardDraft,
  getContentForEdit,
  listContents,
  publishContent,
  saveDraft,
  setContentArchived,
} from "@/server/services/contents";
import { createCategory, setCategoryArchived } from "@/server/services/categories";

setupTestDb();

const article = (text: string) =>
  JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

describe("ciclo de vida do conteúdo", () => {
  it("rascunho → publicação → nova versão sem tirar a anterior do ar", async () => {
    const admin = await makeActor();
    const c = await createContent(db, admin, "ARTICLE", { title: "Manual do ERP", body: article("v1") });
    expect(c.status).toBe("DRAFT");

    await publishContent(db, admin, c.id);
    let state = await getContentForEdit(db, admin, c.id);
    expect(state.content.status).toBe("PUBLISHED");
    expect(state.current?.number).toBe(1);
    expect(state.current?.bodyHtml).toBe("<p>v1</p>");

    // Editar a versão publicada cria a versão 2 em rascunho; a 1 continua vigente.
    await saveDraft(db, admin, c.id, { title: "Manual do ERP (2026)", body: article("v2") });
    state = await getContentForEdit(db, admin, c.id);
    expect(state.current?.number).toBe(1);
    expect(state.draft?.number).toBe(2);
    expect(state.content.title).toBe("Manual do ERP");

    // Salvar de novo atualiza o mesmo rascunho (não cria a versão 3).
    await saveDraft(db, admin, c.id, { title: "Manual do ERP (2026)", body: article("v2b") });
    expect((await getContentForEdit(db, admin, c.id)).versions).toHaveLength(2);

    await publishContent(db, admin, c.id, { changeNote: "Novo menu", requiresRecompletion: "on" });
    state = await getContentForEdit(db, admin, c.id);
    expect(state.current?.number).toBe(2);
    expect(state.current?.requiresRecompletion).toBe(true);
    expect(state.current?.changeNote).toBe("Novo menu");
    expect(state.content.title).toBe("Manual do ERP (2026)");
    const v1 = state.versions.find((v) => v.number === 1);
    expect(v1?.status).toBe("SUPERSEDED");
    expect(v1?.bodyHtml).toBe("<p>v1</p>"); // histórico preservado
  });

  it("primeira publicação nunca exige nova conclusão", async () => {
    const admin = await makeActor();
    const c = await createContent(db, admin, "FAQ", { title: "Como pedir férias?", body: article("No portal.") });
    await publishContent(db, admin, c.id, { requiresRecompletion: "on" });
    expect((await getContentForEdit(db, admin, c.id)).current?.requiresRecompletion).toBe(false);
  });

  it("não publica sem o essencial de cada tipo", async () => {
    const admin = await makeActor();
    const pdf = await createContent(db, admin, "PDF", { title: "Política" });
    const link = await createContent(db, admin, "LINK", { title: "Portal" });
    const faq = await createContent(db, admin, "FAQ", { title: "Pergunta?", body: article("  ") });
    await expect(publishContent(db, admin, pdf.id)).rejects.toThrow(/Envie o arquivo/);
    await expect(publishContent(db, admin, link.id)).rejects.toThrow(/endereço/);
    await expect(publishContent(db, admin, faq.id)).rejects.toThrow(/resposta/);
  });

  it("valida link e tipo do arquivo", async () => {
    const admin = await makeActor();
    const { storage } = tempStorage();
    const png = await storeUpload(db, admin, { kind: "IMAGE", originalName: "a.png", stream: streamOf(PNG_BYTES) }, { storage });
    await expect(createContent(db, admin, "PDF", { title: "Errado", fileId: png.id })).rejects.toThrow(
      /não corresponde/,
    );
    await expect(createContent(db, admin, "LINK", { title: "Link", url: "javascript:alert(1)" })).rejects.toMatchObject({
      fieldErrors: { url: expect.any(String) },
    });
    const ok = await createContent(db, admin, "LINK", { title: "Portal RH", url: "https://rh.empresa.com" });
    await publishContent(db, admin, ok.id);
  });

  it("substituir o arquivo cria nova versão e mantém o arquivo antigo no histórico", async () => {
    const admin = await makeActor();
    const { storage } = tempStorage();
    const up = () =>
      storeUpload(db, admin, { kind: "PDF", originalName: "m.pdf", stream: streamOf(PDF_BYTES) }, { storage });
    const f1 = await up();
    const f2 = await up();
    const c = await createContent(db, admin, "PDF", { title: "Manual", fileId: f1.id });
    await publishContent(db, admin, c.id);
    await saveDraft(db, admin, c.id, { title: "Manual", fileId: f2.id });
    await publishContent(db, admin, c.id);
    const state = await getContentForEdit(db, admin, c.id);
    expect(state.current?.fileId).toBe(f2.id);
    expect(state.versions.find((v) => v.number === 1)?.fileId).toBe(f1.id);
  });

  it("arquivar preserva versões; restaurar volta ao estado anterior", async () => {
    const admin = await makeActor();
    const c = await createContent(db, admin, "ARTICLE", { title: "Normas", body: article("x") });
    await publishContent(db, admin, c.id);
    await setContentArchived(db, admin, c.id, true);
    await expect(saveDraft(db, admin, c.id, { title: "Normas", body: article("y") })).rejects.toThrow(/Restaure/);
    expect((await getContentForEdit(db, admin, c.id)).versions).toHaveLength(1);
    await setContentArchived(db, admin, c.id, false);
    expect((await getContentForEdit(db, admin, c.id)).content.status).toBe("PUBLISHED");
  });

  it("só exclui o que nunca foi publicado; descarta rascunho de publicado", async () => {
    const admin = await makeActor();
    const never = await createContent(db, admin, "ARTICLE", { title: "Rascunho", body: article("a") });
    await deleteUnpublishedContent(db, admin, never.id);
    expect(await db.content.count({ where: { id: never.id } })).toBe(0);

    const pub = await createContent(db, admin, "ARTICLE", { title: "Publicado", body: article("a") });
    await publishContent(db, admin, pub.id);
    await expect(deleteUnpublishedContent(db, admin, pub.id)).rejects.toThrow(/arquive/);
    await saveDraft(db, admin, pub.id, { title: "Publicado", body: article("b") });
    await discardDraft(db, admin, pub.id);
    const state = await getContentForEdit(db, admin, pub.id);
    expect(state.draft).toBeNull();
    expect(state.current?.bodyHtml).toBe("<p>a</p>");
  });

  it("filtra por categoria incluindo subcategorias", async () => {
    const admin = await makeActor();
    const sistemas = await createCategory(db, admin, { name: "Sistemas", description: "", parentId: "" });
    const erp = await createCategory(db, admin, { name: "ERP", description: "", parentId: sistemas.id });
    await createContent(db, admin, "LINK", { title: "Acesso ERP", url: "https://erp.x", categoryId: erp.id });
    await createContent(db, admin, "LINK", { title: "Sem categoria", url: "https://y.x" });
    const result = await listContents(db, admin, { categoryId: sistemas.id });
    expect(result.items.map((i) => i.title)).toEqual(["Acesso ERP"]);

    await setCategoryArchived(db, admin, erp.id, true);
    await expect(
      createContent(db, admin, "LINK", { title: "Novo", url: "https://z.x", categoryId: erp.id }),
    ).rejects.toMatchObject({ fieldErrors: { categoryId: expect.any(String) } });
  });

  it("colaborador não gerencia conteúdos", async () => {
    const admin = await makeActor();
    const colaborador = await makeActor("COLABORADOR");
    const c = await createContent(db, admin, "ARTICLE", { title: "Interno", body: article("a") });
    const calls = [
      () => listContents(db, colaborador),
      () => getContentForEdit(db, colaborador, c.id),
      () => createContent(db, colaborador, "ARTICLE", { title: "X", body: article("a") }),
      () => saveDraft(db, colaborador, c.id, { title: "X", body: article("a") }),
      () => publishContent(db, colaborador, c.id),
      () => setContentArchived(db, colaborador, c.id, true),
      () => deleteUnpublishedContent(db, colaborador, c.id),
    ];
    for (const call of calls) await expect(call()).rejects.toBeInstanceOf(ForbiddenError);
    expect((await db.content.findUnique({ where: { id: c.id } }))?.status).toBe("DRAFT");
  });

  it("registra auditoria do ciclo de vida", async () => {
    const admin = await makeActor();
    const { storage } = tempStorage();
    const f = await storeUpload(db, admin, { kind: "PDF", originalName: "m.pdf", stream: streamOf(PDF_BYTES) }, { storage });
    const c = await createContent(db, admin, "PDF", { title: "Manual", fileId: f.id });
    await publishContent(db, admin, c.id);
    await setContentArchived(db, admin, c.id, true);
    const actions = (await db.auditLog.findMany({ where: { entityId: c.id }, orderBy: { createdAt: "asc" } })).map(
      (l) => l.action,
    );
    expect(actions).toEqual(["conteudo.criado", "conteudo.publicado", "conteudo.arquivado"]);
  });
});
