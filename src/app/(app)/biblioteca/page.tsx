import type { Metadata } from "next";
import Link from "next/link";
import { IconBooks, IconSearch } from "@tabler/icons-react";
import type { ContentType } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/current-user";
import {
  getLibraryHome,
  listCategoryFilters,
  listFaqs,
  listMyCompleted,
  searchLibrary,
} from "@/server/services/library";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { LibraryRow, LibraryTile } from "@/components/library/library-card";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { CONTENT_TYPE } from "@/lib/labels";
import { CONTENT_TYPES } from "@/lib/validation/contents";

export const metadata: Metadata = { title: "Central de Conhecimento" };

function one(v: string | string[] | undefined) {
  return typeof v === "string" ? v : undefined;
}

export default async function LibraryPage({ searchParams }: PageProps<"/biblioteca">) {
  const user = await requireUser();
  const sp = await searchParams;
  const categories = await listCategoryFilters(db);
  const filters = {
    q: one(sp.q)?.slice(0, 120).trim() || undefined,
    type: CONTENT_TYPES.find((t) => t === one(sp.tipo)) as ContentType | undefined,
    categoryId: categories.find((c) => c.id === one(sp.categoria))?.id,
    page: Number(one(sp.pagina)) || 1,
  };
  const view = one(sp.ver) === "concluidos" ? "concluidos" : null;
  const filtering = !!(filters.q || filters.type || filters.categoryId);
  const typeHref = (t?: string) => {
    const q = new URLSearchParams();
    if (filters.q) q.set("q", filters.q);
    if (filters.categoryId) q.set("categoria", filters.categoryId);
    if (t) q.set("tipo", t);
    const s = q.toString();
    return s ? `/biblioteca?${s}` : "/biblioteca";
  };

  return (
    <>
      <PageHeader
        title="Central de Conhecimento"
        description="Manuais, vídeos, documentos e perguntas frequentes da empresa, sempre disponíveis para consulta."
      />

      <Card className="mb-6">
        <CardBody className="flex flex-col gap-4">
          <form method="get" role="search" aria-label="Buscar na Central" className="grid gap-3 md:grid-cols-[1fr_260px_auto]">
            <div className="relative">
              <IconSearch className="pointer-events-none absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-ink-muted" aria-hidden="true" />
              <Input
                name="q"
                type="search"
                defaultValue={filters.q}
                placeholder="O que você procura? Ex.: férias, VPN, reembolso"
                aria-label="Buscar por título ou conteúdo"
                className="pl-10"
              />
            </div>
            {filters.type && <input type="hidden" name="tipo" value={filters.type} />}
            <Select name="categoria" defaultValue={filters.categoryId ?? ""} aria-label="Categoria">
              <option value="">Todas as categorias</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
            <Button type="submit">Buscar</Button>
          </form>
          <nav className="flex flex-wrap gap-2" aria-label="Filtrar por tipo">
            {[{ key: undefined, label: "Todos" }, ...CONTENT_TYPES.map((t) => ({ key: t as string, label: CONTENT_TYPE[t].label }))].map((t) => {
              const active = !view && filters.type === t.key;
              return (
                <Link
                  key={t.label}
                  href={typeHref(t.key)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-full border px-3 py-1 text-small",
                    active ? "border-primary bg-primary text-on-primary" : "border-line text-ink-soft hover:bg-surface-hover",
                  )}
                >
                  {t.label}
                </Link>
              );
            })}
            <Link
              href="/biblioteca?ver=concluidos"
              aria-current={view ? "page" : undefined}
              className={cn(
                "rounded-full border px-3 py-1 text-small",
                view ? "border-primary bg-primary text-on-primary" : "border-line text-ink-soft hover:bg-surface-hover",
              )}
            >
              Concluídos por mim
            </Link>
          </nav>
        </CardBody>
      </Card>

      {view ? (
        <CompletedView user={user} />
      ) : filters.type === "FAQ" && !filters.q ? (
        <FaqView user={user} categoryId={filters.categoryId} />
      ) : filtering ? (
        <ResultsView user={user} filters={filters} />
      ) : (
        <HomeView user={user} />
      )}
    </>
  );
}

type User = Awaited<ReturnType<typeof requireUser>>;

async function ResultsView({ user, filters }: { user: User; filters: Parameters<typeof searchLibrary>[2] }) {
  const result = await searchLibrary(db, user, filters);
  return (
    <Card>
      <CardHeader
        title={filters.q ? `Resultados para “${filters.q}”` : "Conteúdos"}
        subtitle={`${result.total} conteúdo(s) encontrado(s)`}
      />
      {result.items.length === 0 ? (
        <EmptyState
          icon={<IconSearch />}
          title="Nada encontrado"
          description="Tente outras palavras, um termo mais curto ou remova os filtros."
        />
      ) : (
        <>
          <div className="mt-2 flex flex-col px-2">
            {result.items.map((item) => (
              <LibraryRow key={item.id} item={item} snippet={item.snippet} />
            ))}
          </div>
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            total={result.total}
            basePath="/biblioteca"
            params={{ q: filters?.q, tipo: filters?.type, categoria: filters?.categoryId }}
          />
        </>
      )}
    </Card>
  );
}

