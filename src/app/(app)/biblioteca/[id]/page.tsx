import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconCircleCheck, IconRoute } from "@tabler/icons-react";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/current-user";
import { NotFoundError } from "@/server/errors";
import { getLibraryContent } from "@/server/services/library";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { ContentViewer } from "@/components/content/content-viewer";
import { categoryPath, LibraryRow } from "@/components/library/library-card";
import { FavoriteButton, ViewRecorder } from "@/components/library/library-widgets";
import { formatDate } from "@/lib/format";
import { CONTENT_TYPE } from "@/lib/labels";

export const metadata: Metadata = { title: "Conteúdo" };

export default async function LibraryContentPage({ params }: PageProps<"/biblioteca/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  let data;
  try {
    data = await getLibraryContent(db, user, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  const { content, isFavorite, completedAt, tracks, related } = data;
  const version = content.currentVersion!;

  return (
    <>
      <ViewRecorder contentId={content.id} />
      <PageHeader
        title={CONTENT_TYPE[content.type]?.label ?? "Conteúdo"}
        description={[categoryPath(content.category), version.publishedAt ? `Atualizado em ${formatDate(version.publishedAt)}` : null]
          .filter(Boolean)
          .join(" · ")}
        back={{ href: "/biblioteca", label: "Central de Conhecimento" }}
        actions={<FavoriteButton contentId={content.id} initial={isFavorite} />}
      />
      <div className="grid gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardBody>
            <ContentViewer type={content.type} version={version} />
          </CardBody>
        </Card>
        <div className="flex flex-col gap-6 xl:col-span-4">
          {completedAt && (
            <Alert tone="success">
              <span className="inline-flex items-center gap-1">
                <IconCircleCheck className="size-4" aria-hidden="true" /> Você concluiu este conteúdo em {formatDate(completedAt)}.
              </span>
            </Alert>
          )}
          {tracks.length > 0 && (
            <Card>
              <CardHeader title="Nas suas trilhas" />
              <CardBody>
                <ul className="flex flex-col gap-2">
                  {tracks.map((t) => (
                    <li key={t.itemId}>
                      <Link href={`/trilhas/${t.trackId}/item/${t.itemId}`} className="inline-flex items-center gap-2 text-body text-primary-text hover:underline">
                        <IconRoute className="size-4" aria-hidden="true" /> {t.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
          {related.length > 0 && (
            <Card>
              <CardHeader title="Relacionados" subtitle="Da mesma categoria" />
              <div className="mt-2 flex flex-col px-2 pb-3">
                {related.map((r) => (
                  <LibraryRow key={r.id} item={r} />
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
