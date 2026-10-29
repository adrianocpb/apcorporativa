import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/auth/permissions";

// Barreira da área administrativa. Cada página e cada action validam também
// a permissão específica — o layout não é a única proteção.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requirePermission(PERMISSIONS.ADMIN_ACESSAR);
  return children;
}
