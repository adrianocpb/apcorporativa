import { hasPermission, type PermissionKey } from "@/server/auth/permissions";
import type { SessionUser } from "@/server/auth/sessions";
import { ForbiddenError } from "@/server/errors";

// Todo serviço administrativo valida a permissão de quem chama, independentemente
// da página ou action que o invocou (defesa em profundidade).
export function assertPermission(actor: SessionUser, permission: PermissionKey) {
  if (!hasPermission(actor, permission)) throw new ForbiddenError();
}