async function FaqView({ user, categoryId }: { user: User; categoryId?: string }) {
  const faqs = await listFaqs(db, user, categoryId);
  return (
    <Card>
      <CardHeader title="Perguntas frequentes" subtitle="Clique na pergunta para ver a resposta" />
      {faqs.length === 0 ? (
        <EmptyState title="Nenhuma pergunta frequente publicada" />
      ) : (
        <div className="mt-4 flex flex-col">
          {faqs.map((f) => (
            <details key={f.id} className="group border-t border-line px-6 py-4">
              <summary className="cursor-pointer list-none text-body font-medium text-ink marker:hidden">
                <span className="mr-2 inline-block text-primary-text transition-transform group-open:rotate-90" aria-hidden="true">
                  ›
                </span>
                {f.title}
                {f.category && <span className="ml-2 text-small font-normal text-ink-muted">{f.category.name}</span>}
              </summary>
              <div
                className="rich-content mt-3 pl-5"
                // HTML gerado no servidor por renderRichText (lista fechada, texto escapado).
                dangerouslySetInnerHTML={{ __html: f.currentVersion?.bodyHtml ?? "" }}
              />
              <Link href={`/biblioteca/${f.id}`} className="mt-2 inline-block pl-5 text-small text-primary-text hover:underline">
                Abrir página da pergunta
              </Link>
            </details>
          ))}
        </div>
      )}
    </Card>
  );
}

async function CompletedView({ user }: { user: User }) {
  const items = await listMyCompleted(db, user);
  return (
    <Card>
      <CardHeader title="Concluídos por mim" subtitle="Tudo o que você já concluiu nas trilhas fica aqui para revisão" />
      {items.length === 0 ? (
        <EmptyState title="Nada concluído ainda" description="Os conteúdos concluídos nas suas trilhas aparecem aqui." />
      ) : (
        <div className="mt-2 flex flex-col px-2">
          {items.map(({ content, completedAt }) => (
            <LibraryRow key={content.id} item={content} extra={`Concluído em ${formatDate(completedAt)}`} />
          ))}
        </div>
      )}
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-h5 font-medium text-ink">{title}</h2>
      {children}
    </section>
  );
}

async function HomeView({ user }: { user: User }) {
  const home = await getLibraryHome(db, user);
  const nothing = home.recent.length === 0;
  if (nothing) {
    return (
      <Card>
        <EmptyState
          icon={<IconBooks />}
          title="A Central ainda está vazia"
          description="Quando conteúdos forem publicados na Central de Conhecimento, eles aparecerão aqui."
        />
      </Card>
    );
  }
  const grid = "grid gap-3 sm:grid-cols-2 xl:grid-cols-3";
  return (
    <div className="grid gap-8 xl:grid-cols-12">
      <div className="flex flex-col gap-8 xl:col-span-9">
        {home.favorites.length > 0 && (
          <Section title="Seus favoritos">
            <div className={grid}>
              {home.favorites.map((c) => (
                <LibraryTile key={c.id} item={c} />
              ))}
            </div>
          </Section>
        )}
        {home.recentlyViewed.length > 0 && (
          <Section title="Vistos recentemente">
            <div className={grid}>
              {home.recentlyViewed.map((c) => (
                <LibraryTile key={c.id} item={c} />
              ))}
            </div>
          </Section>
        )}
        {home.popular.length > 0 && (
          <Section title="Mais acessados">
            <div className={grid}>
              {home.popular.map((c) => (
                <LibraryTile key={c.id} item={c} />
              ))}
            </div>
          </Section>
        )}
        <Section title="Publicados recentemente">
          <div className={grid}>
            {home.recent.map((c) => (
              <LibraryTile key={c.id} item={c} />
            ))}
          </div>
        </Section>
      </div>
      <aside className="xl:col-span-3" aria-label="Categorias">
        <Card>
          <CardHeader title="Categorias" />
          <CardBody>
            {home.categories.length === 0 ? (
              <p className="text-small text-ink-muted">Nenhuma categoria criada.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {home.categories.map((c) => (
                  <li key={c.id}>
                    <Link href={`/biblioteca?categoria=${c.id}`} className="flex justify-between gap-2 rounded-md px-2 py-1.5 text-body text-ink hover:bg-surface-hover">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-small text-ink-muted">{c.count}</span>
                    </Link>
                    {c.children.length > 0 && (
                      <ul className="ml-3 flex flex-col">
                        {c.children.map((child) => (
                          <li key={child.id}>
                            <Link href={`/biblioteca?categoria=${child.id}`} className="flex justify-between gap-2 rounded-md px-2 py-1 text-small text-ink-soft hover:bg-surface-hover">
                              <span>{child.name}</span>
                              <span className="text-ink-muted">{child.count}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </aside>
    </div>
  );
}
