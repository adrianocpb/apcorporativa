import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/auth/permissions";
import { listCategoryOptions } from "@/server/services/categories";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ContentTypeIcon } from "@/components/content/content-type-icon";
import { CONTENT_TYPE } from "@/lib/labels";
import { CONTENT_TYPES } from "@/lib/validation/contents";
import { ContentForm } from "../content-form";
import { createContentAction } from "../actions";

export const metadata: Metadata = { title: "Novo conteúdo" };

export default async function NewContentPage({ searchParams }: PageProps<"/admin/conteudos/novo">) {
  const actor = await requirePermission(PERMISSIONS.CONTEUDOS_GERENCIAR);
  const { tipo } = await searchParams;
  const type = CONTENT_TYPES.find((t) => t === tipo);

  if (!type) {
    return (
      <>
        <PageHeader
          title="Novo conteúdo"
          description="Escolha o tipo de conteúdo."
          back={{ href: "/admin/conteudos", label: "Conteúdos" }}
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {CONTENT_TYPES.map((t) => (
            <Link
              key={t}
              href={`/admin/conteudos/novo?tipo=${t}`}
              className="flex items-start gap-4 rounded-lg bg-surface p-5 shadow-card transition-shadow hover:shadow-raised"
            >
              <ContentTypeIcon type={t} size="lg" />
              <span>
                <span className="block text-h6 font-medium text-ink">{CONTENT_TYPE[t].label}</span>
                <span className="block text-small text-ink-soft">{CONTENT_TYPE[t].description}</span>
              </span>
            </Link>
          ))}
        </div>
      </>
    );
  }

  const categories = await listCategoryOptions(db, actor);
  return (
    <>
      <PageHeader
        title={`Novo conteúdo: ${CONTENT_TYPE[type].label.toLowerCase()}`}
        description="Salve como rascunho para continuar depois ou publique quando estiver pronto."
        back={{ href: "/admin/conteudos/novo", label: "Escolher outro tipo" }}
      />
      <Card className="max-w-4xl">
        <CardBody>
          <ContentForm
            type={type}
            action={createContentAction.bind(null, type)}
            categories={categories}
            hasPublished={false}
            initial={{
              title: "",
              description: "",
              categoryId: "",
              inLibrary: true,
              file: null,
              durationSeconds: null,
              url: "",
              body: null,
            }}
          />
        </CardBody>
      </Card>
    </>
  );
}
