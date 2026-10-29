import type { Db } from "@/server/db";
import {
  PERMISSION_DESCRIPTIONS,
  ROLES,
  type PermissionKey,
  type RoleKey,
} from "@/server/auth/permissions";
import { seedGamificationDefaults } from "@/server/services/gamification";

// Dados estruturais obrigatórios (papéis e permissões). Idempotente e sem usuários:
// o primeiro administrador é criado por `npm run admin:criar`.
export async function seedBase(db: Db) {
  const permissionIds = new Map<PermissionKey, string>();
  for (const [key, description] of Object.entries(PERMISSION_DESCRIPTIONS) as [
    PermissionKey,
    string,
  ][]) {
    const permission = await db.permission.upsert({
      where: { key },
      update: { description },
      create: { key, description },
    });
    permissionIds.set(key, permission.id);
  }

  for (const [key, role] of Object.entries(ROLES) as [RoleKey, (typeof ROLES)[RoleKey]][]) {
    const saved = await db.role.upsert({
      where: { key },
      update: { name: role.name, description: role.description },
      create: { key, name: role.name, description: role.description },
    });
    // O catálogo em código é a fonte da verdade: sincroniza as permissões do papel.
    await db.rolePermission.deleteMany({ where: { roleId: saved.id } });
    if (role.permissions.length > 0) {
      await db.rolePermission.createMany({
        data: role.permissions.map((p) => ({
          roleId: saved.id,
          permissionId: permissionIds.get(p)!,
        })),
      });
    }
  }

  await seedGamificationDefaults(db);
}
