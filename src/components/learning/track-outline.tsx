import Link from "next/link";
import { IconCircle, IconCircleCheckFilled, IconCircleHalf2, IconLock } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { CONTENT_TYPE, ITEM_STATE } from "@/lib/labels";
import type { TrackComputation } from "@/lib/learning/rules";

type Structure = {
  modules: { id: string; title: string; items: { id: string; required: boolean; content: { title: string; type: string } }[] }[];
};

const STATE_ICON = {
  LOCKED: IconLock,
  AVAILABLE: IconCircle,
  IN_PROGRESS: IconCircleHalf2,
  COMPLETED: IconCircleCheckFilled,
};

const STATE_COLOR = {
  LOCKED: "text-ink-muted",
  AVAILABLE: "text-primary-text",
  IN_PROGRESS: "text-warning-text",
  COMPLETED: "text-success-text",
};

/** Etapas e conteúdos com o estado de cada um (bloqueado, disponível, em andamento, concluído). */
export function TrackOutline({
  trackId,
  structure,
  state,
  currentItemId,
  compact,
}: {
  trackId: string;
  structure: Structure;
  state: TrackComputation;
  currentItemId?: string;
  compact?: boolean;
}) {
  const computed = new Map(state.items.map((i) => [i.id, i]));
  return (
    <ol className="flex flex-col gap-5">
      {structure.modules.map((m, index) => {
        const moduleState = state.modules.find((x) => x.id === m.id);
        const items = m.items.filter((i) => computed.has(i.id));
        if (items.length === 0) return null;
        return (
          <li key={m.id}>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <p className={cn("font-medium text-ink", compact ? "text-small" : "text-h6")}>
                <span className="text-ink-muted">Etapa {index + 1} · </span>
                {m.title}
              </p>
              {moduleState && moduleState.requiredCount > 0 && (
                <span className="shrink-0 text-small text-ink-muted">
                  {moduleState.completedCount}/{moduleState.requiredCount}
                </span>
              )}
            </div>
            <ul className="flex flex-col gap-1">
              {items.map((item) => {
                const c = computed.get(item.id)!;
                const Icon = STATE_ICON[c.state];
                const label = `${item.content.title} — ${ITEM_STATE[c.state].label}${item.required ? "" : " (opcional)"}`;
                const inner = (
                  <>
                    <Icon className={cn("size-5 shrink-0", STATE_COLOR[c.state])} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-body", c.state === "LOCKED" ? "text-ink-muted" : "text-ink")}>
                        {item.content.title}
                      </span>
                      {!compact && (
                        <span className="block text-small text-ink-muted">
                          {CONTENT_TYPE[item.content.type]?.label}
                          {!item.required && " · opcional"}
                          {" · "}
                          {ITEM_STATE[c.state].label}
                        </span>
                      )}
                    </span>
                  </>
                );
                const cls = cn(
                  "flex items-center gap-3 rounded-md px-3 py-2",
                  item.id === currentItemId && "bg-primary-subtle",
                );
                return (
                  <li key={item.id}>
                    {c.state === "LOCKED" ? (
                      <span className={cls} aria-label={label} title="Conclua os conteúdos anteriores para liberar">
                        {inner}
                      </span>
                    ) : (
                      <Link
                        href={`/trilhas/${trackId}/item/${item.id}`}
                        className={cn(cls, "hover:bg-surface-hover")}
                        aria-label={label}
                        aria-current={item.id === currentItemId ? "page" : undefined}
                      >
                        {inner}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
