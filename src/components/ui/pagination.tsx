import Link from "next/link";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { cn } from "@/lib/cn";

/** Paginação por links, preservando os filtros da URL. */
export function Pagination({
  page,
  pageCount,
  total,
  basePath,
  params,
}: {
  page: number;
  pageCount: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  if (pageCount <= 1) {
    return <p className="px-6 py-4 text-small text-ink-muted">{total} registro(s)</p>;
  }
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    if (p > 1) q.set("pagina", String(p));
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const linkClass =
    "inline-flex h-[30px] min-w-[30px] items-center justify-center rounded-md bg-secondary-subtle px-2 text-small text-ink-soft hover:bg-surface-hover";
  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
      aria-label="Paginação"
    >
      <p className="text-small text-ink-muted">
        Página {page} de {pageCount} · {total} registro(s)
      </p>
      <div className="flex gap-1">
        {page > 1 ? (
          <Link href={href(page - 1)} className={linkClass} aria-label="Página anterior">
            <IconChevronLeft className="size-4" />
          </Link>
        ) : (
          <span className={cn(linkClass, "opacity-45")} aria-hidden="true">
            <IconChevronLeft className="size-4" />
          </span>
        )}
        {page < pageCount ? (
          <Link href={href(page + 1)} className={linkClass} aria-label="Próxima página">
            <IconChevronRight className="size-4" />
          </Link>
        ) : (
          <span className={cn(linkClass, "opacity-45")} aria-hidden="true">
            <IconChevronRight className="size-4" />
          </span>
        )}
      </div>
    </nav>
  );
}
