import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { db, makeActor, setupTestDb } from "../support/db";
import { PDF_BYTES, PNG_BYTES, streamOf, tempStorage } from "../support/files";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { authorizeFileRead, sanitizeFileName, storeUpload } from "@/server/services/files";
import { createContent, publishContent } from "@/server/services/contents";

setupTestDb();

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listFiles(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );
}

describe("upload de arquivos", () => {
  it("grava PDF com nome interno aleatório, metadados e hash", async () => {
    const admin = await makeActor();
    const { dir, storage } = tempStorage();
    const file = await storeUpload(
      db,
      admin,
      { kind: "PDF", originalName: "..\\..\\Manual ERP<v2>.pdf", stream: streamOf(PDF_BYTES) },
      { storage },
    );
    expect(file.originalName).toBe("Manual ERPv2.pdf");
    expect(file.mimeType).toBe("application/pdf");
    expect(file.size).toBe(PDF_BYTES.length);
    expect(file.storageKey).toMatch(/^pdf\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.pdf$/);
    expect(file.sha256).toHaveLength(64);
    const stored = path.join(dir, file.storageKey);
    expect(readFileSync(stored)).toEqual(Buffer.from(PDF_BYTES));
  });

  it("confere o tipo pelo conteúdo, não pelo nome", async () => {
    const admin = await makeActor();
    const { dir, storage } = tempStorage();
    await expect(
      storeUpload(
        db,
        admin,
        { kind: "PDF", originalName: "falso.pdf", stream: streamOf("isto não é um PDF") },
        { storage },
      ),
    ).rejects.toThrow(/Formato não permitido/);
    await expect(
      storeUpload(db, admin, { kind: "VIDEO", originalName: "x.mp4", stream: streamOf(PDF_BYTES) }, { storage }),
    ).rejects.toThrow(/Formato não permitido/);
    expect(listFiles(dir)).toHaveLength(0);
    expect(await db.storedFile.count()).toBe(0);
  });

  it("recusa arquivo vazio e acima do limite sem deixar sobras", async () => {
    const admin = await makeActor();
    const { dir, storage } = tempStorage();
    await expect(
      storeUpload(db, admin, { kind: "PDF", originalName: "v.pdf", stream: streamOf() }, { storage }),
    ).rejects.toThrow(/vazio/);
    const big = new Uint8Array(6000).fill(32);
    big.set(PDF_BYTES);
    await expect(
      storeUpload(
        db,
        admin,
        { kind: "PDF", originalName: "grande.pdf", stream: streamOf(big.slice(0, 4200), big.slice(4200)) },
        { storage, maxBytes: 5000 },
      ),
    ).rejects.toThrow(/maior que o permitido/);
    expect(existsSync(dir) ? listFiles(dir) : []).toHaveLength(0);
  });

  it("colaborador não envia arquivos", async () => {
    const colaborador = await makeActor("COLABORADOR");
    const { storage } = tempStorage();
    await expect(
      storeUpload(db, colaborador, { kind: "PDF", originalName: "a.pdf", stream: streamOf(PDF_BYTES) }, { storage }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("limpa nomes de arquivo", () => {
    expect(sanitizeFileName("C:\\pasta\\a\u0000b?.png")).toBe("ab.png");
    expect(sanitizeFileName("   ")).toBe("arquivo");
  });
});

describe("acesso aos arquivos", () => {
  it("colaborador só acessa arquivos de conteúdo publicado", async () => {
    const admin = await makeActor();
    const colaborador = await makeActor("COLABORADOR");
    const { storage } = tempStorage();
    const pdf = await storeUpload(
      db,
      admin,
      { kind: "PDF", originalName: "m.pdf", stream: streamOf(PDF_BYTES) },
      { storage },
    );
    const content = await createContent(db, admin, "PDF", { title: "Manual", fileId: pdf.id });

    await expect(authorizeFileRead(db, colaborador, pdf.id)).rejects.toBeInstanceOf(NotFoundError);
    expect((await authorizeFileRead(db, admin, pdf.id)).id).toBe(pdf.id);

    await publishContent(db, admin, content.id);
    expect((await authorizeFileRead(db, colaborador, pdf.id)).id).toBe(pdf.id);

    await db.content.update({ where: { id: content.id }, data: { status: "ARCHIVED" } });
    await expect(authorizeFileRead(db, colaborador, pdf.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(authorizeFileRead(db, colaborador, "inexistente")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("imagem incorporada a um artigo publicado fica acessível; enviada solta, não", async () => {
    const admin = await makeActor();
    const colaborador = await makeActor("COLABORADOR");
    const { storage } = tempStorage();
    const png = await storeUpload(
      db,
      admin,
      { kind: "IMAGE", originalName: "tela.png", stream: streamOf(PNG_BYTES) },
      { storage },
    );
    const loose = await storeUpload(
      db,
      admin,
      { kind: "IMAGE", originalName: "solta.png", stream: streamOf(PNG_BYTES) },
      { storage },
    );
    const body = JSON.stringify({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Veja a tela:" }] },
        { type: "image", attrs: { src: `/api/arquivos/${png.id}`, alt: "Tela" } },
      ],
    });
    const article = await createContent(db, admin, "ARTICLE", { title: "Como acessar", body });
    await publishContent(db, admin, article.id);
    expect((await authorizeFileRead(db, colaborador, png.id)).id).toBe(png.id);
    await expect(authorizeFileRead(db, colaborador, loose.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
