import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArchive, IconArrowBackUp, IconEye, IconRestore, IconTrash } from "@tabler/icons-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/auth/permissions";
import { NotFoundError } from "@/server/errors";
import { getContentForEdit } from "@/server/services/contents";
import { listCategoryOptions } from "@/server/services/categories";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert, Badge } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { ConfirmActionButton } from "@/components/forms/action-buttons";
import { ContentTypeIcon } from "@/components/content/content-type-icon";
import type { RichNode } from "@/lib/rich-text";
import { formatDateTime } from "@/lib/format";
import { CONTENT_STATUS, CONTENT_TYPE, VERSION_STATUS } from "@/lib/labels";
import { ContentForm } from "../content-form";
import {
  archiveContentAction,
  deleteContentAction,
  discardDraftAction,
  saveContentAction,
} from "../actions";

export const metadata: Metadata = { title: "Editar conteúdo" };

export default async function EditContentPage({ params }: PageProps<"/admin/conteudos/[id]">) {
  const actor = await requirePermission(PERMISSIONS.CONTEUDOS_GERENCIAR);
  const { id } = await params;
  let data;
  try {
    data = await getContentForEdit(db, actor, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  const { content, draft, current, versions } = data;
  const categories = await listCategoryOptions(db, actor);
  // Categoria arquivada continua visível no seletor enquanto estiver ligada ao conteúdo.
  if (content.category && content.category.status === "ARCHIVED") {
    categories.unshift({ id: content.category.id, label: `${content.category.name} (arquivada)` });
  }
  const editing = draft ?? current ?? versions[0];
  const archived = content.status === "ARCHIVED";
  const neverPublished = !content.currentVersionId && versions.every((v) => v.status === "DRAFT");
  const status = CONTENT_STATUS[content.status];

  return (
    <>
      <PageHeader
        title={content.title}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {CONTENT_TYPE[content.type].label}
            <Badge tone={status.tone}>{status.label}</Badge>
            {draft && content.status === "PUBLISHED" && <Badge tone="info">Alteração pendente</Badge>}
          </span>
        }
        back={{ href: "/admin/conteudos", label: "Conteúdos" }}
        actions={
          <>
            <ButtonLink href={`/admin/conteudos/${content.id}/previa`} variant="tonal" icon={<IconEye />}>
              Pré-visualizar
            </ButtonLink>
            {draft && current && !archived && (
              <ConfirmActionButton
                action={discardDraftAction.bind(null, content.id)}
                label="Descartar alterações"
                icon={<IconArrowBackUp />}
                title="Descartar alterações?"
                description={`O rascunho (versão ${draft.number}) será removido. A versão publicada continua como está.`}
                confirmLabel="Descartar"
                confirmVariant="danger"
                successMessage="Alterações descartadas."
              />
            )}
            {neverPublished ? (
              <ConfirmActionButton
                action={deleteContentAction.bind(null, content.id)}
                label="Excluir"
                icon={<IconTrash />}
                variant="danger-tonal"
                title="Excluir conteúdo?"
                description="Este conteúdo nunca foi publicado e será removido definitivamente."
                confirmLabel="Excluir"
                confirmVariant="danger"
                successMessage="Conteúdo excluído."
              />
            ) : archived ? (
              <ConfirmActionButton
                action={archiveContentAction.bind(null, content.id, false)}
                label="Restaurar"
                icon={<IconRestore />}
                title="Restaurar conteúdo?"
                description="O conteúdo volta a ficar disponível com a versão vigente."
                confirmLabel="Restaurar"
                successMessage="Conteúdo restaurado."
              />
            ) : (
              <ConfirmActionButton
                action={archiveContentAction.bind(null, content.id, true)}
                label="Arquivar"
                icon={<IconArchive />}
                variant="danger-tonal"
                title="Arquivar conteúdo?"
                description="O conteúdo deixa de aparecer para os colaboradores. Versões, arquivos e histórico são preservados e ele pode ser restaurado."
                confirmLabel="Arquivar"
                confirmVariant="danger"
                successMessage="Conteúdo arquivado."
              />
            )}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardBody className="flex flex-col gap-5">
            {archived ? (
              <Alert tone="warning" title="Conteúdo arquivado">
                Restaure o conteúdo para editá-lo ou publicá-lo novamente.
              </Alert>
            ) : (
              <>
                {current && !draft && (
                  <Alert tone="info">
                    Você está vendo a versão publicada ({current.number}). Ao salvar, as alterações
                    ficam em rascunho até você publicar — a versão atual continua disponível.
                  </Alert>
                )}
                {current && draft && (
                  <Alert tone="info">
                    Editando o rascunho (versão {draft.number}). A versão {current.number} continua
                    publicada até você publicar este rascunho.
                  </Alert>
                )}
                <ContentForm
                  key={editing.id}
                  type={content.type}
                  action={saveContentAction.bind(null, content.id)}
                  categories={categories}
                  hasPublished={!!current}
                  initial={{
                    title: editing.title,
                    description: editing.description ?? "",
                    categoryId: content.categoryId ?? "",
                    inLibrary: content.inLibrary,
                    file: editing.file
                      ? { id: editing.file.id, name: editing.file.originalName, size: editing.file.size }
                      : null,
                    durationSeconds: editing.durationSeconds,
                    url: editing.url ?? "",
                    body: (editing.body as RichNode | null) ?? null,
                  }}
                />
              </>
            )}
          </CardBody>
        </Card>

        <div className="flex flex-col gap-6 xl:col-span-4">
          <Card>
            <CardBody className="flex items-start gap-4">
              <ContentTypeIcon type={content.type} />
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-body">
                <dt className="text-small text-ink-muted">Autor</dt>
                <dd className="text-ink">{content.author?.name ?? "—"}</dd>
                <dt className="text-small text-ink-muted">Criado em</dt>
                <dd className="text-ink">{formatDateTime(content.createdAt)}</dd>
                <dt className="text-small text-ink-muted">1ª publicação</dt>
                <dd className="text-ink">{formatDateTime(content.publishedAt)}</dd>
                <dt className="text-small text-ink-muted">Biblioteca</dt>
                <dd className="text-ink">{content.inLibrary ? "Visível" : "Só em trilhas"}</dd>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Histórico de versões" subtitle="Versões anteriores ficam preservadas" />
            <CardBody>
              <ol className="flex flex-col gap-4">
                {versions.map((v) => (
                  <li key={v.id} className="flex flex-col gap-1 border-b border-line pb-4 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-h6 font-medium text-ink">Versão {v.number}</span>
                      <Badge tone={VERSION_STATUS[v.status].tone}>{VERSION_STATUS[v.status].label}</Badge>
                      {v.requiresRecompletion && <Badge tone="warning">Exige nova conclusão</Badge>}
                    </div>
                    <p className="text-small text-ink-muted">
                      {v.publishedAt
                        ? `Publicada em ${formatDateTime(v.publishedAt)}${v.publishedBy ? ` por ${v.publishedBy.name}` : ""}`
                        : `Atualizada em ${formatDateTime(v.updatedAt)}`}
                    </p>
                    {v.changeNote && <p className="text-small text-ink-soft">{v.changeNote}</p>}
                    <Link
                      href={`/admin/conteudos/${content.id}/previa?versao=${v.id}`}
                      className="self-start text-small text-primary-text hover:underline"
                    >
                      Visualizar versão {v.number}
                    </Link>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
