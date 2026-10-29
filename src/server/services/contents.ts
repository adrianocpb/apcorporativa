import { Prisma, type ContentStatus, type ContentType } from "@/generated/prisma/client";
import type { Db } from "@/server/db";
import { AppError, NotFoundError } from "@/server/errors";
import { PERMISSIONS } from "@/server/auth/permissions";
import type { RequestMeta, SessionUser } from "@/server/auth/sessions";
import { CONTENT_TYPES, contentInputSchema, publishOptionsSchema, type ContentInput } from "@/lib/validation/contents";
import { renderRichText, type RichNode } from "@/lib/rich-text";
import { parseInput } from "@/server/validation";
import { audit } from "@/server/services/audit";
import { assertPermission } from "@/server/services/guard";
import { indexContent } from "@/server/services/library";

// Ciclo de vida:
//  - Conteúdo novo: versão 1 em rascunho (status do conteúdo DRAFT).
//  - Publicar: o rascunho vira a versão vigente; a anterior fica como histórico (SUPERSEDED).
//  - Editar conteúdo publicado: cria/atualiza um rascunho; a versão vigente segue no ar.
//  - Arquivar: some das listas; versões, arquivos e (nas próximas fases) conclusões são mantidos.

const FILE_TYPES = { VIDEO: "VIDEO", PDF: "PDF", IMAGE: "IMAGE" } as const;
const RICH_TYPES: ContentType[] = ["ARTICLE", "FAQ"];

export const CONTENTS_PAGE_SIZE = 20;

export type ContentFilters = {
  q?: string;
  type?: ContentType;
  status?: ContentStatus;
  categoryId?: string;
  page?: number;
};

export async function listContents(db: Db, actor: SessionUser, filters: ContentFilters = {}) {
  assertPermission(actor, PERMISSIONS.CONTEUDOS_GERENCIAR);
  const page = Math.max(1, filters.page ?? 1);
  const q = filters.q?.trim();
  const where: Prisma.ContentWhereInput = {
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.categoryId
      ? { OR: [{ categoryId: filters.categoryId }, { category: { parentId: filters.categoryId } }] }
      : {}),
    ...(q ? { title: { contains: q } } : {}),
  };
  const [total, items] = await Promise.all([
    db.content.count({ where }),
    db.content.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * CONTENTS_PAGE_SIZE,
      take: CONTENTS_PAGE_SIZE,
      include: {
        category: { select: { name: true, status: true, parent: { select: { name: true } } } },
        versions: { where: { status: "DRAFT" }, select: { id: true } },
      },
    }),
  ]);
  return {
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / CONTENTS_PAGE_SIZE)),
    items: items.map(({ versions, ...c }) => ({ ...c, hasDraft: versions.length > 0 })),
  };
}

const versionDetail = {
  file: { select: { id: true, originalName: true, mimeType: true, size: true, kind: true } },
  createdBy: { select: { name: true } },
  publishedBy: { select: { name: true } },
} satisfies Prisma.ContentVersionInclude;

export async function getContentForEdit(db: Db, actor: SessionUser, id: string) {
  assertPermission(actor, PERMISSIONS.CONTEUDOS_GERENCIAR);
  const content = await db.content.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true, status: true } },
      author: { select: { name: true } },
      versions: { orderBy: { number: "desc" }, include: versionDetail },
    },
  });
  if (!content) throw new NotFoundError("Conteúdo não encontrado.");
  const draft = content.versions.find((v) => v.status === "DRAFT") ?? null;
  const current = content.versions.find((v) => v.id === content.currentVersionId) ?? null;
  return { content, draft, current, versions: content.versions };
}

/** Versão para pré-visualização: a indicada, ou o rascunho, ou a vigente. */
export async function getVersionForPreview(
  db: Db,
  actor: SessionUser,
  contentId: string,
  versionId?: string,
) {
  const { content, draft, current, versions } = await getContentForEdit(db, actor, contentId);
  const version = versionId ? versions.find((v) => v.id === versionId) : (draft ?? current);
  if (!version) throw new NotFoundError("Versão não encontrada.");
  return { content, version };
}

