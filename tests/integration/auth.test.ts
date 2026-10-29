import { describe, expect, it } from "vitest";
import { db, makeActor, makeUser, TEST_PASSWORD, setupTestDb } from "../support/db";
import {
  acceptInvite,
  changeOwnPassword,
  findUsableToken,
  issueAuthToken,
  login,
  resetPassword,
} from "@/server/services/auth";
import { createSession, validateSessionToken } from "@/server/auth/sessions";
import { hashToken } from "@/server/auth/tokens";
import { MAX_FAILURES_PER_IDENTIFIER } from "@/server/auth/rate-limit";
import { deactivateUser } from "@/server/services/users";

setupTestDb();

function tokenFromUrl(url: string) {
  return url.split("/").pop()!;
}

describe("login", () => {
  it("entra com e-mail ou com login e cria sessão válida", async () => {
    const user = await makeUser();
    const byEmail = await login(db, { identifier: user.email, password: TEST_PASSWORD });
    const byUsername = await login(db, {
      identifier: user.username.toUpperCase(),
      password: TEST_PASSWORD,
    });
    expect(byEmail.ok && byUsername.ok).toBe(true);
    if (!byEmail.ok) return;
    const session = await validateSessionToken(db, byEmail.token);
    expect(session?.user.id).toBe(user.id);
    // O banco guarda apenas o hash do token.
    expect(await db.session.findUnique({ where: { id: byEmail.token } })).toBeNull();
  });

  it("recusa senha errada e usuário inexistente com a mesma mensagem", async () => {
    const user = await makeUser();
    const wrong = await login(db, { identifier: user.email, password: "senha-errada-123" });
    const missing = await login(db, { identifier: "ninguem@x.test", password: "qualquer-1234" });
    expect(wrong).toEqual({ ok: false, error: "E-mail/login ou senha incorretos." });
    expect(missing).toEqual(wrong);
  });

  it("bloqueia usuário desativado e convite pendente", async () => {
    const inactive = await makeUser({ status: "INACTIVE" });
    const invited = await makeUser({ status: "INVITED" });
    const r1 = await login(db, { identifier: inactive.email, password: TEST_PASSWORD });
    const r2 = await login(db, { identifier: invited.email, password: TEST_PASSWORD });
    expect(r1.ok).toBe(false);
    expect(!r1.ok && r1.error).toMatch(/desativada/);
    expect(r2.ok).toBe(false);
  });

  it("limita tentativas por identificador, inclusive com a senha correta", async () => {
    const user = await makeUser();
    for (let i = 0; i < MAX_FAILURES_PER_IDENTIFIER; i++) {
      await login(db, { identifier: user.email, password: "senha-errada-123" });
    }
    const blocked = await login(db, { identifier: user.email, password: TEST_PASSWORD });
    expect(!blocked.ok && blocked.error).toMatch(/Muitas tentativas/);
  });
});

describe("sessões", () => {
  it("sessão expirada por inatividade é recusada e removida", async () => {
    const user = await makeUser();
    const { token } = await createSession(db, user.id);
    await db.session.update({
      where: { id: hashToken(token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await validateSessionToken(db, token)).toBeNull();
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("desativar o usuário revoga todas as sessões imediatamente", async () => {
    const admin = await makeActor("ADMIN");
    const user = await makeUser();
    const s1 = await createSession(db, user.id);
    const s2 = await createSession(db, user.id);
    await deactivateUser(db, admin, user.id);
    expect(await validateSessionToken(db, s1.token)).toBeNull();
    expect(await validateSessionToken(db, s2.token)).toBeNull();
  });

  it("sessão de usuário desativado diretamente no banco também é recusada", async () => {
    const user = await makeUser();
    const { token } = await createSession(db, user.id);
    await db.user.update({ where: { id: user.id }, data: { status: "INACTIVE" } });
    expect(await validateSessionToken(db, token)).toBeNull();
  });
});

describe("convite", () => {
  it("define a senha, ativa a conta e não pode ser reutilizado", async () => {
    const user = await makeUser({ status: "INVITED" });
    const { url } = await issueAuthToken(db, {
      userId: user.id,
      type: "INVITE",
      createdById: null,
    });
    const token = tokenFromUrl(url);
    expect(url).toContain("/convite/");

    const session = await acceptInvite(db, { token, password: "nova-senha-segura-1" });
    expect((await validateSessionToken(db, session.token))?.user.id).toBe(user.id);
    expect((await db.user.findUnique({ where: { id: user.id } }))?.status).toBe("ACTIVE");

    await expect(acceptInvite(db, { token, password: "outra-senha-segura" })).rejects.toThrow(
      /inválido, já foi usado ou expirou/,
    );
  });

  it("recusa convite expirado e senha fora da política", async () => {
    const user = await makeUser({ status: "INVITED" });
    const { url } = await issueAuthToken(db, { userId: user.id, type: "INVITE", createdById: null });
    const token = tokenFromUrl(url);

    await expect(acceptInvite(db, { token, password: "curta" })).rejects.toThrow(/pelo menos/);

    await db.authToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1) } });
    expect(await findUsableToken(db, token, "INVITE")).toBeNull();
  });

  it("gerar novo convite invalida o anterior", async () => {
    const user = await makeUser({ status: "INVITED" });
    const first = await issueAuthToken(db, { userId: user.id, type: "INVITE", createdById: null });
    const second = await issueAuthToken(db, { userId: user.id, type: "INVITE", createdById: null });
    expect(await findUsableToken(db, tokenFromUrl(first.url), "INVITE")).toBeNull();
    expect(await findUsableToken(db, tokenFromUrl(second.url), "INVITE")).not.toBeNull();
  });

  it("link de convite não serve como redefinição de senha", async () => {
    const user = await makeUser({ status: "INVITED" });
    const { url } = await issueAuthToken(db, { userId: user.id, type: "INVITE", createdById: null });
    await expect(
      resetPassword(db, { token: tokenFromUrl(url), password: "nova-senha-segura-1" }),
    ).rejects.toThrow(/inválido/);
  });
});

describe("redefinição e troca de senha", () => {
  it("redefinir senha troca o hash e encerra todas as sessões", async () => {
    const user = await makeUser();
    const old = await createSession(db, user.id);
    const { url } = await issueAuthToken(db, {
      userId: user.id,
      type: "PASSWORD_RESET",
      createdById: null,
    });
    await resetPassword(db, { token: tokenFromUrl(url), password: "senha-redefinida-2026" });
    expect(await validateSessionToken(db, old.token)).toBeNull();
    const r = await login(db, { identifier: user.email, password: "senha-redefinida-2026" });
    expect(r.ok).toBe(true);
  });

  it("trocar a própria senha exige a atual e mantém só a sessão corrente", async () => {
    const user = await makeUser();
    const current = await createSession(db, user.id);
    const other = await createSession(db, user.id);
    const session = (await validateSessionToken(db, current.token))!;

    await expect(
      changeOwnPassword(db, session.user, session.sessionId, {
        currentPassword: "errada-errada-1",
        password: "nova-senha-segura-9",
      }),
    ).rejects.toThrow(/Senha atual incorreta/);

    await changeOwnPassword(db, session.user, session.sessionId, {
      currentPassword: TEST_PASSWORD,
      password: "nova-senha-segura-9",
    });
    expect(await validateSessionToken(db, current.token)).not.toBeNull();
    expect(await validateSessionToken(db, other.token)).toBeNull();
  });
});
