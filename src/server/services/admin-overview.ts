import type { Db } from "@/server/db";
import { PERMISSIONS } from "@/server/auth/permissions";
import type { SessionUser } from "@/server/auth/sessions";
import { assertPermission } from "@/server/services/guard";

export async function getAdminOverview(db: Db, actor: SessionUser) {
  assertPermission(actor, PERMISSIONS.ADMIN_ACESSAR);
  const [byStatus, groups, recentUsers] = await Promise.all([
    db.user.groupBy({ by: ["status"], _count: { _all: true } }),
    db.group.count(),
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, email: true, status: true, createdAt: true },
    }),
  ]);
  const count = (status: string) => byStatus.find((s) => s.status === status)?._count._all ?? 0;
  return {
    active: count("ACTIVE"),
    invited: count("INVITED"),
    inactive: count("INACTIVE"),
    groups,
    recentUsers,
  };
}
