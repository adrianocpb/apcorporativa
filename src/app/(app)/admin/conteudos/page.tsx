import type { Metadata } from "next";
import Link from "next/link";
import { IconFiles, IconPlus, IconSearch } from "@tabler/icons-react";
import type { ContentStatus, ContentType } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/auth/permissions";
import { listContents } from "@/server/services/contents";
import { listCategoryOptions } from "@/server/services/categories";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { ContentTypeIcon } from "@/components/content/content-type-icon";
import { formatDateTime } from "@/lib/format";
import { CONTENT_STATUS, CONTENT_TYPE } from "@/lib/labels";
import { CONTENT_TYPES } from "@/lib/validation/contents";

export const metadata: Metadata = { title: "Conteúdos" };

const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

function one(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export default async function ContentsPage({ searchParams }: PageProps<"/admin/conteudos">) {
  const actor = await requirePermission(PERMISSIONS.CONTEUDOS_GERENCIAR);
  const sp = await searchParams;
  const categories = await listCategoryOptions(db, actor);
  const filters = {
    q: one(sp.q)?.slice(0, 100),
    type: CONTENT_TYPES.find((t) => t === one(sp.tipo)) as ContentType | undefined,
    status: STATUSES.find((s) => s === one(sp.status)) as ContentStatus | undefined,
    categoryId: categories.find((c) => c.id === one(sp.categoria))?.id,
    page: Number(one(sp.pagina)) || 1,
  };
  const result = await listContents(db, actor, filters);
  const hasFilters = !!(filters.q || filters.type || filters.status || filters.categoryId);

  return (
    <>
      <PageHeader
        title="Conteúdos"
        description="Vídeos, documentos, manuais, perguntas frequentes e links. Um mesmo conteúdo pode ser usado em trilhas e na Central de Conhecimento."
        actions={
          <ButtonLink href="/admin/conteudos/novo" icon={<IconPlus />}>
            Novo conteúdo
          </ButtonLink>
        }
      />
      <Card>
        <form
          method="get"
          role="search"
          aria-label="Filtrar conteúdos"
          className="grid gap-3 p-6 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_auto]"
        >
          <Input name="q" defaultValue={filters.q} placeholder="Buscar pelo título" aria-label="Buscar pelo título" />
          <Select name="tipo" defaultValue={filters.type ?? ""} aria-label="Tipo">
            <option value="">Todos os tipos</option>
            {CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {CONTENT_TYPE[t].label}
              </option>
            ))}
          </Select>
          <Select name="status" defaultValue={filters.status ?? ""} aria-label="Status">
            <option value="">Todos os status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {CONTENT_STATUS[s].label}
              </option>
            ))}
          </Select>
          <Select name="categoria" defaultValue={filters.categoryId ?? ""} aria-label="Categoria">
            <option value="">Todas as categorias</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Button type="submit" variant="tonal" icon={<IconSearch />}>
              Filtrar
            </Button>
            {hasFilters && (
              <ButtonLink href="/admin/conteudos" variant="ghost">
                Limpar
              </ButtonLink>
            )}
          </div>
        </form>

        {result.items.length === 0 ? (
          <EmptyState
            icon={<IconFiles />}
            title={hasFilters ? "Nenhum conteúdo encontrado" : "Nenhum conteúdo cadastrado"}
            description={
              hasFilters
                ? "Ajuste a busca ou limpe os filtros."
                : "Comece enviando um vídeo ou PDF, ou escrevendo um manual."
            }
            action={
              !hasFilters && (
                <ButtonLink href="/admin/conteudos/novo" icon={<IconPlus />}>
                  Novo conteúdo
                </ButtonLink>
              )
            }
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Conteúdo</Th>
                  <Th className="hidden lg:table-cell">Categoria</Th>
                  <Th>Status</Th>
                  <Th className="hidden md:table-cell">Atualizado em</Th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((c) => (
                  <Tr key={c.id}>
                    <Td>
                      <Link href={`/admin/conteudos/${c.id}`} className="flex items-center gap-3 hover:underline">
                        <ContentTypeIcon type={c.type} size="sm" />
                        <span className="min-w-0">
                          <span className="block font-medium text-ink">{c.title}</span>
                          <span className="block text-small text-ink-muted">{CONTENT_TYPE[c.type].label}</span>
                        </span>
                      </Link>
                    </Td>
                    <Td className="hidden lg:table-cell">
                      {c.category ? (
                        <>
                          {c.category.parent ? `${c.category.parent.name} › ` : ""}
                          {c.category.name}
                          {c.category.status === "ARCHIVED" && (
                            <span className="text-small text-ink-muted"> (arquivada)</span>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        <Badge tone={CONTENT_STATUS[c.status].tone}>{CONTENT_STATUS[c.status].label}</Badge>
                        {c.status === "PUBLISHED" && c.hasDraft && <Badge tone="info">Alteração pendente</Badge>}
                        {!c.inLibrary && <Badge>Só em trilhas</Badge>}
                      </div>
                    </Td>
                    <Td className="hidden whitespace-nowrap md:table-cell">{formatDateTime(c.updatedAt)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination
              page={result.page}
              pageCount={result.pageCount}
              total={result.total}
              basePath="/admin/conteudos"
              params={{ q: filters.q, tipo: filters.type, status: filters.status, categoria: filters.categoryId }}
            />
          </>
        )}
      </Card>
    </>
  );
}
