import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IconArrowLeft, IconLock } from "@tabler/icons-react";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/current-user";
import { NotFoundError } from "@/server/errors";
import { getItemForLearner, getTrackForLearner, LockedError } from "@/server/services/learning";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState, ProgressBar } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { ContentViewer } from "@/components/content/content-viewer";
import { ItemTracker } from "@/components/learning/item-tracker";
import { TrackOutline } from "@/components/learning/track-outline";
import { TrackedVideoPlayer } from "@/components/learning/video-player";
import { coveragePercent, type Range } from "@/lib/learning/rules";

export const metadata: Metadata = { title: "Conteúdo da trilha" };

export default async function LearnerItemPage({ params }: PageProps<"/trilhas/[id]/item/[itemId]">) {
  const user = await requireUser();
  const { id, itemId } = await params;
  let data;
  try {
    data = await getItemForLearner(db, user, id, itemId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    if (error instanceof LockedError) {
      const track = await getTrackForLearner(db, user, id);
      return (
        <>
          <PageHeader title={track.structure.title} back={{ href: `/trilhas/${id}`, label: "Voltar à trilha" }} />
          <Card>
            <EmptyState
              icon={<IconLock />}
              title="Conteúdo bloqueado"
              description="Conclua os conteúdos anteriores para liberar este. Seu progresso fica salvo."
              action={
                track.state.nextItemId && (
                  <ButtonLink href={`/trilhas/${id}/item/${track.state.nextItemId}`}>Ir para o próximo disponível</ButtonLink>
                )
              }
            />
          </Card>
        </>
      );
    }
    throw error;
  }

  const { structure, state, item, computed, version, progress, next, dwellSeconds, secondsSinceOpen } = data;
  const completed = computed.state === "COMPLETED";
  const nextLink = next
    ? next.state === "LOCKED"
      ? null
      : { href: `/trilhas/${id}/item/${next.id}`, label: "Próximo conteúdo" }
    : { href: `/trilhas/${id}`, label: "Voltar à trilha" };
  const ranges = (progress?.watchedRanges as Range[] | null) ?? [];
  const duration = progress?.durationSeconds ?? version.file?.durationSeconds ?? version.durationSeconds ?? 0;

  return (
    <>
      <PageHeader
        title={structure.title}
        description={`${item.module.title}`}
        back={{ href: `/trilhas/${id}`, label: "Visão geral da trilha" }}
      />
      <div className="grid gap-6 xl:grid-cols-12">
        <div className="flex flex-col gap-6 xl:col-span-8">
          <Card>
            <CardBody className="flex flex-col gap-5">
              <ContentViewer
                type={item.content.type}
                version={version}
                videoElement={
                  version.file && item.content.type === "VIDEO" ? (
                    <TrackedVideoPlayer
                      src={`/api/arquivos/${version.file.id}`}
                      title={version.title}
                      trackId={id}
                      itemId={itemId}
                      startAt={progress?.positionSeconds ?? 0}
                      initialCoverage={Math.round(coveragePercent(ranges, duration))}
                      completed={completed}
                      threshold={structure.videoThresholdPct}
                    />
                  ) : undefined
                }
              />
              <ItemTracker
                key={`${itemId}-${completed}`}
                trackId={id}
                itemId={itemId}
                rule={item.completionRule}
                dwellSeconds={dwellSeconds}
                secondsSinceOpen={secondsSinceOpen}
                completed={completed}
                next={nextLink}
              />
            </CardBody>
          </Card>
        </div>
        <aside className="flex flex-col gap-4 xl:col-span-4" aria-label="Conteúdos da trilha">
          <Card>
            <CardBody className="flex flex-col gap-4">
              <div>
                <p className="mb-2 text-small text-ink-soft">Progresso na trilha</p>
                <ProgressBar value={state.percent} label="Progresso na trilha" />
              </div>
              <TrackOutline trackId={id} structure={structure} state={state} currentItemId={itemId} compact />
            </CardBody>
          </Card>
          <ButtonLink href={`/trilhas/${id}`} variant="ghost" icon={<IconArrowLeft />}>
            Visão geral da trilha
          </ButtonLink>
        </aside>
      </div>
    </>
  );
}