type VersionData = {
  title: string;
  description: string | null;
  fileId: string | null;
  durationSeconds: number | null;
  url: string | null;
  body: Prisma.InputJsonValue | undefined;
  bodyHtml: string | null;
  bodyText: string | null;
  imageFileIds: string[];
};

/** Converte a entrada do formulário nos campos da versão, conforme o tipo do conteúdo. */
async function buildVersionData(db: Db, type: ContentType, input: ContentInput): Promise<VersionData> {
  const data: VersionData = {
    title: input.title,
    description: input.description,
    fileId: null,
    durationSeconds: null,
    url: null,
    body: undefined,
    bodyHtml: null,
    bodyText: null,
    imageFileIds: [],
  };

  if (type in FILE_TYPES && input.fileId) {
    const file = await db.storedFile.findUnique({ where: { id: input.fileId } });
    if (!file || file.kind !== FILE_TYPES[type as keyof typeof FILE_TYPES]) {
      throw new AppError("O arquivo enviado não corresponde ao tipo do conteúdo.", {
        fileId: "Envie o arquivo novamente.",
      });
    }
    data.fileId = file.id;
    if (type === "VIDEO") data.durationSeconds = input.durationSeconds;
  }

  if (type === "LINK" && input.url) {
    let url: URL;
    try {
      url = new URL(input.url);
    } catch {
      throw new AppError("Verifique os campos destacados.", { url: "Informe um endereço completo, com https://." });
    }
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new AppError("Verifique os campos destacados.", { url: "Use um endereço http:// ou https://." });
    }
    data.url = url.toString();
  }

  if (RICH_TYPES.includes(type) && input.body) {
    let doc: RichNode;
    try {
      doc = JSON.parse(input.body);
    } catch {
      throw new AppError("Não foi possível ler o texto do editor. Recarregue a página.");
    }
    if (!doc || doc.type !== "doc") throw new AppError("Texto do editor inválido.");
    const rendered = renderRichText(doc);
    const existing = rendered.imageFileIds.length
      ? await db.storedFile.findMany({
          where: { id: { in: rendered.imageFileIds }, kind: "IMAGE" },
          select: { id: true },
        })
      : [];
    data.body = doc as Prisma.InputJsonValue;
    data.bodyHtml = rendered.html;
    data.bodyText = rendered.text;
    data.imageFileIds = existing.map((f) => f.id);
  }
  return data;
}

function missingForPublish(type: ContentType, v: { fileId: string | null; url: string | null; bodyText: string | null; bodyHtml: string | null }) {
  if (type in FILE_TYPES && !v.fileId) return "Envie o arquivo antes de publicar.";
  if (type === "LINK" && !v.url) return "Informe o endereço do link antes de publicar.";
  if (RICH_TYPES.includes(type) && !v.bodyText && !v.bodyHtml?.includes("<img")) {
    return type === "FAQ" ? "Escreva a resposta antes de publicar." : "Escreva o texto antes de publicar.";
  }
  return null;
}

async function validCategoryId(db: Db, categoryId: string | null) {
  if (!categoryId) return null;
  const category = await db.category.findUnique({ where: { id: categoryId } });
  if (!category || category.status !== "ACTIVE") {
    throw new AppError("Verifique os campos destacados.", { categoryId: "Categoria inválida ou arquivada." });
  }
  return category.id;
}

function versionFields(data: VersionData) {
  const { imageFileIds, ...fields } = data;
  void imageFileIds;
  return fields;
}

export async function createContent(
  db: Db,
  actor: SessionUser,
  type: string,
  raw: unknown,
  meta: RequestMeta = {},
) {
  assertPermission(actor, PERMISSIONS.CONTEUDOS_GERENCIAR);
  if (!CONTENT_TYPES.includes(type as ContentType)) throw new AppError("Tipo de conteúdo inválido.");
  const contentType = type as ContentType;
  const input = parseInput(contentInputSchema, raw);
  const categoryId = await validCategoryId(db, input.categoryId);
  const data = await buildVersionData(db, contentType, input);

  return db.$transaction(async (tx) => {
    const content = await tx.content.create({
      data: {
        type: contentType,
        title: data.title,
        categoryId,
        inLibrary: input.inLibrary,
        authorId: actor.id,
        versions: {
          create: {
            number: 1,
            ...versionFields(data),
            createdById: actor.id,
            assets: { create: data.imageFileIds.map((fileId) => ({ fileId })) },
          },
        },
      },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "conteudo.criado",
      entityType: "conteudo",
      entityId: content.id,
      details: { titulo: content.title, tipo: contentType },
      ip: meta.ip,
    });
    return content;
  });
}

