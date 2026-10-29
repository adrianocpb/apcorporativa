import type { Metadata } from "next";
import { IconLock, IconTrophy } from "@tabler/icons-react";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/current-user";
import { getMyGamification } from "@/server/services/gamification";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { LevelCard } from "@/components/learning/level-card";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime } from "@/lib/format";
import { describeCriteria, parseCriteria } from "@/lib/gamification";

export const metadata: Metadata = { title: "Conquistas" };

export default async function AchievementsPage() {
  const user = await requireUser();
  const mine = await getMyGamification(db, user);

  return (
    <>
      <PageHeader title="Conquistas" description="Seu nível, suas conquistas e a origem de cada ponto." />
      <div className="grid gap-6 xl:grid-cols-12">
        <div className="flex flex-col gap-6 xl:col-span-4">
          <LevelCard level={mine.level} link={false} />
        </div>
        <Card className="xl:col-span-8">
          <CardHeader title="Conquistas" subtitle={`${mine.earned.length} obtida(s)`} />
          <CardBody>
            <ul className="grid gap-3 sm:grid-cols-2">
              {mine.earned.map((e) => (
                <li key={e.achievementId} className="flex items-start gap-3 rounded-md border border-line p-4">
                  <span className="flex size-[38px] shrink-0 items-center justify-center rounded-md bg-success-subtle text-success-text" aria-hidden="true">
                    <IconTrophy className="size-[22px]" stroke={1.5} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-ink">{e.achievement.name}</span>
                    <span className="block text-small text-ink-soft">{e.achievement.description}</span>
                    <span className="block text-small text-ink-muted">Obtida em {formatDate(e.awardedAt)}</span>
                  </span>
                </li>
              ))}
              {mine.locked.map((a) => {
                const criteria = parseCriteria(a.criteria);
                const trackTitle = criteria?.tipo === "TRACK_COMPLETED" ? mine.trackTitle(criteria.trilhaId) : undefined;
                return (
                  <li key={a.id} className="flex items-start gap-3 rounded-md border border-dashed border-line p-4">
                    <span className="flex size-[38px] shrink-0 items-center justify-center rounded-md bg-secondary-subtle text-secondary-text" aria-hidden="true">
                      <IconLock className="size-[20px]" stroke={1.5} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium text-ink-soft">{a.name}</span>
                      <span className="block text-small text-ink-muted">
                        {describeCriteria(criteria, trackTitle)}
                        {a.points > 0 ? ` · +${a.points} pontos` : ""}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
            {mine.earned.length === 0 && mine.locked.length === 0 && (
              <EmptyState title="Nenhuma conquista configurada" />
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Histórico de pontos" subtitle="Cada ponto tem uma origem registrada" />
        {mine.history.length === 0 ? (
          <EmptyState title="Nenhum ponto ainda" description="Conclua conteúdos das suas trilhas para começar a pontuar." />
        ) : (
          <div className="mt-4">
            <Table>
              <thead>
                <tr>
                  <Th>Data</Th>
                  <Th>Origem</Th>
                  <Th className="text-right">Pontos</Th>
                </tr>
              </thead>
              <tbody>
                {mine.history.map((t) => (
                  <Tr key={t.id}>
                    <Td className="whitespace-nowrap">{formatDateTime(t.createdAt)}</Td>
                    <Td className="text-ink">{t.description}</Td>
                    <Td className={cn("text-right font-medium", t.points < 0 ? "text-danger-text" : "text-success-text")}>
                      {t.points > 0 ? `+${t.points}` : t.points}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card>
    </>
  );
}
