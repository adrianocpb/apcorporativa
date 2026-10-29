import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IconPlayerPlay } from "@tabler/icons-react";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/current-user";
import { NotFoundError } from "@/server/errors";
import { getTrackForLearner } from "@/server/services/learning";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Alert, Badge, ProgressBar } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { TrackOutline } from "@/components/learning/track-outline";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Trilha" };

export default async function LearnerTrackPage({ params }: PageProps<"/trilhas/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  let data;
  try {
    data = await getTrackForLearner(db, user, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  const { structure, enrollment, state } = data;
  const started = enrollment.status !== "NOT_STARTED";

  return (
    <>
      <PageHeader
        title={structure.title}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {structure.isOnboarding && <Badge tone="primary">Onboarding</Badge>}
            <span>{structure.sequential ? "Siga a ordem: cada conteúdo libera o próximo." : "Acesso livre: siga na ordem que preferir."}</span>
          </span>
        }
        back={{ href: "/trilhas", label: "Minhas trilhas" }}
        actions={
          state.nextItemId && (
            <ButtonLink href={`/trilhas/${structure.id}/item/${state.nextItemId}`} icon={<IconPlayerPlay />}>
              {started ? "Continuar" : "Começar"}
            </ButtonLink>
          )
        }
      />
      <div className="grid gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardBody>
            <TrackOutline trackId={structure.id} structure={structure} state={state} />
          </CardBody>
        </Card>
        <div className="flex flex-col gap-6 xl:col-span-4">
          <Card>
            <CardBody className="flex flex-col gap-3">
              <p className="text-small text-ink-soft">Seu progresso</p>
              <p className="text-h3 font-medium text-ink">{state.percent}%</p>
              <ProgressBar value={state.percent} label="Progresso na trilha" showValue={false} tone={state.completed ? "success" : "primary"} />
              <p className="text-small text-ink-muted">
                {state.completedRequiredCount} de {state.requiredCount} conteúdos obrigatórios concluídos
              </p>
              {state.completed && enrollment.completedAt && (
                <Alert tone="success">Trilha concluída em {formatDate(enrollment.completedAt)}. Os conteúdos continuam disponíveis para revisão.</Alert>
              )}
            </CardBody>
          </Card>
          {structure.description && (
            <Card>
              <CardBody>
                <p className="mb-1 text-small font-medium text-ink">Sobre esta trilha</p>
                <p className="text-body whitespace-pre-line text-ink-soft">{structure.description}</p>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
