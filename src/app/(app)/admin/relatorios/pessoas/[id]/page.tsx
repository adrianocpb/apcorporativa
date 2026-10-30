import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconDownload } from "@tabler/icons-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/auth/permissions";
import { NotFoundError } from "@/server/errors";
import { getPersonReport } from "@/server/services/reports";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar, Badge, EmptyState, ProgressBar } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { LevelCard } from "@/components/learning/level-card";
import { formatDate, formatDateOnly, formatDateTime } from "@/lib/format";
import { USER_STATUS } from "@/lib/labels";

export const metadata: Metadata = { title: "Acompanhamento individual" };

const METHOD: Record<string, string> = {
  VIDEO_WATCHED: "Vídeo assistido",
  CONFIRMED: "Leitura confirmada",
  VIEWED: "Aberto",
};

export default async function PersonReportPage({ params }: PageProps<"/admin/relatorios/pessoas/[id]">) {
  const actor = await requirePermission(PERMISSIONS.RELATORIOS_VER);
  const { id } = await params;
  let data;
  try {
    data = await getPersonReport(db, actor, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  const { user, rows, history, level, achievements } = data;
  const status = USER_STATUS[user.status];

  return (
    <>
      <PageHeader
        title={user.name}
        description="Acompanhamento individual: trilhas, onde parou, pontos e histórico de aprendizagem."
        back={{ href: "/admin/relatorios?aba=pessoas", label: "Relatórios" }}
        actions={
          <a href={`/api/relatorios/historico?pessoa=${user.id}`} className={buttonClasses("outline")} download>
            <IconDownload aria-hidden="true" /> Histórico em CSV
          </a>
        }
      />
      <div className="grid gap-6 xl:grid-cols-12">
        <div className="flex flex-col gap-6 xl:col-span-4">
          <Card>
            <CardBody className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Avatar name={user.name} size="lg" />
                <div className="min-w-0">
                  <p className="truncate text-h6 font-medium text-ink">{user.name}</p>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-body">
                <dt className="text-small text-ink-muted">Área</dt>
                <dd className="text-ink">{user.department ?? "—"}</dd>
                <dt className="text-small text-ink-muted">Entrada</dt>
                <dd className="text-ink">{formatDateOnly(user.hireDate)}</dd>
                <dt className="text-small text-ink-muted">Último acesso</dt>
                <dd className="text-ink">{formatDateTime(user.lastLoginAt)}</dd>
              </dl>
              <Link href={`/admin/usuarios/${user.id}`} className="text-small text-primary-text hover:underline">
                Dados cadastrais
              </Link>
            </CardBody>
          </Card>
          <LevelCard level={level} link={false} />
          {achievements.length > 0 && (
            <Card>
              <CardHeader title="Conquistas" />
              <CardBody>
                <ul className="flex flex-wrap gap-2">
                  {achievements.map((a) => (
                    <li key={a.achievementId}>
                      <Badge tone="success">{a.achievement.name}</Badge>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </div>
        <div className="flex flex-col gap-6 xl:col-span-8">
          <Card>
            <CardHeader title="Trilhas" />
            {rows.length === 0 ? (
              <EmptyState title="Nenhuma trilha atribuída" />
            ) : (
              <div className="mt-4">
                <Table>
                  <thead>
                    <tr>
                      <Th>Trilha</Th>
                      <Th className="min-w-[150px]">Progresso</Th>
                      <Th className="hidden md:table-cell">Onde parou</Th>
                      <Th className="hidden lg:table-cell">Atribuída em</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <Tr key={r.enrollmentId}>
                        <Td className="font-medium text-ink">{r.track.title}</Td>
                        <Td>
                          {r.status === "COMPLETED" ? (
                            <Badge tone="success">Concluída em {formatDate(r.completedAt)}</Badge>
                          ) : (
                            <ProgressBar value={r.percent} label={`Progresso em ${r.track.title}`} />
                          )}
                        </Td>
                        <Td className="hidden md:table-cell">
                          {r.status === "NOT_STARTED" ? (
                            <span className="text-ink-muted">Não iniciou</span>
                          ) : (
                            (r.currentItem?.title ?? "—")
                          )}
                        </Td>
                        <Td className="hidden whitespace-nowrap lg:table-cell">{formatDate(r.assignedAt)}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card>
          <Card>
            <CardHeader title="Histórico de aprendizagem" subtitle="Conclusões registradas (permanentes)" />
            {history.length === 0 ? (
              <EmptyState title="Nenhuma conclusão ainda" />
            ) : (
              <div className="mt-4">
                <Table>
                  <thead>
                    <tr>
                      <Th>Data</Th>
                      <Th>Conteúdo</Th>
                      <Th className="hidden md:table-cell">Trilha</Th>
                      <Th className="hidden lg:table-cell">Como</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <Tr key={h.id}>
                        <Td className="whitespace-nowrap">{formatDateTime(h.completedAt)}</Td>
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
        </div>
      </div>
    </>
  );
}
