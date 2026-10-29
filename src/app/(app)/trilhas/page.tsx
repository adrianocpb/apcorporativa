import type { Metadata } from "next";
import { IconRoute } from "@tabler/icons-react";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/current-user";
import { getMyTracks } from "@/server/services/learning";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { TrackCard } from "@/components/learning/track-card";

export const metadata: Metadata = { title: "Minhas trilhas" };

export default async function MyTracksPage() {
  const user = await requireUser();
  const mine = await getMyTracks(db, user);
  const sections = [
    { title: "Em andamento", items: mine.inProgress },
    { title: "A iniciar", items: mine.notStarted },
    { title: "Concluídas", items: mine.completed },
  ].filter((s) => s.items.length > 0);

  return (
    <>
      <PageHeader title="Minhas trilhas" description="Treinamentos atribuídos a você. Os concluídos ficam disponíveis para revisão." />
      {sections.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconRoute />}
            title="Nenhuma trilha atribuída ainda"
            description="Quando uma trilha for atribuída a você, ela aparecerá aqui."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          {sections.map((s) => (
            <section key={s.title}>
              <h2 className="mb-3 text-h5 font-medium text-ink">{s.title}</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {s.items.map((t) => (
                  <TrackCard
                    key={t.track.id}
                    track={t.track}
                    percent={t.state.percent}
                    completed={t.state.completed}
                    completedAt={t.enrollment.completedAt}
                    status={t.enrollment.status}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