/** Salva o rascunho. Se o conteúdo está publicado e sem rascunho, abre uma nova versão. */
export async function saveDraft(
  db: Db,
  actor: SessionUser,
  contentId: string,
  raw: unknown,
  meta: RequestMeta = {},
) {
  assertPermission(actor, PERMISSIONS.CONTEUDOS_GERENCIAR);
  const content = await db.content.findUnique({
    where: { id: contentId },
    include: { versions: { orderBy: { number: "desc" } } },
  });
  if (!content) throw new NotFoundError("Conteúdo não encontrado.");
  if (content.status === "ARCHIVED") throw new AppError("Restaure o conteúdo antes de editá-lo.");
  const input = parseInput(contentInputSchema, raw);
  const categoryId = await validCategoryId(db, input.categoryId);
  const data = await buildVersionData(db, content.type, input);
  const draft = content.versions.find((v) => v.status === "DRAFT");
  const nextNumber = (content.versions[0]?.number ?? 0) + 1;

  return db.$transaction(async (tx) => {
    let versionId: string;
    if (draft) {
      await tx.contentVersionAsset.deleteMany({ where: { versionId: draft.id } });
      await tx.contentVersion.update({
        where: { id: draft.id },
        data: { ...versionFields(data), body: data.body ?? Prisma.DbNull },
      });
      versionId = draft.id;
    } else {
      const created = await tx.contentVersion.create({
        data: { contentId, number: nextNumber, ...versionFields(data), createdById: actor.id },
      });
      versionId = created.id;
    }
    if (data.imageFileIds.length) {
      await tx.contentVersionAsset.createMany({
        data: data.imageFileIds.map((fileId) => ({ versionId, fileId })),
      });
    }
    // Categoria e visibilidade na biblioteca são organizacionais: valem na hora.
    // O título público só muda ao publicar (salvo se nunca foi publicado).
    await tx.content.update({
      where: { id: contentId },
      data: {
        categoryId,
        inLibrary: input.inLibrary,
        ...(content.currentVersionId ? {} : { title: data.title }),
      },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "conteudo.rascunho_salvo",
      entityType: "conteudo",
      entityId: contentId,
      details: { titulo: data.title, versao: draft?.number ?? nextNumber },
      ip: meta.ip,
    });
    return { versionId };
  });
}

export async function publishContent(
  db: Db,
  actor: SessionUser,
  contentId: string,
  raw: unknown = {},
  meta: RequestMeta = {},
) {
  assertPermission(actor, PERMISSIONS.CONTEUDOS_GERENCIAR);
  const options = parseInput(publishOptionsSchema, raw);
  const content = await db.content.findUnique({
    where: { id: contentId },
    include: { versions: { where: { status: "DRAFT" } } },
  });
  if (!content) throw new NotFoundError("Conteúdo não encontrado.");
  if (content.status === "ARCHIVED") throw new AppError("Restaure o conteúdo antes de publicá-lo.");
  const draft = content.versions[0];
  if (!draft) throw new AppError("Não há alterações em rascunho para publicar.");
  const missing = missingForPublish(content.type, draft);
  if (missing) throw new AppError(missing);

  const isUpdate = !!content.currentVersionId;
  const now = new Date();
  await db.$transaction(async (tx) => {
    if (content.currentVersionId) {
      await tx.contentVersion.update({
        where: { id: content.currentVersionId },
        data: { status: "SUPERSEDED" },
      });
    }
    await tx.contentVersion.update({
      where: { id: draft.id },
      data: {
        status: "PUBLISHED",
        publishedAt: now,
        publishedById: actor.id,
        changeNote: options.changeNote,
        // Na primeira publicação não há conclusões anteriores a invalidar.
        requiresRecompletion: isUpdate && options.requiresRecompletion,
      },
    });
    await tx.content.update({
      where: { id: contentId },
      data: {
        currentVersionId: draft.id,
        title: draft.title,
        status: "PUBLISHED",
        publishedAt: content.publishedAt ?? now,
        archivedAt: null,
      },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "conteudo.publicado",
      entityType: "conteudo",
      entityId: contentId,
      details: {
        titulo: draft.title,
        versao: draft.number,
        ...(isUpdate ? { exigeNovaConclusao: options.requiresRecompletion } : {}),
        ...(options.changeNote ? { resumo: options.changeNote } : {}),
      },
      ip: meta.ip,
    });
  });
  await indexContent(db, contentId);
}

