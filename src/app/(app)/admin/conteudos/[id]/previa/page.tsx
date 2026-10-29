import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/auth/permissions";
import { NotFoundError } from "@/server/errors";
import { getVersionForPreview } from "@/server/services/contents";
import { Card, CardBody } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { ContentViewer } from "@/components/content/content-viewer";
import { VERSION_STATUS } from "@/lib/labels";

export const metadata: Metadata = { title: "Pré-visualização" };

export default async function PreviewPage({ params, searchParams }: PageProps<"/admin/conteudos/[id]/previa">) {
  const actor = await requirePermission(PERMISSIONS.CONTEUDOS_GERENCIAR);
  const { id } = await params;
  const { versao } = await searchParams;
  let data;
  try {
    data = await getVersionForPreview(db, actor, id, typeof versao === "string" ? versao : undefined);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  const { content, version } = data;
  return (
    <>
      <PageHeader
        title="Pré-visualização"
        description="Assim o conteúdo aparecerá para os colaboradores."
        back={{ href: `/admin/conteudos/${content.id}`, label: "Voltar à edição" }}
      />
      <Alert tone={version.status === "PUBLISHED" ? "success" : "info"} className="mb-6">
        Versão {version.number} — {VERSION_STATUS[version.status].label.toLowerCase()}
        {version.status === "DRAFT" && ". Ainda não está visível para os colaboradores."}
      </Alert>
      <Card className="max-w-4xl">
        <CardBody>
          <ContentViewer type={content.type} version={version} />
        </CardBody>
      </Card>
    </>
  );
}
