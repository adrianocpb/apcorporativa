import Link from "next/link";
import { ContentTypeIcon } from "@/components/content/content-type-icon";
import { formatDate } from "@/lib/format";
import { CONTENT_TYPE } from "@/lib/labels";
import { MARK_END, MARK_START } from "@/lib/search-marks";

type Card = {
  id: string;
  type: string;
  title: string;
  publishedAt: Date | null;
  category: { name: string; parent: { name: string } | null } | null;
  currentVersion: { description: string | null } | null;
};

/** Trecho da busca com destaques; o texto é renderizado como texto (nunca como HTML). */
export function Snippet({ text }: { text: string }) {
  const parts = text.split(new RegExp(`(${MARK_START}[^${MARK_END}]*${MARK_END})`, "u"));
  return (
    <span className="text-small text-ink-soft">
      {parts.map((part, i) =>
        part.startsWith(MARK_START) ? (
          <mark key={i} className="rounded-sm bg-warning-subtle px-0.5 text-ink">
            {part.slice(1, -1)}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}

export function categoryPath(category: Card["category"]) {
  if (!category) return null;
  return category.parent ? `${category.parent.name} › ${category.name}` : category.name;
}

/** Linha de resultado / item de lista da Central de Conhecimento. */
export function LibraryRow({ item, snippet: rawSnippet, extra }: { item: Card; snippet?: string | null; extra?: string }) {
  // Se o termo só aparece no título, o trecho repetiria o título: mostra a descrição.
  const plain = rawSnippet?.split(MARK_START).join("").split(MARK_END).join("");
  const snippet = rawSnippet && plain !== item.title ? rawSnippet : null;
  const meta = [CONTENT_TYPE[item.type]?.label, categoryPath(item.category), extra ?? (item.publishedAt ? `Atualizado em ${formatDate(item.publishedAt)}` : null)]
    .filter(Boolean)
    .join(" · ");
  return (
    <Link href={`/biblioteca/${item.id}`} className="flex items-start gap-4 rounded-md px-4 py-3 hover:bg-surface-hover">
      <ContentTypeIcon type={item.type} />
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-ink">{item.title}</span>
        {snippet ? (
          <span className="mt-0.5 block line-clamp-2">
            <Snippet text={snippet} />
          </span>
        ) : (
          item.currentVersion?.description && (
            <span className="mt-0.5 block line-clamp-2 text-small text-ink-soft">{item.currentVersion.description}</span>
          )
        )}
        <span className="mt-0.5 block text-small text-ink-muted">{meta}</span>
      </span>
    </Link>
  );
}

/** Cartão compacto para as seções da página inicial da Central. */
export function LibraryTile({ item }: { item: Card }) {
  return (
    <Link
      href={`/biblioteca/${item.id}`}
      className="flex items-start gap-3 rounded-lg bg-surface p-4 shadow-card transition-shadow hover:shadow-raised"
    >
      <ContentTypeIcon type={item.type} size="sm" />
      <span className="min-w-0">
        <span className="block line-clamp-2 text-body font-medium text-ink">{item.title}</span>
        <span className="block text-small text-ink-muted">
          {[CONTENT_TYPE[item.type]?.label, categoryPath(item.category)].filter(Boolean).join(" · ")}
        </span>
      </span>
    </Link>
  );
}
