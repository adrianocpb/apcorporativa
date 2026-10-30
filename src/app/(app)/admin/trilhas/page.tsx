import type { Metadata } from "next";
import Link from "next/link";
import { IconChevronDown, IconChevronUp, IconPlus, IconRoute } from "@tabler/icons-react";
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
import { moveTrackAction } from "./actions";

export const metadata: Metadata = { title: "Trilhas" };

export default async function TracksPage() {
  const actor = await requirePermission(PERMISSIONS.TRILHAS_GERENCIAR);
  const tracks = await listTracks(db, actor);
  return (
    <>
      <PageHeader
        title="Trilhas"
        description="A ordem desta lista é a ordem em que as trilhas aparecem para o colaborador (concluídas vão para o fim)."
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
                <Th className="w-[84px]">Ordem</Th>
                <Th>Trilha</Th>
                <Th>Status</Th>
                <Th className="hidden md:table-cell">Conteúdos</Th>
                <Th>Concluíram</Th>
                <Th className="hidden lg:table-cell">Atualizada em</Th>
              </tr>
            </thead>
            <tbody>
              {tracks.map((t, i) => (
                <Tr key={t.id}>
                  <Td>
                    <div className="flex">
                      <form action={moveTrackAction.bind(null, t.id, "up")}>
                        <button
                          type="submit"
                          disabled={i === 0}
                          className="flex size-[30px] items-center justify-center rounded-md text-ink-soft hover:bg-surface-hover disabled:opacity-30"
                          aria-label={`Mover ${t.title} para cima`}
                        >
                          <IconChevronUp className="size-4" />
                        </button>
                      </form>
                      <form action={moveTrackAction.bind(null, t.id, "down")}>
                        <button
                          type="submit"
                          disabled={i === tracks.length - 1}
                          className="flex size-[30px] items-center justify-center rounded-md text-ink-soft hover:bg-surface-hover disabled:opacity-30"
                          aria-label={`Mover ${t.title} para baixo`}
                        >
                          <IconChevronDown className="size-4" />
                        </button>
                      </form>
                    </div>
                  </Td>
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
