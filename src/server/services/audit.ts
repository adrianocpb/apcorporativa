import type { Prisma } from "@/generated/prisma/client";
import type { Db } from "@/server/db";
import { PERMISSIONS } from "@/server/auth/permissions";
import type { SessionUser } from "@/server/auth/sessions";
import { assertPermission } from "@/server/services/guard";

type DbOrTx = Db | Prisma.TransactionClient;

export type AuditEntry = {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Prisma.InputJsonValue;
  ip?: string | null;
};

// Nunca inclua senhas, hashes ou tokens em `details`.
export async function audit(db: DbOrTx, entry: AuditEntry) {
  await db.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      details: entry.details,
      ip: entry.ip ?? null,
    },
  });
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "usuario.criado": "Usuário criado",
  "usuario.editado": "Usuário editado",
  "usuario.desativado": "Usuário desativado",
  "usuario.reativado": "Usuário reativado",
  "usuario.convite_gerado": "Link de convite gerado",
  "usuario.convite_aceito": "Convite aceito",
  "usuario.redefinicao_gerada": "Link de redefinição gerado",
  "usuario.senha_redefinida": "Senha redefinida",
  "usuario.senha_alterada": "Senha alterada pelo próprio usuário",
  "usuario.grupos_alterados": "Grupos do usuário alterados",
  "grupo.criado": "Grupo criado",
  "grupo.editado": "Grupo editado",
  "grupo.excluido": "Grupo excluído",
  "grupo.membros_adicionados": "Membros adicionados ao grupo",
  "grupo.membro_removido": "Membro removido do grupo",
  "sistema.admin_inicial": "Administrador inicial criado",
};

export const AUDIT_PAGE_SIZE = 30;

export async function listAuditLogs(
  db: Db,
  actor: SessionUser,
  filters: { action?: string; page?: number },
) {
  assertPermission(actor, PERMISSIONS.AUDITORIA_VER);
  const page = Math.max(1, filters.page ?? 1);
  const where: Prisma.AuditLogWhereInput = filters.action ? { action: filters.action } : {};
  const [total, items] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
      include: { actor: { select: { id: true, name: true } } },
    }),
  ]);
  return { total, items, page, pageCount: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)) };
}
