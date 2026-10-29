import { describe, expect, it } from "vitest";
import { checkPasswordPolicy, hashPassword, verifyPassword } from "@/server/auth/password";
import { generateToken, hashToken } from "@/server/auth/tokens";

describe("política de senha", () => {
  it("aceita senha longa e não comum", () => {
    expect(checkPasswordPolicy("cavalo-bateria-grampo")).toBeNull();
  });

  it("rejeita senha curta", () => {
    expect(checkPasswordPolicy("curta123")).toMatch(/pelo menos 10/);
  });

  it("rejeita senha comum e repetição de um caractere", () => {
    expect(checkPasswordPolicy("1234567890")).toMatch(/comum/);
    expect(checkPasswordPolicy("aaaaaaaaaaaa")).toMatch(/comum/);
  });

  it("rejeita senha que contém o login ou o e-mail", () => {
    expect(
      checkPasswordPolicy("maria.silva-2026!", { username: "maria.silva", email: "m@x.com" }),
    ).toMatch(/login ou e-mail/);
    expect(checkPasswordPolicy("xx-joaosouza-xx", { email: "joaosouza@empresa.com" })).toMatch(
      /login ou e-mail/,
    );
  });
});

describe("hash de senha", () => {
  it("nunca guarda a senha em texto e verifica corretamente", async () => {
    const hash = await hashPassword("cavalo-bateria-grampo");
    expect(hash).not.toContain("cavalo");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(hash, "cavalo-bateria-grampo")).toBe(true);
    expect(await verifyPassword(hash, "outra-senha-qualquer")).toBe(false);
  });

  it("trata hash corrompido como senha inválida", async () => {
    expect(await verifyPassword("lixo", "qualquer")).toBe(false);
  });
});

describe("tokens", () => {
  it("gera tokens únicos e hash determinístico", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(hashToken(a)).toBe(hashToken(a));
    expect(hashToken(a)).not.toBe(a);
  });
});
