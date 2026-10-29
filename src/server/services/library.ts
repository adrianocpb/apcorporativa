import type { ContentType, Prisma } from "@/generated/prisma/client";
import type { Db } from "@/server/db";
import { NotFoundError } from "@/server/errors";
import { hasPermission, PERMISSIONS } from "@/server/auth/permissions";
import type { SessionUser } from "@/server/auth/sessions";
import { getSearchIndex, type SearchIndex } from "@/server/search/search-index";

// Central de Conhecimento: consulta livre a conteúdos publicados, independente das trilhas.

export const LIBRARY_PAGE_SIZE = 20;
const VIEW_THROTTLE_MS = 30 * 60 * 1000; // o mesmo acesso em 30 min conta uma vez
const POPULAR_WINDOW_DAYS = 90;

const inLibrary = { status: "PUBLISHED", inLibrary: true } satisfies Prisma.ContentWhereInput;

const cardSelect = {
  id: true,
  type: true,
  title: true,
  publishedAt: true,
  updatedAt: true,
  viewCount: true,
  category: { select: { id: true, name: true, parent: { select: { name: true } } } },
  currentVersion: { select: { description: true } },
} satisfies Prisma.ContentSelect;

export type LibraryCard = Prisma.ContentGetPayload<{ select: typeof cardSelect }>;

// ---------------------------------------------------------------------------
// Índice de busca
// ---------------------------------------------------------------------------

/** Mantém o índice em dia com o conteúdo: publicado entra; arquivado ou excluído sai. */
export async function indexContent(db: Db, contentId: string, index: SearchIndex = getSearchIndex()) {
  const content = await db.content.findUnique({
    where: { id: contentId },
    include: { currentVersion: { select: { title: true, description: true, bodyText: true } } },
  });
  if (!content || content.status !== "PUBLISHED" || !content.currentVersion) {
    index.remove(contentId);
    return;
  }
  index.upsert({
    contentId,
    title: content.currentVersion.title,
    description: content.currentVersion.description ?? "",
    body: content.currentVersion.bodyText ?? "",
  });
}

export async function rebuildSearchIndex(db: Db, index: SearchIndex = getSearchIndex()) {
  index.clear();
  const published = await db.content.findMany({ where: { status: "PUBLISHED" }, select: { id: true } });
  for (const c of published) await indexContent(db, c.id, index);
  return published.length;
}

/** O índice é dado derivado: se estiver vazio (arquivo novo), é reconstruído na hora. */
async function ensureIndex(db: Db, index: SearchIndex) {
  if (index.count() === 0 && (await db.content.count({ where: { status: "PUBLISHED" } })) > 0) {
    await rebuildSearchIndex(db, index);
  }
}

// ---------------------------------------------------------------------------
// Consulta
// ---------------------------------------------------------------------------

async function categoryScope(db: Db, categoryId: string | undefined): Promise<Prisma.ContentWhereInput> {
  if (!categoryId) return {};
  return { OR: [{ categoryId }, { category: { parentId: categoryId } }] };
}

export type LibraryFilters = { q?: string; type?: ContentType; categoryId?: string; page?: number };

export async function searchLibrary(db: Db, _user: SessionUser, filters: LibraryFilters, index = getSearchIndex()) {
  const page = Math.max(1, filters.page ?? 1);
  const where: Prisma.ContentWhereInput = {
    ...inLibrary,
    ...(filters.type ? { type: filters.type } : {}),
    ...(await categoryScope(db, filters.categoryId)),
  };
  const q = filters.q?.trim();

  if (!q) {
    const [total, items] = await Promise.all([
      db.content.count({ where }),
      db.content.findMany({
        where,
        orderBy: { publishedAt: "desc" },
        skip: (page - 1) * LIBRARY_PAGE_SIZE,
        take: LIBRARY_PAGE_SIZE,
        select: cardSelect,
      }),
    ]);
    return { total, page, pageCount: Math.max(1, Math.ceil(total / LIBRARY_PAGE_SIZE)), items: items.map((c) => ({ ...c, snippet: null as string | null })) };
  }

  await ensureIndex(db, index);
  const hits = index.search(q, 300);
  const rank = new Map(hits.map((h, i) => [h.contentId, i]));
  // Filtros (publicado, na biblioteca, tipo, categoria) aplicados no banco principal.
  const allowed = await db.content.findMany({
    where: { ...where, id: { in: hits.map((h) => h.contentId) } },
    select: cardSelect,
  });
  allowed.sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
  const snippets = new Map(hits.map((h) => [h.contentId, h.snippet]));
  const total = allowed.length;
  return {
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / LIBRARY_PAGE_SIZE)),
    items: allowed
      .slice((page - 1) * LIBRARY_PAGE_SIZE, page * LIBRARY_PAGE_SIZE)
      .map((c) => ({ ...c, snippet: snippets.get(c.id) ?? null })),
  };
}

