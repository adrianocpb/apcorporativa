import type { Metadata } from "next";
import Link from "next/link";
import { IconTrash } from "@tabler/icons-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/auth/permissions";
import { getGamificationConfig, listPointHistory } from "@/server/services/gamification";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, EmptyState } from "@/components/ui/feedback";
import { Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { ConfirmActionButton } from "@/components/forms/action-buttons";
import { cn } from "@/lib/cn";
import { formatDateTime, formatNumber } from "@/lib/format";
import { describeCriteria, parseCriteria, POINT_EVENT_LABEL } from "@/lib/gamification";
import { AchievementDialog, AdjustForm, LevelDialog, RulesForm } from "./forms";
import {
  adjustPointsAction,
  deleteLevelAction,
  saveAchievementAction,
  saveLevelAction,
  updateRulesAction,
} from "./actions";

export const metadata: Metadata = { title: "Gamificação" };

const TABS = [
  { key: "regras", label: "Pontuação" },
  { key: "niveis", label: "Níveis" },
  { key: "conquistas", label: "Conquistas" },
  { key: "historico", label: "Histórico de pontos" },
] as const;

const EDITABLE_EVENTS = ["CONTENT_VIDEO", "CONTENT_READING", "CONTENT_OTHER", "MODULE_COMPLETED", "TRACK_COMPLETED"];

export default async function GamificationPage({ searchParams }: PageProps<"/admin/gamificacao">) {
  const actor = await requirePermission(PERMISSIONS.GAMIFICACAO_CONFIGURAR);
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.aba)?.key ?? "regras";
  const config = await getGamificationConfig(db, actor);

  return (
    <>
      <PageHeader
        title="Gamificação"
        description="Pontos, níveis e conquistas que reconhecem o progresso. Sem ranking entre colaboradores."
      />
      <nav className="mb-6 flex flex-wrap gap-1 border-b border-line" aria-label="Seções da gamificação">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/gamificacao?aba=${t.key}`}
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

      {tab === "regras" && (
        <Card className="max-w-3xl">
          <CardHeader title="Pontos por evento" subtitle="Desmarque para não pontuar o evento" />
          <CardBody>
            <RulesForm
              action={updateRulesAction}
              rules={EDITABLE_EVENTS.map((e) => config.rules.find((r) => r.event === e)).filter((r) => !!r)}
            />
          </CardBody>
        </Card>
      )}

      {tab === "niveis" && (
        <Card className="max-w-3xl">
          <CardHeader
            title="Níveis"
            subtitle="Definidos pelos pontos acumulados"
            actions={<LevelDialog action={saveLevelAction.bind(null, null)} />}
          />
          <div className="mt-4">
            <Table>
              <thead>
                <tr>
                  <Th>Nível</Th>
                  <Th>A partir de</Th>
                  <Th className="text-right">Ações</Th>
                </tr>
              </thead>
              <tbody>
                {config.levels.map((l) => (
                  <Tr key={l.id}>
                    <Td>
                      <span className="text-ink">
                        Nível {l.number} — <span className="font-medium">{l.name}</span>
                      </span>
                    </Td>
                    <Td>{formatNumber(l.minPoints)} pontos</Td>
                    <Td className="text-right whitespace-nowrap">
                      <LevelDialog
                        action={saveLevelAction.bind(null, l.id)}
                        initial={{ name: l.name, minPoints: l.minPoints }}
                        locked={l.minPoints === 0}
                      />
                      {l.minPoints > 0 && (
                        <ConfirmActionButton
                          action={deleteLevelAction.bind(null, l.id)}
                          label="Excluir"
                          icon={<IconTrash />}
                          variant="ghost"
                          size="sm"
                          title="Excluir nível?"
                          description={`O nível “${l.name}” deixa de existir. Os pontos das pessoas não mudam; o nível de cada uma é recalculado.`}
                          confirmLabel="Excluir"
                          confirmVariant="danger"
                          successMessage="Nível excluído."
                        />
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      )}

      {tab === "conquistas" && (
        <Card>
          <CardHeader
            title="Conquistas"
            subtitle="Atribuídas automaticamente quando o critério é atingido"
            actions={<AchievementDialog action={saveAchievementAction.bind(null, null)} tracks={config.tracks} />}
          />
          <div className="mt-4">
            <Table>
              <thead>
                <tr>
                  <Th>Conquista</Th>
                  <Th className="hidden md:table-cell">Critério</Th>
                  <Th>Bônus</Th>
                  <Th className="hidden md:table-cell">Obtida por</Th>
                  <Th className="text-right">Ações</Th>
                </tr>
              </thead>
              <tbody>
                {config.achievements.map((a) => {
                  const criteria = parseCriteria(a.criteria);
                  const trackTitle =
                    criteria?.tipo === "TRACK_COMPLETED" ? config.tracks.find((t) => t.id === criteria.trilhaId)?.title : undefined;
                  return (
                    <Tr key={a.id}>
                      <Td>
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-ink">{a.name}</span>
                          {!a.active && <Badge>Inativa</Badge>}
                        </span>
                        <span className="block text-small text-ink-muted">{a.description}</span>
                      </Td>
                      <Td className="hidden md:table-cell">{describeCriteria(criteria, trackTitle)}</Td>
                      <Td>{a.points} pts</Td>
                      <Td className="hidden md:table-cell">{a._count.users} pessoa(s)</Td>
                      <Td className="text-right">
                        <AchievementDialog
                          action={saveAchievementAction.bind(null, a.id)}
                          tracks={config.tracks}
                          initial={{
                            name: a.name,
                            description: a.description,
                            type: criteria?.tipo ?? "CONTENTS_COMPLETED",
                            minimum: criteria && "minimo" in criteria ? String(criteria.minimo) : "1",
                            trackId: criteria?.tipo === "TRACK_COMPLETED" ? criteria.trilhaId : "",
                            points: a.points,
                            active: a.active,
                          }}
                        />
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </Card>
      )}

      {tab === "historico" && <HistoryTab actor={actor} sp={sp} />}
    </>
  );
}

async function HistoryTab({
  actor,
  sp,
}: {
  actor: Awaited<ReturnType<typeof requirePermission>>;
  sp: Record<string, string | string[] | undefined>;
}) {
  const users = await db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const userId = typeof sp.pessoa === "string" && users.some((u) => u.id === sp.pessoa) ? sp.pessoa : undefined;
  const page = Number(typeof sp.pagina === "string" ? sp.pagina : 1) || 1;
  const history = await listPointHistory(db, actor, { userId, page });
  return (
    <div className="grid gap-6 xl:grid-cols-12">
      <Card className="xl:col-span-8">
        <form method="get" className="flex flex-wrap gap-3 p-6" aria-label="Filtrar histórico">
          <input type="hidden" name="aba" value="historico" />
          <Select name="pessoa" defaultValue={userId ?? ""} aria-label="Pessoa" className="sm:max-w-xs">
            <option value="">Todas as pessoas</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="tonal">
            Filtrar
          </Button>
        </form>
        {history.items.length === 0 ? (
          <EmptyState title="Nenhum lançamento" description="Os pontos aparecem aqui conforme as pessoas concluem conteúdos." />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Data</Th>
                  <Th>Pessoa</Th>
                  <Th>Origem</Th>
                  <Th className="text-right">Pontos</Th>
                </tr>
              </thead>
              <tbody>
                {history.items.map((t) => (
                  <Tr key={t.id}>
                    <Td className="whitespace-nowrap">{formatDateTime(t.createdAt)}</Td>
                    <Td>{t.user.name}</Td>
                    <Td>
                      <span className="block text-ink">{t.description}</span>
                      <span className="block text-small text-ink-muted">
                        {POINT_EVENT_LABEL[t.event]}
                        {t.createdBy ? ` · por ${t.createdBy.name}` : ""}
                      </span>
                    </Td>
                    <Td className={cn("text-right font-medium", t.points < 0 ? "text-danger-text" : "text-success-text")}>
                      {t.points > 0 ? `+${t.points}` : t.points}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination
              page={history.page}
              pageCount={history.pageCount}
              total={history.total}
              basePath="/admin/gamificacao"
              params={{ aba: "historico", pessoa: userId }}
            />
          </>
        )}
      </Card>
      <Card className="xl:col-span-4">
        <CardHeader title="Ajuste manual" subtitle="Para corrigir situações excepcionais" />
        <CardBody>
          <AdjustForm action={adjustPointsAction} users={users} />
        </CardBody>
      </Card>
    </div>
  );
}
