import type { Metadata } from "next";
import Link from "next/link";
import { IconArchive, IconChevronDown, IconChevronUp, IconFolders, IconRestore } from "@tabler/icons-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/auth/permissions";
import { listCategoryTree } from "@/server/services/categories";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { ConfirmActionButton } from "@/components/forms/action-buttons";
import { cn } from "@/lib/cn";
import { CategoryDialog } from "./category-dialog";
import {
  archiveCategoryAction,
  createCategoryAction,
  moveCategoryAction,
  updateCategoryAction,
} from "./actions";

export const metadata: Metadata = { title: "Categorias" };

type Row = Awaited<ReturnType<typeof listCategoryTree>>[number];
type Category = Omit<Row, "children">;

function MoveButtons({ category, first, last }: { category: Category; first: boolean; last: boolean }) {
  const cls =
    "flex size-[30px] items-center justify-center rounded-md text-ink-soft hover:bg-surface-hover disabled:opacity-30";
  return (
    <div className="flex">
      <form action={moveCategoryAction.bind(null, category.id, "up")}>
        <button type="submit" className={cls} disabled={first} aria-label={`Mover ${category.name} para cima`}>
          <IconChevronUp className="size-4" />
        </button>
      </form>
      <form action={moveCategoryAction.bind(null, category.id, "down")}>
        <button type="submit" className={cls} disabled={last} aria-label={`Mover ${category.name} para baixo`}>
          <IconChevronDown className="size-4" />
        </button>
      </form>
    </div>
  );
}

function CategoryRow({
  category,
  child,
  first,
  last,
  parents,
}: {
  category: Category;
  child?: boolean;
  first: boolean;
  last: boolean;
  parents: { id: string; name: string }[];
}) {
  const archived = category.status === "ARCHIVED";
  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-3 border-b border-line px-6 py-3",
        child && "pl-14",
        archived && "opacity-70",
      )}
    >
      <MoveButtons category={category} first={first} last={last} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className={cn("text-body text-ink", !child && "font-medium")}>{category.name}</span>
          {archived && <Badge>Arquivada</Badge>}
        </p>
        {category.description && <p className="text-small text-ink-muted">{category.description}</p>}
      </div>
      <Link
        href={`/admin/conteudos?categoria=${category.id}`}
        className="text-small text-primary-text hover:underline"
      >
        {category._count.contents} conteúdo(s)
      </Link>
      <CategoryDialog
        mode="edit"
        action={updateCategoryAction.bind(null, category.id)}
        parents={parents.filter((p) => p.id !== category.id)}
        initial={{
          name: category.name,
          description: category.description ?? "",
          parentId: category.parentId ?? "",
        }}
      />
      {archived ? (
        <ConfirmActionButton
          action={archiveCategoryAction.bind(null, category.id, false)}
          label="Restaurar"
          icon={<IconRestore />}
          variant="ghost"
          size="sm"
          title="Restaurar categoria?"
          description="A categoria volta a aparecer na escolha de categoria dos conteúdos."
          confirmLabel="Restaurar"
          successMessage="Categoria restaurada."
        />
      ) : (
        <ConfirmActionButton
          action={archiveCategoryAction.bind(null, category.id, true)}
          label="Arquivar"
          icon={<IconArchive />}
          variant="ghost"
          size="sm"
          title="Arquivar categoria?"
          description="Ela deixa de aparecer para novas escolhas. Os conteúdos continuam ligados a ela e nada é apagado."
          confirmLabel="Arquivar"
          confirmVariant="danger"
          successMessage="Categoria arquivada."
        />
      )}
    </li>
  );
}

export default async function CategoriesPage() {
  const actor = await requirePermission(PERMISSIONS.CATEGORIAS_GERENCIAR);
  const tree = await listCategoryTree(db, actor);
  const parents = tree.filter((c) => c.status === "ACTIVE").map((c) => ({ id: c.id, name: c.name }));

  return (
    <>
      <PageHeader
        title="Categorias"
        description="Organize a Central de Conhecimento em categorias e subcategorias."
        actions={<CategoryDialog mode="create" action={createCategoryAction} parents={parents} />}
      />
      <Card>
        {tree.length === 0 ? (
          <EmptyState
            icon={<IconFolders />}
            title="Nenhuma categoria criada"
            description="Sugestões: Sistemas e plataformas (com ERP, Plataforma X…), Processos internos, Financeiro, Contábil, Recursos humanos, Políticas e normas."
          />
        ) : (
          <ul aria-label="Categorias">
            {tree.map((root, i) => (
              <li key={root.id}>
                <ul>
                  <CategoryRow category={root} first={i === 0} last={i === tree.length - 1} parents={parents} />
                  {root.children.map((child, j) => (
                    <CategoryRow
                      key={child.id}
                      category={child}
                      child
                      first={j === 0}
                      last={j === root.children.length - 1}
                      parents={parents}
                    />
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
