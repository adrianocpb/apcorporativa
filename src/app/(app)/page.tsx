import type { Metadata } from "next";
import Link from "next/link";
import { IconPlayerPlay, IconRoute, IconUsers } from "@tabler/icons-react";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/current-user";
import { hasPermission, PERMISSIONS } from "@/server/auth/permissions";
import { getMyTracks } from "@/server/services/learning";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, ProgressBar } from "@/components/ui/feedback";
import { ContentTypeIcon } from "@/components/content/content-type-icon";
import { TrackCard } from "@/components/learning/track-card";
import { firstName, formatLongDate, greeting } from "@/lib/format";
import { CONTENT_TYPE } from "@/lib/labels";

export const metadata: Metadata = { title: "Painel" };

export default async function DashboardPage() {
  const user = await requireUser();
  const isAdmin = hasPermission(user, PERMISSIONS.ADMIN_ACESSAR);
  const mine = await getMyTracks(db, user);
  const next = mine.next;
  const active = [...mine.inProgress, ...mine.notStarted];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-small text-ink-muted first-letter:uppercase">{formatLongDate(new Date())}</p>
        <h1 className="text-h4 font-medium text-ink">
          {greeting()}, {firstName(user.name)}!
        </h1>
        <p className="text-body text-ink-soft">
          {[user.jobTitle, user.department].filter(Boolean).join(" · ") || user.roleName}
        </p>
      </div>

      {mine.tracks.length === 0 ? (
        <Card>
          <CardHeader title="Suas trilhas" subtitle="Treinamentos atribuídos a você" />
          <CardBody>
            <EmptyState
              icon={<IconRoute />}
              title="Nenhuma trilha atribuída ainda"
              description="Quando o administrador atribuir uma trilha a você, ela aparecerá aqui com o próximo passo recomendado."
            />
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Próxima ação recomendada: o elemento mais evidente do painel. */}
            <Card className="lg:col-span-8">
              <CardBody className="flex h-full flex-col gap-4">
                {next?.nextItem ? (
                  <>
                    <p className="text-small font-medium tracking-[0.2px] text-primary-text uppercase">
                      {next.enrollment.status === "NOT_STARTED" ? "Comece por aqui" : "Continue de onde parou"}
                    </p>
                    <div className="flex items-start gap-4">
                      <ContentTypeIcon type={next.nextItem.type} size="lg" />
                      <div className="min-w-0">
                        <p className="text-h5 font-medium text-ink">{next.nextItem.title}</p>
                        <p className="text-small text-ink-soft">
                          {CONTENT_TYPE[next.nextItem.type]?.label} · trilha{" "}
                          <Link href={`/trilhas/${next.track.id}`} className="text-primary-text hover:underline">
                            {next.track.title}
                          </Link>
                        </p>
                      </div>
                    </div>
                    <ProgressBar value={next.state.percent} label={`Progresso em ${next.track.title}`} />
                    <div className="mt-auto">
                      <ButtonLink href={`/trilhas/${next.track.id}/item/${next.nextItem.id}`} icon={<IconPlayerPlay />}>
                        {next.enrollment.status === "NOT_STARTED" ? "Começar" : "Continuar"}
                      </ButtonLink>
                    </div>
                  </>
                ) : (
                  <EmptyState
                    title="Tudo em dia!"
                    description="Você concluiu todas as trilhas atribuídas. Os conteúdos continuam disponíveis para revisão."
                  />
                )}
              </CardBody>
            </Card>
            <Card className="lg:col-span-4">
              <CardBody className="flex h-full flex-col gap-3">
                <p className="text-small text-ink-soft">Progresso geral nas suas trilhas</p>
                <p className="text-h3 font-medium text-ink">{mine.overallPercent}%</p>
                <ProgressBar value={mine.overallPercent} label="Progresso geral" showValue={false} />
                <dl className="mt-auto grid grid-cols-3 gap-2 text-center">
                  {[
                    ["Em curso", mine.inProgress.length],
                    ["A iniciar", mine.notStarted.length],
                    ["Concluídas", mine.completed.length],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-md bg-page px-2 py-2">
                      <dd className="text-h5 font-medium text-ink">{value}</dd>
                      <dt className="text-caption text-ink-muted">{label}</dt>
                    </div>
                  ))}
                </dl>
              </CardBody>
            </Card>
          </div>

          {active.length > 0 && (
            <section>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-h5 font-medium text-ink">Suas trilhas</h2>
                <Link href="/trilhas" className="text-small text-primary-text hover:underline">
                  Ver todas
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {active.slice(0, 6).map((t) => (
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
          )}

          {mine.completed.length > 0 && (
            <section>
              <h2 className="mb-3 text-h5 font-medium text-ink">Concluídas</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {mine.completed.slice(0, 3).map((t) => (
                  <TrackCard
                    key={t.track.id}
                    track={t.track}
                    percent={100}
                    completed
                    completedAt={t.enrollment.completedAt}
                    status={t.enrollment.status}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {isAdmin && (
        <Card>
          <CardHeader title="Administração" subtitle="Atalhos para a gestão da plataforma" />
          <CardBody className="flex flex-wrap gap-3">
            <ButtonLink href="/admin/trilhas" icon={<IconRoute />}>
              Trilhas
            </ButtonLink>
            <ButtonLink href="/admin/usuarios/novo" variant="tonal" icon={<IconUsers />}>
              Novo usuário
            </ButtonLink>
            <ButtonLink href="/admin" variant="tonal">
              Visão geral
            </ButtonLink>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
