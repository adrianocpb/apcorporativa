import { describe, expect, it } from "vitest";
import { db, makeActor, makeUser, setupTestDb } from "../support/db";
import { ForbiddenError } from "@/server/errors";
import { createSession, validateSessionToken } from "@/server/auth/sessions";
import {
  createUser,
  deactivateUser,
  generateInviteLink,
  generatePasswordResetLink,
  getUser,
  listUsers,
  reactivateUser,
  setUserGroups,
  updateUser,
} from "@/server/services/users";
import { listAuditLogs } from "@/server/services/audit";

setupTestDb();

const validInput = {
  name: "Ana Pereira",
  email: "Ana.Pereira@Empresa.test",
  username: "ana.pereira",
  department: "Financeiro",
  jobTitle: "Analista",
  hireDate: "2026-11-03",
  roleKey: "COLABORADOR",
};

describe("permissões no servidor", () => {
  it("colaborador não executa nenhuma operação administrativa", async () => {
    const colaborador = await makeActor("COLABORADOR");
    const other = await makeUser();
    const calls = [
      () => listUsers(db, colaborador),
      () => getUser(db, colaborador, other.id),
      () => createUser(db, colaborador, validInput),
      () => updateUser(db, colaborador, other.id, validInput),
      () => deactivateUser(db, colaborador, other.id),
      () => reactivateUser(db, colaborador, other.id),
      () => generateInviteLink(db, colaborador, other.id),
      () => generatePasswordResetLink(db, colaborador, other.id),
      () => setUserGroups(db, colaborador, other.id, []),
      () => listAuditLogs(db, colaborador, {}),
    ];
    for (const call of calls) {
      await expect(call()).rejects.toBeInstanceOf(ForbiddenError);
    }
    // Nada foi alterado.
    expect((await db.user.findUnique({ where: { id: other.id } }))?.status).toBe("ACTIVE");
    expect(await db.auditLog.count()).toBe(0);
  });

  it("colaborador não consegue promover a si mesmo", async () => {
    const colaborador = await makeActor("COLABORADOR");
    await expect(
      updateUser(db, colaborador, colaborador.id, { ...validInput, roleKey: "ADMIN" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("cadastro de usuários", () => {
  it("cria com convite pendente, sem senha, normaliza e audita", async () => {
    const admin = await makeActor();
    const { user, invite } = await createUser(db, admin, validInput);
    expect(user.status).toBe("INVITED");
    expect(user.passwordHash).toBeNull();
    expect(user.email).toBe("ana.pereira@empresa.test");
    expect(user.hireDate?.toISOString().slice(0, 10)).toBe("2026-11-03");
    expect(invite.url).toMatch(/\/convite\/[A-Za-z0-9_-]{43}$/);
    const log = await db.auditLog.findFirst({ where: { action: "usuario.criado" } });
    expect(log?.actorId).toBe(admin.id);
    expect(JSON.stringify(log?.details)).not.toContain(invite.url.split("/").pop());
  });

  it("recusa e-mail ou login duplicados com mensagem por campo", async () => {
    const admin = await makeActor();
    await createUser(db, admin, validInput);
    await expect(
      createUser(db, admin, { ...validInput, username: "outro.login" }),
    ).rejects.toMatchObject({ fieldErrors: { email: "Já existe um usuário com este e-mail." } });
  });

  it("valida campos obrigatórios", async () => {
    const admin = await makeActor();
    await expect(
      createUser(db, admin, { ...validInput, email: "invalido", username: "A B" }),
    ).rejects.toMatchObject({
      fieldErrors: { email: expect.any(String), username: expect.any(String) },
    });
  });

  it("mudança de perfil vale na próxima requisição da sessão existente", async () => {
    const admin = await makeActor();
    const { user } = await createUser(db, admin, validInput);
    await db.user.update({ where: { id: user.id }, data: { status: "ACTIVE" } });
    const { token } = await createSession(db, user.id);
    expect((await validateSessionToken(db, token))?.user.permissions).toEqual([]);

    await updateUser(db, admin, user.id, { ...validInput, roleKey: "ADMIN" });
    expect((await validateSessionToken(db, token))?.user.permissions).toContain(
      "usuarios.gerenciar",
    );
  });
});

describe("ativação e desativação", () => {
  it("admin não pode desativar a si mesmo nem alterar o próprio perfil", async () => {
    const admin = await makeActor();
    await expect(deactivateUser(db, admin, admin.id)).rejects.toThrow(/própria conta/);
    const self = await db.user.findUniqueOrThrow({ where: { id: admin.id } });
    await expect(
      updateUser(db, admin, admin.id, {
        ...validInput,
        email: self.email,
        username: self.username,
        roleKey: "COLABORADOR",
      }),
    ).rejects.toThrow(/próprio perfil/);
  });

  it("sempre resta pelo menos um administrador ativo", async () => {
    const onlyAdmin = await makeUser({ role: "ADMIN" });
    // Simula um futuro "gestor de pessoas": gerencia usuários sem ser administrador.
    const manager = { ...(await makeActor("COLABORADOR")), permissions: ["usuarios.gerenciar" as const] };
    await expect(deactivateUser(db, manager, onlyAdmin.id)).rejects.toThrow(
      /pelo menos um administrador ativo/,
    );
    await expect(
      updateUser(db, manager, onlyAdmin.id, {
        ...validInput,
        email: onlyAdmin.email,
        username: onlyAdmin.username,
        roleKey: "COLABORADOR",
      }),
    ).rejects.toThrow(/pelo menos um administrador ativo/);
  });

  it("reativação preserva dados; quem não tinha senha volta a convite pendente", async () => {
    const admin = await makeActor();
    const withPassword = await makeUser();
    const withoutPassword = await makeUser({ status: "INVITED" });
    await deactivateUser(db, admin, withPassword.id);
    await deactivateUser(db, admin, withoutPassword.id);
    expect((await reactivateUser(db, admin, withPassword.id)).status).toBe("ACTIVE");
    expect((await reactivateUser(db, admin, withoutPassword.id)).status).toBe("INVITED");
    const restored = await db.user.findUniqueOrThrow({ where: { id: withPassword.id } });
    expect(restored.passwordHash).toBe(withPassword.passwordHash);
  });

  it("desativar invalida links de convite pendentes", async () => {
    const admin = await makeActor();
    const { user, invite } = await createUser(db, admin, validInput);
    await deactivateUser(db, admin, user.id);
    const usable = await db.authToken.count({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    });
    expect(usable).toBe(0);
    expect(invite.url).toBeTruthy();
  });

  it("links só são gerados para o estado adequado", async () => {
    const admin = await makeActor();
    const active = await makeUser();
    const invited = await makeUser({ status: "INVITED" });
    await expect(generateInviteLink(db, admin, active.id)).rejects.toThrow(/convite pendente/);
    await expect(generatePasswordResetLink(db, admin, invited.id)).rejects.toThrow(/ativos/);
    expect((await generatePasswordResetLink(db, admin, active.id)).url).toContain(
      "/redefinir-senha/",
    );
  });
});

describe("integridade do banco", () => {
  it("chaves estrangeiras estão ativas no SQLite", async () => {
    await expect(
      db.groupMember.create({ data: { groupId: "inexistente", userId: "inexistente" } }),
    ).rejects.toThrow();
  });
});
