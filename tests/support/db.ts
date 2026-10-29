import { afterAll, beforeEach } from "vitest";
import { createDbClient, type Db } from "@/server/db";
import { seedBase } from "@/server/seed-base";
import { hashPassword } from "@/server/auth/password";
import { validateSessionToken, createSession, type SessionUser } from "@/server/auth/sessions";
import type { RoleKey } from "@/server/auth/permissions";
import { TEST_DATABASE_URL } from "./global-setup";

export const db: Db = createDbClient(TEST_DATABASE_URL);

// Ordem respeita as chaves estrangeiras.
const TABLES = [
  "ContentVersionAsset",
  'UPDATE "Content" SET "currentVersionId" = NULL',
  "ContentVersion",
  "Content",
  "StoredFile",
  'DELETE FROM "Category" WHERE "parentId" IS NOT NULL',
  "Category",
  "AuditLog",
  "LoginAttempt",
  "AuthToken",
  "Session",
  "GroupMember",
  "Group",
  "User",
  "RolePermission",
  "Permission",
  "Role",
];

export async function resetDb() {
  for (const entry of TABLES) {
    await db.$executeRawUnsafe(/\s/.test(entry) ? entry : `DELETE FROM "${entry}"`);
  }
  await seedBase(db);
}

/** Registra reset antes de cada teste e desconexão ao final do arquivo. */
export function setupTestDb() {
  beforeEach(resetDb);
  afterAll(() => db.$disconnect());
}

export const TEST_PASSWORD = "Teste-senha-forte-2026";

let counter = 0;

export async function makeUser(
  opts: {
    role?: RoleKey;
    status?: "ACTIVE" | "INVITED" | "INACTIVE";
    name?: string;
    password?: string | null;
  } = {},
) {
  counter += 1;
  const role = await db.role.findUniqueOrThrow({ where: { key: opts.role ?? "COLABORADOR" } });
  const status = opts.status ?? "ACTIVE";
  const password = opts.password === undefined ? TEST_PASSWORD : opts.password;
  return db.user.create({
    data: {
      name: opts.name ?? `Pessoa Teste ${counter}`,
      email: `pessoa${counter}@empresa.test`,
      username: `pessoa${counter}`,
      roleId: role.id,
      status,
      passwordHash: status === "INVITED" || password === null ? null : await hashPassword(password),
    },
  });
}

/** Cria usuário com sessão válida e devolve o SessionUser, como a aplicação o vê. */
export async function makeActor(role: RoleKey = "ADMIN"): Promise<SessionUser> {
  const user = await makeUser({ role });
  const { token } = await createSession(db, user.id);
  const session = await validateSessionToken(db, token);
  return session!.user;
}
