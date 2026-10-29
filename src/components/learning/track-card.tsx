import Link from "next/link";
import { IconRoute } from "@tabler/icons-react";
import { Badge, ProgressBar } from "@/components/ui/feedback";
import { formatDate } from "@/lib/format";

/** Cartão de trilha com progresso, usado no painel e em "Minhas trilhas". */
export function TrackCard({
  track,
  percent,
  completed,
  completedAt,
  status,
}: {
  track: { id: string; title: string; description: string | null; isOnboarding: boolean };
  percent: number;
  completed: boolean;
  completedAt: Date | null;
  status: string;
}) {
  return (
    <Link
      href={`/trilhas/${track.id}`}
      className="flex flex-col gap-3 rounded-md bg-surface p-5 shadow-card transition-shadow hover:shadow-raised"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-[38px] shrink-0 items-center justify-center rounded-md bg-primary-subtle text-primary-text" aria-hidden="true">
          <IconRoute className="size-[22px]" stroke={1.5} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-h6 font-medium text-ink">{track.title}</p>
          <p className="mt-0.5 flex flex-wrap gap-1">
            {track.isOnboarding && <Badge tone="primary">Onboarding</Badge>}
            {completed ? (
              <Badge tone="success">Concluída{completedAt ? ` em ${formatDate(completedAt)}` : ""}</Badge>
            ) : status === "NOT_STARTED" ? (
              <Badge tone="info">Não iniciada</Badge>
            ) : (
              <Badge tone="warning">Em andamento</Badge>
            )}
          </p>
        </div>
      </div>
      {track.description && <p className="line-clamp-2 text-small text-ink-soft">{track.description}</p>}
      <ProgressBar value={percent} label={`Progresso em ${track.title}`} tone={completed ? "success" : "primary"} />
    </Link>
  );
}
