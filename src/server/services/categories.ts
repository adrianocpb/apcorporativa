import type { Db } from "@/server/db";
import { AppError, NotFoundError } from "@/server/errors";
import { PERMISSIONS } from "@/server/auth/permissions";
import type { RequestMeta, SessionUser } from "@/server/auth/sessions";
import { categoryInputSchema } from "@/lib/validation/contents";
import { parseInput } from "@/server/validation";
import { audit } from "@/server/services/audit";
import { assertPermission } from "@/server/services/guard";

// Estrutura em dois níveis (categoria > subcategoria): simples de navegar e suficiente
// para os exemplos do projeto (ex.: Sistemas e plataformas > ERP).

export async function listCategoryTree(db: Db, actor: SessionUser) {
  assertPermission(actor, PERMISSIONS.CATEGORIAS_GERENCIAR);
  const all = await db.category.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: { _count: { select: { contents: true } } },
  });
  const roots = all.filter((c) => !c.parentId);
  return roots.map((root) => ({
    ...root,
    children: all.filter((c) => c.parentId === root.id),
  }));
}

/** Opções ativas para seletores, já com o caminho ("Pai › Filho"). */
export async function listCategoryOptions(db: Db, actor: SessionUser) {
  assertPermission(actor, PERMISSIONS.CONTEUDOS_GERENCIAR);
  const all = await db.category.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, name: true, parentId: true },
  });
  const options: { id: string; label: string }[] = [];
  for (const root of all.filter((c) => !c.parentId)) {
    options.push({ id: root.id, label: root.name });
    for (const child of all.filter((c) => c.parentId === root.id)) {
      options.push({ id: child.id, label: `${root.name} › ${child.name}` });
    }
  }
  return options;
}

async function assertValidParent(db: Db, parentId: string | null, selfId?: string) {
  if (!parentId) return;
  if (parentId === selfId) throw new AppError("Uma categoria não pode ser subcategoria dela mesma.");
  const parent = await db.category.findUnique({ where: { id: parentId } });
  if (!parent) throw new AppError("Categoria principal inválida.");
  if (parent.parentId) {
    throw new AppError("Subcategorias não podem ter subcategorias (máximo de dois níveis).", {
      parentId: "Escolha uma categoria principal.",
    });
  }
  if (parent.status !== "ACTIVE") throw new AppError("A categoria principal está arquivada.");
}

async function assertNameFree(db: Db, name: string, parentId: string | null, ignoreId?: string) {
  const conflict = await db.category.findFirst({
    where: { name, parentId, ...(ignoreId ? { NOT: { id: ignoreId } } : {}) },
  });
  if (conflict) {
    throw new AppError("Verifique os campos destacados.", {
      name: "Já existe uma categoria com este nome neste nível.",
    });
  }
}

export async function createCategory(
  db: Db,
  actor: SessionUser,
  raw: unknown,
  meta: RequestMeta = {},
) {
  assertPermission(actor, PERMISSIONS.CATEGORIAS_GERENCIAR);
  const input = parseInput(categoryInputSchema, raw);
  await assertValidParent(db, input.parentId);
  await assertNameFree(db, input.name, input.parentId);
  const last = await db.category.findFirst({
    where: { parentId: input.parentId },
    orderBy: { position: "desc" },
  });
  return db.$transaction(async (tx) => {
    const category = await tx.category.create({
      data: { ...input, position: (last?.position ?? -1) + 1 },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "categoria.criada",
      entityType: "categoria",
      entityId: category.id,
      details: { nome: category.name },
      ip: meta.ip,
    });
    return category;
  });
}

export async function updateCategory(
  db: Db,
  actor: SessionUser,
  id: string,
  raw: unknown,
  meta: RequestMeta = {},
) {
  assertPermission(actor, PERMISSIONS.CATEGORIAS_GERENCIAR);
  const input = parseInput(categoryInputSchema, raw);
  const current = await db.category.findUnique({
    where: { id },
    include: { _count: { select: { children: true } } },
  });
  if (!current) throw new NotFoundError("Categoria não encontrada.");
  if (input.parentId && current._count.children > 0) {
    throw new AppError("Uma categoria com subcategorias não pode virar subcategoria.", {
      parentId: "Mova ou arquive as subcategorias antes.",
    });
  }
  await assertValidParent(db, input.parentId, id);
  await assertNameFree(db, input.name, input.parentId, id);

  const parentChanged = current.parentId !== input.parentId;
  const last = parentChanged
    ? await db.category.findFirst({ where: { parentId: input.parentId }, orderBy: { position: "desc" } })
    : null;
  return db.$transaction(async (tx) => {
    const category = await tx.category.update({
      where: { id },
      data: { ...input, ...(parentChanged ? { position: (last?.position ?? -1) + 1 } : {}) },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "categoria.editada",
      entityType: "categoria",
      entityId: id,
      details: { antes: current.name, depois: category.name },
      ip: meta.ip,
    });
    return category;
  });
}

/** Troca a posição com a categoria vizinha do mesmo nível. */
export async function moveCategory(
  db: Db,
  actor: SessionUser,
  id: string,
  direction: "up" | "down",
  meta: RequestMeta = {},
) {
  assertPermission(actor, PERMISSIONS.CATEGORIAS_GERENCIAR);
  const current = await db.category.findUnique({ where: { id } });
  if (!current) throw new NotFoundError("Categoria não encontrada.");
  const siblings = await db.category.findMany({
    where: { parentId: current.parentId },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
  const index = siblings.findIndex((s) => s.id === id);
  const target = siblings[direction === "up" ? index - 1 : index + 1];
  if (!target) return;
  // Renumera o nível inteiro para corrigir posições repetidas, já com a troca aplicada.
  const reordered = [...siblings];
  reordered[index] = target;
  reordered[siblings.indexOf(target)] = current;
  await db.$transaction(async (tx) => {
    for (const [position, category] of reordered.entries()) {
      await tx.category.update({ where: { id: category.id }, data: { position } });
    }
    await audit(tx, {
      actorId: actor.id,
      action: "categoria.reordenada",
      entityType: "categoria",
      entityId: id,
      details: { nome: current.name, direcao: direction === "up" ? "acima" : "abaixo" },
      ip: meta.ip,
    });
  });
}

export async function setCategoryArchived(
  db: Db,
  actor: SessionUser,
  id: string,
  archived: boolean,
  meta: RequestMeta = {},
) {
  assertPermission(actor, PERMISSIONS.CATEGORIAS_GERENCIAR);
  const category = await db.category.findUnique({
    where: { id },
    include: { parent: true, children: { where: { status: "ACTIVE" } } },
  });
  if (!category) throw new NotFoundError("Categoria não encontrada.");
  if (archived && category.children.length > 0) {
    throw new AppError("Arquive as subcategorias antes de arquivar a categoria principal.");
  }
  if (!archived && category.parent?.status === "ARCHIVED") {
    throw new AppError("Restaure a categoria principal antes.");
  }
  // Conteúdos continuam ligados à categoria arquivada; ela só deixa de aparecer nos seletores.
  await db.$transaction(async (tx) => {
    await tx.category.update({
      where: { id },
      data: { status: archived ? "ARCHIVED" : "ACTIVE" },
    });
    await audit(tx, {
      actorId: actor.id,
      action: archived ? "categoria.arquivada" : "categoria.restaurada",
      entityType: "categoria",
      entityId: id,
      details: { nome: category.name },
      ip: meta.ip,
    });
  });
}
