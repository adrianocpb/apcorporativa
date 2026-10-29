import type { Metadata } from "next";
import Link from "next/link";
import { IconSearch, IconUserPlus, IconUsers } from "@tabler/icons-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/auth/permissions";
import { listDepartments, listUsers } from "@/server/services/users";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, Badge, EmptyState } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { ROLE_OPTIONS, USER_STATUS } from "@/lib/labels";

export const metadata: Metadata = { title: "Usuários" };

const STATUS_VALUES = ["ACTIVE", "INVITED", "INACTIVE"] as const;

function one(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export default async function UsersPage({ searchParams }: PageProps<"/admin/usuarios">) {
  const actor = await requirePermission(PERMISSIONS.USUARIOS_GERENCIAR);
  const sp = await searchParams;
  const filters = {
    q: one(sp.q)?.slice(0, 100),
    status: STATUS_VALUES.find((s) => s === one(sp.status)),
    department: one(sp.area),
    roleKey: ROLE_OPTIONS.find((r) => r.value === one(sp.perfil))?.value,
    page: Number(one(sp.pagina)) || 1,
  };
  const [result, departments] = await Promise.all([
    listUsers(db, actor, filters),
    listDepartments(db, actor),
  ]);
  const hasFilters = !!(filters.q || filters.status || filters.department || filters.roleKey);

  return (
    <>
      <PageHeader
        title="Usuários"
        description="Cadastre colaboradores, gere convites e controle o acesso."
        actions={
          <ButtonLink href="/admin/usuarios/novo" icon={<IconUserPlus />}>
            Novo usuário
          </ButtonLink>
        }
      />
      <Card>
        <form
          method="get"
          className="grid gap-3 p-6 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_auto]"
          role="search"
          aria-label="Filtrar usuários"
        >
          <Input
            name="q"
            defaultValue={filters.q}
            placeholder="Buscar por nome, e-mail ou login"
            aria-label="Buscar por nome, e-mail ou login"
          />
          <Select name="status" defaultValue={filters.status ?? ""} aria-label="Status">
            <option value="">Todos os status</option>
            {STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {USER_STATUS[s].label}
              </option>
            ))}
          </Select>
          <Select name="area" defaultValue={filters.department ?? ""} aria-label="Área">
            <option value="">Todas as áreas</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
          <Select name="perfil" defaultValue={filters.roleKey ?? ""} aria-label="Perfil">
            <option value="">Todos os perfis</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Button type="submit" variant="tonal" icon={<IconSearch />}>
              Filtrar
            </Button>
            {hasFilters && (
              <ButtonLink href="/admin/usuarios" variant="ghost">
                Limpar
              </ButtonLink>
            )}
          </div>
        </form>

        {result.items.length === 0 ? (
          <EmptyState
            icon={<IconUsers />}
            title={hasFilters ? "Nenhum usuário encontrado" : "Nenhum usuário cadastrado"}
            description={
              hasFilters
                ? "Ajuste a busca ou limpe os filtros."
                : "Cadastre o primeiro colaborador para gerar o convite de acesso."
            }
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Usuário</Th>
                  <Th className="hidden xl:table-cell">Login</Th>
                  <Th>Área / cargo</Th>
                  <Th>Perfil</Th>
                  <Th>Status</Th>
                  <Th className="hidden lg:table-cell">Último acesso</Th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((u) => (
                  <Tr key={u.id}>
                    <Td>
                      <Link
                        href={`/admin/usuarios/${u.id}`}
                        className="flex items-center gap-3 hover:underline"
                      >
                        <Avatar name={u.name} size="sm" />
                        <span className="min-w-0">
                          <span className="block font-medium text-ink">{u.name}</span>
                          <span className="block text-small text-ink-muted">{u.email}</span>
                        </span>
                      </Link>
                    </Td>
                    <Td className="hidden xl:table-cell">{u.username}</Td>
                    <Td>
                      <span className="block">{u.department ?? "—"}</span>
                      {u.jobTitle && (
                        <span className="block text-small text-ink-muted">{u.jobTitle}</span>
                      )}
                    </Td>
                    <Td>{u.role.name}</Td>
                    <Td>
                      <Badge tone={USER_STATUS[u.status].tone}>{USER_STATUS[u.status].label}</Badge>
                    </Td>
                    <Td className="hidden whitespace-nowrap lg:table-cell">{formatDateTime(u.lastLoginAt)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination
              page={result.page}
              pageCount={result.pageCount}
              total={result.total}
              basePath="/admin/usuarios"
              params={{
                q: filters.q,
                status: filters.status,
                area: filters.department,
                perfil: filters.roleKey,
              }}
            />
          </>
        )}
      </Card>
    </>
  );
}
