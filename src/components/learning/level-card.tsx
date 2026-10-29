import Link from "next/link";
import { IconAward } from "@tabler/icons-react";
import { Card, CardBody } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/feedback";
import { formatNumber } from "@/lib/format";
import type { levelFor } from "@/lib/gamification";

/** Nível atual, pontos e quanto falta para o próximo. */
export function LevelCard({ level, link = true }: { level: ReturnType<typeof levelFor>; link?: boolean }) {
  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-[38px] items-center justify-center rounded-md bg-warning-subtle text-warning-text" aria-hidden="true">
            <IconAward className="size-[22px]" stroke={1.5} />
          </span>
          <div className="min-w-0">
            <p className="text-small text-ink-soft">Nível {level.current?.number ?? 1}</p>
            <p className="text-h6 font-medium text-ink">{level.current?.name ?? "—"}</p>
          </div>
          <p className="ml-auto text-right">
            <span className="block text-h5 font-medium text-ink">{formatNumber(level.total)}</span>
            <span className="block text-caption text-ink-muted">pontos</span>
          </p>
        </div>
        {level.next ? (
          <>
            <ProgressBar value={level.progress} label="Progresso até o próximo nível" tone="warning" />
            <p className="text-small text-ink-muted">
              Faltam {formatNumber(level.pointsToNext)} pontos para {level.next.name}.
            </p>
          </>
        ) : (
          <p className="text-small text-ink-muted">Você está no nível mais alto. Parabéns!</p>
        )}
        {link && (
          <Link href="/conquistas" className="text-small text-primary-text hover:underline">
            Ver conquistas e histórico de pontos
          </Link>
        )}
      </CardBody>
    </Card>
  );
}