/** Perguntas frequentes com a resposta (para exibir em lista expansível). */
export async function listFaqs(db: Db, _user: SessionUser, categoryId?: string) {
  return db.content.findMany({
    where: { ...inLibrary, type: "FAQ", ...(await categoryScope(db, categoryId)) },
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      category: { select: { name: true } },
      currentVersion: { select: { bodyHtml: true } },
    },
  });
}

export async function getLibraryHome(db: Db, user: SessionUser) {
  const since = new Date(Date.now() - POPULAR_WINDOW_DAYS * 24 * 3600 * 1000);
  const [favorites, recent, popularIds, myViews, categories, counts] = await Promise.all([
    db.favorite.findMany({
      where: { userId: user.id, content: inLibrary },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { content: { select: cardSelect } },
    }),
    db.content.findMany({ where: inLibrary, orderBy: { publishedAt: "desc" }, take: 6, select: cardSelect }),
    db.contentView.groupBy({
      by: ["contentId"],
      where: { viewedAt: { gte: since }, content: inLibrary },
      _count: { _all: true },
      orderBy: { _count: { contentId: "desc" } },
      take: 6,
    }),
    db.contentView.findMany({
      where: { userId: user.id, content: inLibrary },
      orderBy: { viewedAt: "desc" },
      take: 30,
      select: { contentId: true },
    }),
    db.category.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { id: true, name: true, description: true, parentId: true },
    }),
    db.content.groupBy({ by: ["categoryId"], where: inLibrary, _count: { _all: true } }),
  ]);

  const byId = async (ids: string[]) => {
    const rows = await db.content.findMany({ where: { id: { in: ids }, ...inLibrary }, select: cardSelect });
    return ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is LibraryCard => !!r);
  };
  const recentlyViewed = await byId([...new Set(myViews.map((v) => v.contentId))].slice(0, 6));
  const popular = await byId(popularIds.map((p) => p.contentId));

  const countOf = (id: string) => counts.find((c) => c.categoryId === id)?._count._all ?? 0;
  const roots = categories.filter((c) => !c.parentId);
  const tree = roots.map((root) => {
    const children = categories.filter((c) => c.parentId === root.id).map((c) => ({ ...c, count: countOf(c.id) }));
    return { ...root, children, count: countOf(root.id) + children.reduce((s, c) => s + c.count, 0) };
  });

  return {
    favorites: favorites.map((f) => f.content),
    recent,
    popular,
    recentlyViewed,
    categories: tree,
  };
}

/** Conteúdos que a pessoa já concluiu (inclusive os usados só em trilhas), para revisão. */
export async function listMyCompleted(db: Db, user: SessionUser) {
  const records = await db.completionRecord.findMany({
    where: { userId: user.id, content: { status: "PUBLISHED" } },
    orderBy: { completedAt: "desc" },
    select: { contentId: true, completedAt: true },
  });
  const latest = new Map<string, Date>();
  for (const r of records) if (!latest.has(r.contentId)) latest.set(r.contentId, r.completedAt);
  const rows = await db.content.findMany({ where: { id: { in: [...latest.keys()] } }, select: cardSelect });
  return [...latest.entries()]
    .map(([id, completedAt]) => ({ content: rows.find((r) => r.id === id)!, completedAt }))
    .filter((r) => r.content);
}

// ---------------------------------------------------------------------------
// Detalhe, acessos e favoritos
// ---------------------------------------------------------------------------

