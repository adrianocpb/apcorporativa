import { describe, expect, it } from "vitest";
import { db, makeActor, makeUser, setupTestDb } from "../support/db";
import { ForbiddenError } from "@/server/errors";
import {
  addGroupMembers,
  createGroup,
  deleteGroup,
  getGroup,
  listAddableUsers,
  removeGroupMember,
  updateGroup,
} from "@/server/services/groups";
import { setUserGroups } from "@/server/services/users";

setupTestDb();

describe("grupos", () => {
  it("cria, renomeia e recusa nome duplicado", async () => {
    const admin = await makeActor();
    const g = await createGroup(db, admin, { name: "Novos — Financeiro", description: "" });
    expect(g.description).toBeNull();
    await createGroup(db, admin, { name: "Operações", description: "" });
    await expect(
      updateGroup(db, admin, g.id, { name: "Operações", description: "" }),
    ).rejects.toMatchObject({ fieldErrors: { name: expect.any(String) } });
  });

  it("adiciona e remove membros; só exclui grupo vazio", async () => {
    const admin = await makeActor();
    const g = await createGroup(db, admin, { name: "Turma Novembro", description: "" });
    const u1 = await makeUser();
    const u2 = await makeUser();
    expect(await addGroupMembers(db, admin, g.id, [u1.id, u2.id, u1.id])).toBe(2);
    expect((await getGroup(db, admin, g.id)).members).toHaveLength(2);
    expect((await listAddableUsers(db, admin, g.id)).map((u) => u.id)).not.toContain(u1.id);

    await expect(deleteGroup(db, admin, g.id)).rejects.toThrow(/Remova os membros/);
    await removeGroupMember(db, admin, g.id, u1.id);
    await setUserGroups(db, admin, u2.id, []);
    await deleteGroup(db, admin, g.id);
    expect(await db.group.count()).toBe(0);
    // Excluir o grupo não afeta os usuários.
    expect(await db.user.count({ where: { id: { in: [u1.id, u2.id] } } })).toBe(2);
  });

  it("colaborador não gerencia grupos", async () => {
    const colaborador = await makeActor("COLABORADOR");
    await expect(
      createGroup(db, colaborador, { name: "X", description: "" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