/** Descarta o rascunho de um conteúdo que já tem versão publicada. */
export async function discardDraft(db: Db, actor: SessionUser, contentId: string, meta: RequestMeta = {}) {
  assertPermission(actor, PERMISSIONS.CONTEUDOS_GERENCIAR);
  const content = await db.content.findUnique({
    where: { id: contentId },
    include: { versions: { where: { status: "DRAFT" } } },
  });
  if (!content) throw new NotFoundError("Conteúdo não encontrado.");
  const draft = content.versions[0];
  if (!draft) throw new AppError("Não há rascunho para descartar.");
  if (!content.currentVersionId) {
    throw new AppError("Este conteúdo nunca foi publicado. Use “Excluir” para removê-lo.");
  }
  await db.$transaction(async (tx) => {
    await tx.contentVersion.delete({ where: { id: draft.id } });
    await audit(tx, {
      actorId: actor.id,
      action: "conteudo.rascunho_descartado",
      entityType: "conteudo",
      entityId: contentId,
      details: { titulo: content.title, versao: draft.number },
      ip: meta.ip,
    });
  });
}

/** Exclusão definitiva só para conteúdo que nunca foi publicado (não há histórico a preservar). */
export async function deleteUnpublishedContent(
  db: Db,
  actor: SessionUser,
  contentId: string,
  meta: RequestMeta = {},
) {
  assertPermission(actor, PERMISSIONS.CONTEUDOS_GERENCIAR);
  const content = await db.content.findUnique({ where: { id: contentId } });
  if (!content) throw new NotFoundError("Conteúdo não encontrado.");
  const published = await db.contentVersion.count({
    where: { contentId, status: { in: ["PUBLISHED", "SUPERSEDED"] } },
  });
  if (content.currentVersionId || published > 0) {
    throw new AppError("Conteúdos já publicados não são excluídos: arquive-os para preservar o histórico.");
  }
  await db.$transaction(async (tx) => {
    await tx.content.delete({ where: { id: contentId } });
    await audit(tx, {
      actorId: actor.id,
      action: "conteudo.excluido",
      entityType: "conteudo",
      entityId: contentId,
      details: { titulo: content.title, tipo: content.type },
      ip: meta.ip,
    });
  });
  await indexContent(db, contentId);
}

export async function setContentArchived(
  db: Db,
  actor: SessionUser,
  contentId: string,
  archived: boolean,
  meta: RequestMeta = {},
) {
  assertPermission(actor, PERMISSIONS.CONTEUDOS_GERENCIAR);
  const content = await db.content.findUnique({ where: { id: contentId } });
  if (!content) throw new NotFoundError("Conteúdo não encontrado.");
  const status: ContentStatus = archived ? "ARCHIVED" : content.currentVersionId ? "PUBLISHED" : "DRAFT";
  if (status === content.status) return;
  await db.$transaction(async (tx) => {
    await tx.content.update({
      where: { id: contentId },
      data: { status, archivedAt: archived ? new Date() : null },
    });
    await audit(tx, {
      actorId: actor.id,
      action: archived ? "conteudo.arquivado" : "conteudo.restaurado",
      entityType: "conteudo",
      entityId: contentId,
      details: { titulo: content.title },
      ip: meta.ip,
    });
  });
  await indexContent(db, contentId);
}

export async function getContentStats(db: Db, actor: SessionUser) {
  assertPermission(actor, PERMISSIONS.CONTEUDOS_GERENCIAR);
  const rows = await db.content.groupBy({ by: ["status"], _count: { _all: true } });
  const count = (s: string) => rows.find((r) => r.status === s)?._count._all ?? 0;
  return { published: count("PUBLISHED"), draft: count("DRAFT"), archived: count("ARCHIVED") };
}
