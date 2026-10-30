import type { Metadata } from "next";
import Link from "next/link";
import {
  IconCircleCheck,
  IconClockHour4,
  IconHourglass,
  IconRocket,
  IconRoute,
  IconUserCheck,
} from "@tabler/icons-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/auth/permissions";
import {
  getCompletionHistory,
  getProgressRows,
  getReportOverview,
  listReportFilterOptions,
  parseReportFilters,
} from "@/server/services/reports";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { Badge, EmptyState, ProgressBar } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { ContentTypeIcon } from "@/components/content/content-type-icon";
import { queryString, ReportFilters } from "@/components/reports/report-filters";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Relatórios" };

const TABS = [
  { key: "indicadores", label: "Indicadores" },
  { key: "pessoas", label: "Progresso por pessoa" },
  { key: "historico", label: "Histórico de conclusões" },
] as const;

const STATUS = {
  NOT_STARTED: { label: "Não iniciada", tone: "info" as const },
  IN_PROGRESS: { label: "Em andamento", tone: "warning" as const },
  COMPLETED: { label: "Concluída", tone: "success" as const },
};

const METHOD: Record<string, string> = {
  VIDEO_WATCHED: "Vídeo assistido",
  CONFIRMED: "Leitura confirmada",
  VIEWED: "Aberto",
};

const days = (d: number | null) =>
  d === null ? "—" : d < 1 ? "menos de 1 dia" : `${formatNumber(Math.round(d * 10) / 10)} dia(s)`;

export default async function ReportsPage({ searchParams }: PageProps<"/admin/relatorios">) {
  const actor = await requirePermission(PERMISSIONS.RELATORIOS_VER);
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.aba)?.key ?? "indicadores";
  const filters = parseReportFilters(sp);
  const options = await listReportFilterOptions(db, actor);
  const csvType = { indicadores: "trilhas", pessoas: "progresso", historico: "historico" }[tab];

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Conclusão das trilhas, onboarding, pendências e conteúdos mais acessados."
      />
      <nav className="mb-6 flex flex-wrap gap-1 border-b border-line" aria-label="Seções dos relatórios">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/relatorios?${queryString(filters.raw, { aba: t.key })}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-body",
              tab === t.key ? "border-primary font-medium text-primary-text" : "border-transparent text-ink-soft hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <Card className="mb-6">
        <ReportFilters
          basePath="/admin/relatorios"
          tab={tab}
          raw={filters.raw}
          options={options}
          showPerson={tab !== "indicadores"}
          exportHref={`/api/relatorios/${csvType}?${queryString(filters.raw)}`}
        />
        <p className="px-6 pb-4 text-small text-ink-muted">
          Período: considera as atribuições feitas até a data final e as conclusões dentro do intervalo (horário de Brasília).
        </p>
      </Card>
      {tab === "indicadores" && <Overview actor={actor} filters={filters} />}
      {tab === "pessoas" && <People actor={actor} filters={filters} page={Number(sp.pagina) || 1} />}
      {tab === "historico" && <History actor={actor} filters={filters} />}
    </>
  );
}

type Actor = Awaited<ReturnType<typeof requirePermission>>;
type Filters = ReturnType<typeof parseReportFilters>;

