import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/feedback";
import { LevelIllustration } from "@/components/learning/level-badge";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import type { levelFor } from "@/lib/gamification";

type LevelInfo = ReturnType<typeof levelFor>;

/** Nível atual com o badge ilustrado, pontos e quanto falta para o próximo. */
export function LevelCard({ level, link = true }: { level: LevelInfo; link?: boolean }) {
  const number = level.current?.number ?? 1;
  const name = level.current?.name ?? "—";
  return (
    <Card>
      <CardBody className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="w-[88px] shrink-0">
            <LevelIllustration number={number} name={name} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-small font-medium tracking-[0.2px] text-ink-muted uppercase">Nível {number}</p>
            <p className="text-h5 font-medium text-ink">{name}</p>
            <p className="text-small text-ink-muted">
              <span className="font-medium text-ink">{formatNumber(level.total)}</span> pontos
            </p>
          </div>
        </div>
        {level.next ? (
          <>
            <ProgressBar value={level.progress} label="Progresso até o próximo nível" />
            <p className="text-small text-ink-muted">
              Faltam {formatNumber(level.pointsToNext)} pontos para {level.next.name}.
            </p>
          </>
        ) : (
          <p className="text-small text-ink-muted">Você está no nível mais alto. Parabéns!</p>
        )}
        {link && (
          <Link href="/conquistas" className="text-small text-primary-text underline underline-offset-2">
            Ver conquistas e histórico de pontos
          </Link>
        )}
      </CardBody>
    </Card>
  );
}

/** Todos os níveis lado a lado: os alcançados em cor, os próximos esmaecidos. */
export function LevelJourney({ level }: { level: LevelInfo }) {
  const currentNumber = level.current?.number ?? 1;
  return (
    <Card>
      <CardHeader title="Sua jornada" subtitle="Cada trilha concluída sobe você um degrau." />
      <CardBody>
        <ol className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
          {level.levels.map((l) => {
            const reached = l.number <= currentNumber;
            const isCurrent = l.number === currentNumber;
            return (
              <li key={l.id} className="flex flex-col gap-2" aria-current={isCurrent ? "step" : undefined}>
                <div className={cn("rounded-md p-2", isCurrent && "bg-primary-subtle")}>
                  <LevelIllustration number={l.number} name={l.name} locked={!reached} />
                </div>
                <div>
                  <p className="text-small font-medium tracking-[0.2px] text-ink-muted uppercase">
                    Nível {l.number}
                    {isCurrent && " · você está aqui"}
                  </p>
                  <p className={cn("font-medium", reached ? "text-ink" : "text-ink-muted")}>{l.name}</p>
                  <p className="text-small text-ink-muted">
                    {l.minPoints === 0 ? "Início" : `A partir de ${formatNumber(l.minPoints)} pontos`}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </CardBody>
    </Card>
  );
}
