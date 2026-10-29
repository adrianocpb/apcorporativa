import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArchive, IconRestore, IconSend, IconUsersGroup, IconX } from "@tabler/icons-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/auth/permissions";
import { NotFoundError } from "@/server/errors";
import {
  allowedRules,
  getTrackForEdit,
  getTrackProgress,
  listAddableContents,
  listAssignTargets,
} from "@/server/services/tracks";
import { listCategoryOptions } from "@/server/services/categories";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert, Avatar, Badge, EmptyState, ProgressBar } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { ConfirmActionButton } from "@/components/forms/action-buttons";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { TRACK_STATUS } from "@/lib/labels";
import { TrackBuilder } from "./track-builder";
import { AssignForm } from "./assign-form";
import { TrackForm } from "../track-form";
import { assignTrackAction, removeAssignmentAction, trackStatusAction, updateTrackAction } from "../actions";

export const metadata: Metadata = { title: "Trilha" };

const TABS = [
  { key: "estrutura", label: "Estrutura" },
  { key: "pessoas", label: "Pessoas e progresso" },
  { key: "configuracoes", label: "Configurações" },
] as const;

export default async function TrackAdminPage({ params, searchParams }: PageProps<"/admin/trilhas/[id]">) {
  const actor = await requirePermission(PERMISSIONS.TRILHAS_GERENCIAR);
  const { id } = await params;
  const { aba } = await searchParams;
  const tab = TABS.find((t) => t.key === aba)?.key ?? "estrutura";

  let track;
  try {
    track = await getTrackForEdit(db, actor, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  const status = TRACK_STATUS[track.status];
  const itemCount = track.modules.reduce((s, m) => s + m.items.length, 0);

  return (
    <>
      <PageHeader
        title={track.title}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            {track.isOnboarding && <Badge tone="primary">Onboarding</Badge>}
            <span>{track.sequential ? "Sequência obrigatória" : "Acesso livre"}</span>
          </span>
        }
        back={{ href: "/admin/trilhas", label: "Trilhas" }}
        actions={
          track.status === "DRAFT" ? (
            <ConfirmActionButton
              key="publish"
              action={trackStatusAction.bind(null, track.id, "publish")}
              label="Publicar trilha"
              icon={<IconSend />}
              variant="primary"
              title="Publicar trilha?"
              description="Quem tiver a trilha atribuída passa a vê-la no painel. Você pode continuar ajustando etapas e conteúdos depois."
              confirmLabel="Publicar"
              successMessage="Trilha publicada."
            />
          ) : track.status === "PUBLISHED" ? (
            <ConfirmActionButton
              key="archive"
              action={trackStatusAction.bind(null, track.id, "archive")}
              label="Arquivar"
              icon={<IconArchive />}
              variant="danger-tonal"
              title="Arquivar trilha?"
              description="A trilha deixa de aparecer para quem não concluiu. Progresso e histórico são preservados; quem concluiu continua podendo revisar."
              confirmLabel="Arquivar"
              confirmVariant="danger"
              successMessage="Trilha arquivada."
            />
          ) : (
            <ConfirmActionButton
              key="restore"
              action={trackStatusAction.bind(null, track.id, "restore")}
              label="Restaurar"
              icon={<IconRestore />}
              title="Restaurar trilha?"
              description="A trilha volta ao estado anterior ao arquivamento."
              confirmLabel="Restaurar"
              successMessage="Trilha restaurada."
            />
          )
        }
      />

      {track.status === "DRAFT" && (
        <Alert tone="info" className="mb-6">
          Trilha em rascunho: ninguém a vê ainda. Monte as etapas, atribua às pessoas e publique.
          {itemCount === 0 && " É preciso pelo menos um conteúdo publicado para publicar."}
        </Alert>
      )}

      <nav className="mb-6 flex gap-1 border-b border-line" aria-label="Seções da trilha">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/trilhas/${track.id}?aba=${t.key}`}
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

      {tab === "estrutura" && <StructureTab trackId={track.id} track={track} addablePromise={listAddableContents(db, actor, track.id)} />}
      {tab === "pessoas" && <PeopleTab trackId={track.id} track={track} actor={actor} />}
      {tab === "configuracoes" && (
        <Card className="max-w-3xl">
          <CardBody>
            <TrackForm
              action={updateTrackAction.bind(null, track.id)}
              categories={await listCategoryOptions(db, actor).catch(() => [])}
              submitLabel="Salvar configurações"
              initial={{
                title: track.title,
                description: track.description ?? "",
                categoryId: track.categoryId ?? "",
                sequential: track.sequential,
                isOnboarding: track.isOnboarding,
                videoThresholdPct: track.videoThresholdPct,
                minReadSeconds: track.minReadSeconds,
              }}
            />
          </CardBody>
        </Card>
      )}
    </>
  );
}

type Track = Awaited<ReturnType<typeof getTrackForEdit>>;

async function StructureTab({
  trackId,
  track,
  addablePromise,
}: {
  trackId: string;
  track: Track;
  addablePromise: ReturnType<typeof listAddableContents>;
}) {
  const addable = await addablePromise;
  const modules = track.modules.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    items: m.items.map((i) => ({
      id: i.id,
      title: i.content.title,
      type: i.content.type,
      contentStatus: i.content.status,
      required: i.required,
      completionRule: i.completionRule,
      rules: allowedRules(i.content.type),
    })),
  }));
  // A chave muda quando a estrutura salva muda, sincronizando o estado local do editor.
  const key = modules.map((m) => `${m.id}:${m.items.map((i) => `${i.id}${i.required ? 1 : 0}${i.completionRule}`).join(",")}`).join("|");
  return (
    <TrackBuilder
      key={key}
      trackId={trackId}
      modules={modules}
      addable={addable.map((c) => ({ id: c.id, title: c.title, type: c.type, category: c.category?.name ?? null }))}
    />
  );
}

async function PeopleTab({
  trackId,
  track,
  actor,
}: {
  trackId: string;
  track: Track;
  actor: Awaited<ReturnType<typeof requirePermission>>;
}) {
  const [targets, progress] = await Promise.all([
    listAssignTargets(db, actor, trackId),
    getTrackProgress(db, actor, trackId),
  ]);
  return (
    <div className="grid gap-6 xl:grid-cols-12">
      <div className="flex flex-col gap-6 xl:col-span-5">
        <Card>
          <CardHeader title="Atribuir" subtitle="A pessoas ou grupos inteiros" />
          <CardBody>
            {track.status === "ARCHIVED" ? (
              <p className="text-body text-ink-soft">Restaure a trilha para atribuí-la.</p>
            ) : (
              <AssignForm action={assignTrackAction.bind(null, trackId)} users={targets.users} groups={targets.groups} />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Atribuições" subtitle="Remover não apaga o histórico de quem já começou" />
          <CardBody>
            {track.assignments.length === 0 ? (
              <p className="text-body text-ink-soft">Nenhuma atribuição ainda.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {track.assignments.map((a) => (
                  <li key={a.id} className="flex items-center gap-3">
                    {a.group ? (
                      <span className="flex size-8 items-center justify-center rounded-full bg-info-subtle text-info-text" aria-hidden="true">
                        <IconUsersGroup className="size-4" />
                      </span>
                    ) : (
                      <Avatar name={a.user?.name ?? "?"} size="sm" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body text-ink">{a.group?.name ?? a.user?.name}</span>
                      <span className="block text-small text-ink-muted">
                        {a.group ? `Grupo · ${a.group._count.members} membro(s)` : a.user?.email}
                      </span>
                    </span>
                    <ConfirmActionButton
                      action={removeAssignmentAction.bind(null, trackId, a.id)}
                      label="Remover"
                      icon={<IconX />}
                      variant="ghost"
                      size="sm"
                      title="Remover atribuição?"
                      description="Quem ainda não concluiu deixa de ver a trilha. O progresso e as conclusões ficam guardados e voltam se a trilha for atribuída de novo."
                      confirmLabel="Remover"
                      confirmVariant="danger"
                      successMessage="Atribuição removida."
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
      <Card className="xl:col-span-7">
        <CardHeader
          title="Progresso"
          subtitle={track.status === "DRAFT" ? "As matrículas são criadas ao publicar a trilha" : "Onde cada pessoa está"}
        />
        {progress.length === 0 ? (
          <EmptyState title="Ninguém nesta trilha ainda" description="Atribua a pessoas ou grupos e publique a trilha." />
        ) : (
          <div className="mt-4">
            <Table>
              <thead>
                <tr>
                  <Th>Pessoa</Th>
                  <Th>Progresso</Th>
                  <Th className="hidden md:table-cell">Onde parou</Th>
                  <Th className="hidden lg:table-cell">Última atividade</Th>
                </tr>
              </thead>
              <tbody>
                {progress.map((row) => (
                  <Tr key={row.enrollment.id}>
                    <Td>
                      <Link href={`/admin/usuarios/${row.user.id}`} className="block font-medium text-ink hover:underline">
                        {row.user.name}
                      </Link>
                      <span className="block text-small text-ink-muted">{row.user.department ?? row.user.email}</span>
                    </Td>
                    <Td className="min-w-[160px]">
                      {row.completed ? (
                        <Badge tone="success">Concluída em {formatDateTime(row.enrollment.completedAt)}</Badge>
                      ) : (
                        <ProgressBar value={row.percent} label={`Progresso de ${row.user.name}`} />
                      )}
                    </Td>
                    <Td className="hidden md:table-cell">
                      {row.completed ? (
                        "—"
                      ) : row.enrollment.status === "NOT_STARTED" ? (
                        <span className="text-ink-muted">Não iniciou</span>
                      ) : row.currentItem ? (
                        <>
                          <span className="block text-ink">{row.currentItem.title}</span>
                          <span className="block text-small text-ink-muted">{row.currentItem.module}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td className="hidden whitespace-nowrap lg:table-cell">{formatDateTime(row.enrollment.lastActivityAt)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