/**
 * Quem pode abrir um conteúdo publicado: todos, se está na biblioteca; se é só de trilhas,
 * quem tem a trilha (ou já o concluiu) e quem gerencia conteúdos.
 */
async function assertCanRead(db: Db, user: SessionUser, contentId: string) {
  const content = await db.content.findUnique({ where: { id: contentId }, select: { status: true, inLibrary: true } });
  if (!content || content.status !== "PUBLISHED") throw new NotFoundError("Conteúdo não encontrado.");
  if (content.inLibrary || hasPermission(user, PERMISSIONS.CONTEUDOS_GERENCIAR)) return;
  const [completed, enrolled] = await Promise.all([
    db.completionRecord.count({ where: { userId: user.id, contentId } }),
    db.enrollment.count({
      where: {
        userId: user.id,
        OR: [{ removedAt: null, track: { status: "PUBLISHED" } }, { status: "COMPLETED" }],
        track: { modules: { some: { items: { some: { contentId } } } } },
      },
    }),
  ]);
  if (!completed && !enrolled) throw new NotFoundError("Conteúdo não encontrado.");
}

export async function getLibraryContent(db: Db, user: SessionUser, contentId: string) {
  await assertCanRead(db, user, contentId);
  const content = await db.content.findUniqueOrThrow({
    where: { id: contentId },
    select: {
      ...cardSelect,
      categoryId: true,
      currentVersion: {
        select: {
          title: true,
          description: true,
          bodyHtml: true,
          url: true,
          publishedAt: true,
          number: true,
          file: { select: { id: true, originalName: true, mimeType: true, size: true } },
        },
      },
    },
  });
  const [favorite, completion, trackItems, related] = await Promise.all([
    db.favorite.findUnique({ where: { userId_contentId: { userId: user.id, contentId } } }),
    db.completionRecord.findFirst({ where: { userId: user.id, contentId }, orderBy: { completedAt: "desc" } }),
    db.trackItem.findMany({
      where: {
        contentId,
        module: {
          track: {
            enrollments: {
              some: { userId: user.id, OR: [{ removedAt: null, track: { status: "PUBLISHED" } }, { status: "COMPLETED" }] },
            },
          },
        },
      },
      select: { id: true, module: { select: { track: { select: { id: true, title: true } } } } },
    }),
    content.categoryId
      ? db.content.findMany({
          where: { ...inLibrary, categoryId: content.categoryId, NOT: { id: contentId } },
          orderBy: { viewCount: "desc" },
          take: 4,
          select: cardSelect,
        })
      : Promise.resolve([] as LibraryCard[]),
  ]);
  return {
    content,
    isFavorite: !!favorite,
    completedAt: completion?.completedAt ?? null,
    tracks: trackItems.map((i) => ({ itemId: i.id, trackId: i.module.track.id, title: i.module.track.title })),
    related,
  };
}

export async function recordView(db: Db, user: SessionUser, contentId: string) {
  await assertCanRead(db, user, contentId);
  const recent = await db.contentView.findFirst({
    where: { userId: user.id, contentId, viewedAt: { gte: new Date(Date.now() - VIEW_THROTTLE_MS) } },
  });
  if (recent) return false;
  await db.$transaction([
    db.contentView.create({ data: { userId: user.id, contentId } }),
    db.content.update({ where: { id: contentId }, data: { viewCount: { increment: 1 } } }),
  ]);
  return true;
}

export async function setFavorite(db: Db, user: SessionUser, contentId: string, favorite: boolean) {
  await assertCanRead(db, user, contentId);
  if (favorite) {
    await db.favorite.upsert({
      where: { userId_contentId: { userId: user.id, contentId } },
      update: {},
      create: { userId: user.id, contentId },
    });
  } else {
    await db.favorite.deleteMany({ where: { userId: user.id, contentId } });
  }
}

export async function listCategoryFilters(db: Db) {
  const categories = await db.category.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, name: true, parentId: true },
  });
  const out: { id: string; label: string }[] = [];
  for (const root of categories.filter((c) => !c.parentId)) {
    out.push({ id: root.id, label: root.name });
    for (const child of categories.filter((c) => c.parentId === root.id)) {
      out.push({ id: child.id, label: `${root.name} › ${child.name}` });
    }
  }
  return out;
}
