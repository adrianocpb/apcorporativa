import type { Metadata } from "next";
import Link from "next/link";
import { IconPlus, IconRoute } from "@tabler/icons-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/auth/permissions";
import { listTracks } from "@/server/services/tracks";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { TRACK_STATUS } from "@/lib/labels";

export const metadata: Metadata = { title: "Trilhas" };

export default async function TracksPage() {
  const actor = await requirePermission(PERMISSIONS.TRILHAS_GERENCIAR);
  const tracks = await listTracks(db, actor);
  return (
    <>
      <PageHeader
        title="Trilhas"
        description="Sequências de aprendizagem com etapas, conteúdos e acompanhamento do progresso."
        actions={
          <ButtonLink href="/admin/trilhas/nova" icon={<IconPlus />}>
            Nova trilha
          </ButtonLink>
        }
      />
      <Card>
        {tracks.length === 0 ? (
          <EmptyState
            icon={<IconRoute />}
            title="Nenhuma trilha criada"
            description="Comece pelo onboarding institucional: boas-vindas, políticas e sistemas que todo novo colaborador precisa conhecer."
            action={
              <ButtonLink href="/admin/trilhas/nova" icon={<IconPlus />}>
                Nova trilha
              </ButtonLink>
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Trilha</Th>
                <Th>Status</Th>
                <Th className="hidden md:table-cell">Conteúdos</Th>
                <Th>Concluíram</Th>
                <Th className="hidden lg:table-cell">Atualizada em</Th>
              </tr>
            </thead>
            <tbody>
              {tracks.map((t) => (
                <Tr key={t.id}>
                  <Td>
                    <Link href={`/admin/trilhas/${t.id}`} className="font-medium text-ink hover:underline">
                      {t.title}
                    </Link>
                    <span className="mt-0.5 flex flex-wrap gap-1">
                      {t.isOnboarding && <Badge tone="primary">Onboarding</Badge>}
                      <Badge>{t.sequential ? "Sequencial" : "Acesso livre"}</Badge>
                    </span>
                  </Td>
                  <Td>
                    <Badge tone={TRACK_STATUS[t.status].tone}>{TRACK_STATUS[t.status].label}</Badge>
                  </Td>
                  <Td className="hidden md:table-cell">{t.itemCount}</Td>
                  <Td className="whitespace-nowrap">
                    {t.completedCount} de {t.enrolled}
                  </Td>
                  <Td className="hidden whitespace-nowrap lg:table-cell">{formatDate(t.updatedAt)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