async function Overview({ actor, filters }: { actor: Actor; filters: Filters }) {
  const r = await getReportOverview(db, actor, filters);
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Usuários ativos" value={formatNumber(r.activeUsers)} icon={<IconUserCheck />} tone="secondary" />
        <StatCard label="Trilhas publicadas" value={formatNumber(r.publishedTracks)} icon={<IconRoute />} />
        <StatCard
          label="Taxa de conclusão"
          value={`${r.completionRate}%`}
          hint={`${r.completed} de ${r.enrollments} atribuições`}
          icon={<IconCircleCheck />}
          tone="success"
        />
        <StatCard label="Treinamentos pendentes" value={formatNumber(r.pending)} icon={<IconHourglass />} tone="warning" />
        <StatCard
          label="Onboarding concluído"
          value={`${r.onboarding.completed} de ${r.onboarding.people}`}
          hint={`${r.onboarding.rate}% das pessoas com onboarding`}
          icon={<IconRocket />}
          tone="info"
        />
        <StatCard
          label="Tempo de conclusão (mediana)"
          value={days(r.medianCompletionDays)}
          hint={r.timedCompletions ? `Do primeiro acesso à conclusão · ${r.timedCompletions} conclusão(ões)` : "Sem dados suficientes"}
          icon={<IconClockHour4 />}
          tone="secondary"
        />
      </div>

      <Card>
        <CardHeader title="Conclusão por trilha" subtitle="Atribuições, andamento e taxa de conclusão" />
        {r.byTrack.length === 0 ? (
          <EmptyState title="Sem atribuições no filtro" />
        ) : (
          <div className="mt-4">
            <Table>
              <thead>
                <tr>
                  <Th>Trilha</Th>
                  <Th>Atribuídas</Th>
                  <Th className="hidden md:table-cell">Não iniciadas</Th>
                  <Th className="hidden md:table-cell">Em andamento</Th>
                  <Th>Concluídas</Th>
                  <Th className="min-w-[160px]">Taxa</Th>
                  <Th className="hidden lg:table-cell">Tempo (mediana)</Th>
                </tr>
              </thead>
              <tbody>
                {r.byTrack.map((t) => (
                  <Tr key={t.key}>
                    <Td>
                      <Link href={`/admin/trilhas/${t.key}?aba=pessoas`} className="font-medium text-ink hover:underline">
                        {t.title}
                      </Link>
                      {t.isOnboarding && <Badge tone="primary" className="ml-2">Onboarding</Badge>}
                    </Td>
                    <Td>{t.enrolled}</Td>
                    <Td className="hidden md:table-cell">{t.notStarted}</Td>
                    <Td className="hidden md:table-cell">{t.inProgress}</Td>
                    <Td>{t.completed}</Td>
                    <Td>
                      <ProgressBar value={t.rate} label={`Taxa de conclusão de ${t.title}`} />
                    </Td>
                    <Td className="hidden whitespace-nowrap lg:table-cell">{days(t.medianDays)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Por área" />
          {r.byDepartment.length === 0 ? (
            <EmptyState title="Sem dados" />
          ) : (
            <div className="mt-4">
              <Table>
                <thead>
                  <tr>
                    <Th>Área</Th>
                    <Th>Atribuídas</Th>
                    <Th className="min-w-[160px]">Taxa de conclusão</Th>
                  </tr>
                </thead>
                <tbody>
                  {r.byDepartment.map((d) => (
                    <Tr key={d.key}>
                      <Td className="text-ink">{d.key}</Td>
                      <Td>{d.enrolled}</Td>
                      <Td>
                        <ProgressBar value={d.rate} label={`Taxa de conclusão de ${d.key}`} />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card>
        <Card>
          <CardHeader title="Conteúdos mais acessados" subtitle="Acessos na Central de Conhecimento" />
          <CardBody>
            {r.mostAccessed.length === 0 ? (
              <p className="text-body text-ink-muted">Nenhum acesso no período.</p>
            ) : (
              <ol className="flex flex-col gap-3">
                {r.mostAccessed.map((c) => (
                  <li key={c.id} className="flex items-center gap-3">
                    <ContentTypeIcon type={c.type} size="sm" />
                    <Link href={`/admin/conteudos/${c.id}`} className="min-w-0 flex-1 truncate text-body text-ink hover:underline">
                      {c.title}
                    </Link>
                    <span className="text-small text-ink-muted">{c.views} acesso(s)</span>
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

const PAGE_SIZE = 50;

async function People({ actor, filters, page }: { actor: Actor; filters: Filters; page: number }) {
  const rows = await getProgressRows(db, actor, filters);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const slice = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  return (
    <Card>
      {rows.length === 0 ? (
        <EmptyState title="Ninguém no filtro" description="Ajuste os filtros ou atribua trilhas." />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Pessoa</Th>
                <Th>Trilha</Th>
                <Th className="min-w-[150px]">Progresso</Th>
                <Th className="hidden lg:table-cell">Onde parou</Th>
                <Th className="hidden md:table-cell">Última atividade</Th>
              </tr>
            </thead>
            <tbody>
              {slice.map((r) => (
                <Tr key={r.enrollmentId}>
                  <Td>
                    <Link href={`/admin/relatorios/pessoas/${r.user.id}`} className="block font-medium text-ink hover:underline">
                      {r.user.name}
                    </Link>
                    <span className="block text-small text-ink-muted">{r.user.department ?? "Sem área"}</span>
                  </Td>
                  <Td>{r.track.title}</Td>
                  <Td>
                    {r.status === "COMPLETED" ? (
                      <Badge tone="success">Concluída em {formatDate(r.completedAt)}</Badge>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <Badge tone={STATUS[r.status].tone} className="self-start">{STATUS[r.status].label}</Badge>
                        <ProgressBar value={r.percent} label={`Progresso de ${r.user.name} em ${r.track.title}`} />
                      </div>
                    )}
                  </Td>
                  <Td className="hidden lg:table-cell">
                    {r.currentItem ? (
                      <>
                        <span className="block text-ink">{r.currentItem.title}</span>
                        <span className="block text-small text-ink-muted">{r.currentItem.module}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td className="hidden whitespace-nowrap md:table-cell">{formatDateTime(r.lastActivityAt)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Pagination
            page={current}
            pageCount={pageCount}
            total={rows.length}
            basePath="/admin/relatorios"
            params={{ ...filters.raw, aba: "pessoas" }}
          />
        </>
      )}
    </Card>
  );
}

async function History({ actor, filters }: { actor: Actor; filters: Filters }) {
  const records = await getCompletionHistory(db, actor, filters, 200);
  return (
    <Card>
      <CardHeader title="Histórico de conclusões" subtitle="Registros permanentes (os 200 mais recentes; use o CSV para todos)" />
      {records.length === 0 ? (
        <EmptyState title="Nenhuma conclusão no filtro" />
      ) : (
        <div className="mt-4">
          <Table>
            <thead>
              <tr>
                <Th>Data</Th>
                <Th>Pessoa</Th>
                <Th>Conteúdo</Th>
                <Th className="hidden md:table-cell">Trilha</Th>
                <Th className="hidden lg:table-cell">Como</Th>
              </tr>
            </thead>
            <tbody>
              {records.map((h) => (
                <Tr key={h.id}>
                  <Td className="whitespace-nowrap">{formatDateTime(h.completedAt)}</Td>
                  <Td>
                    <span className="block text-ink">{h.user.name}</span>
                    <span className="block text-small text-ink-muted">{h.user.department ?? "Sem área"}</span>
                  </Td>
                  <Td>
                    {h.content.title}
                    <span className="block text-small text-ink-muted">versão {h.contentVersion.number}</span>
                  </Td>
                  <Td className="hidden md:table-cell">{h.track?.title ?? "—"}</Td>
                  <Td className="hidden lg:table-cell">{METHOD[h.method]}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </Card>
  );
}
