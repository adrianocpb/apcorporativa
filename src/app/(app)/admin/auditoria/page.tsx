import type { Metadata } from "next";
import { IconFileSearch, IconFilter } from "@tabler/icons-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/auth/permissions";
import { AUDIT_ACTION_LABELS, listAuditLogs } from "@/server/services/audit";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Auditoria" };

function describe(details: unknown): string {
  if (!details || typeof details !== "object") return "";
  return Object.entries(details as Record<string, unknown>)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ");
}

export default async function AuditPage({ searchParams }: PageProps<"/admin/auditoria">) {
  const actor = await requirePermission(PERMISSIONS.AUDITORIA_VER);
  const sp = await searchParams;
  const action = typeof sp.acao === "string" && sp.acao in AUDIT_ACTION_LABELS ? sp.acao : undefined;
  const page = Number(typeof sp.pagina === "string" ? sp.pagina : 1) || 1;
  const result = await listAuditLogs(db, actor, { action, page });

  return (
    <>
      <PageHeader
        title="Auditoria"
        description="Registro das operações administrativas relevantes. Somente leitura."
      />
      <Card>
        <form method="get" className="flex flex-wrap gap-3 p-6" aria-label="Filtrar auditoria">
          <Select name="acao" defaultValue={action ?? ""} aria-label="Ação" className="sm:max-w-xs">
            <option value="">Todas as ações</option>
            {Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="tonal" icon={<IconFilter />}>
            Filtrar
          </Button>
          {action && (
            <ButtonLink href="/admin/auditoria" variant="ghost">
              Limpar
            </ButtonLink>
          )}
        </form>
        {result.items.length === 0 ? (
          <EmptyState icon={<IconFileSearch />} title="Nenhum registro encontrado" />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Data</Th>
                  <Th>Ação</Th>
                  <Th>Responsável</Th>
                  <Th>Detalhes</Th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((log) => (
                  <Tr key={log.id}>
                    <Td className="whitespace-nowrap">{formatDateTime(log.createdAt)}</Td>
                    <Td className="whitespace-nowrap text-ink">
                      {AUDIT_ACTION_LABELS[log.action] ?? log.action}
                    </Td>
                    <Td>{log.actor?.name ?? "Sistema"}</Td>
                    <Td className="max-w-md text-small break-words text-ink-soft">
                      {describe(log.details) || "—"}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination
              page={result.page}
              pageCount={result.pageCount}
              total={result.total}
              basePath="/admin/auditoria"
              params={{ acao: action }}
            />
          </>
        )}
      </Card>
    </>
  );
}
