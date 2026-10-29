import type { Metadata } from "next";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/auth/permissions";
import { listCategoryOptions } from "@/server/services/categories";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { TrackForm } from "../track-form";
import { createTrackAction } from "../actions";

export const metadata: Metadata = { title: "Nova trilha" };

export default async function NewTrackPage() {
  const actor = await requirePermission(PERMISSIONS.TRILHAS_GERENCIAR);
  const categories = await listCategoryOptions(db, actor).catch(() => []);
  return (
    <>
      <PageHeader
        title="Nova trilha"
        description="Depois de criar, monte as etapas, adicione os conteúdos e atribua às pessoas."
        back={{ href: "/admin/trilhas", label: "Trilhas" }}
      />
      <Card className="max-w-3xl">
        <CardBody>
          <TrackForm
            action={createTrackAction}
            categories={categories}
            submitLabel="Criar trilha"
            initial={{
              title: "",
              description: "",
              categoryId: "",
              sequential: true,
              isOnboarding: false,
              videoThresholdPct: 90,
              minReadSeconds: 30,
            }}
          />
        </CardBody>
      </Card>
    </>
  );
}
