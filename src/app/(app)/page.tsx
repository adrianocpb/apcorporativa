import type { Metadata } from "next";
import Link from "next/link";
import { IconBooks, IconPlayerPlay, IconRoute, IconSearch, IconUsers } from "@tabler/icons-react";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/current-user";
import { hasPermission, PERMISSIONS } from "@/server/auth/permissions";
import { getMyTracks } from "@/server/services/learning";
import { getLevelInfo } from "@/server/services/gamification";
import { LevelCard } from "@/components/learning/level-card";
import { Button, ButtonLink } from "@/components/ui/button";
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
  const [mine, level] = await Promise.all([getMyTracks(db, user), getLevelInfo(db, user.id)]);
  const next = mine.next;
  const active = mine.active;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-small text-ink-muted first-letter:uppercase">{formatLongDate(new Date())}</p>
        <h1 className="text-h4 font-medium text-ink">
          {greeting()}, {firstName(user.name)}!
        </h1>
        <p className="text-body text-ink-soft">
          {user.department ?? user.roleName}
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
            <div className="flex flex-col gap-6 lg:col-span-4">
              <LevelCard level={level} />
              <Card>
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

      <Card>
        <CardBody className="flex flex-wrap items-center gap-4">
          <span className="flex size-[38px] items-center justify-center rounded-md bg-info-subtle text-info-text" aria-hidden="true">
            <IconBooks className="size-[22px]" stroke={1.5} />
          </span>
          <div className="min-w-[200px] flex-1">
            <p className="text-h6 font-medium text-ink">Central de Conhecimento</p>
            <p className="text-small text-ink-soft">Manuais, vídeos e perguntas frequentes para consultar quando precisar.</p>
          </div>
          <form action="/biblioteca" method="get" role="search" className="flex w-full gap-2 sm:w-auto">
            <input
              type="search"
              name="q"
              placeholder="Buscar…"
              aria-label="Buscar na Central de Conhecimento"
              className="h-[38px] w-full rounded-md border border-line-input bg-surface px-3 text-body text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none sm:w-64"
            />
            <Button type="submit" variant="tonal" icon={<IconSearch />} className="shrink-0">
              Buscar
            </Button>
          </form>
        </CardBody>
      </Card>

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
