import { hash, verify } from "@node-rs/argon2";

// Argon2id (padrão da biblioteca) com os parâmetros mínimos recomendados pela OWASP.
const ARGON2_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 };

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

const COMMON_PASSWORDS = new Set([
  "1234567890",
  "12345678910",
  "0123456789",
  "1111111111",
  "0000000000",
  "qwertyuiop",
  "asdfghjkl1",
  "password12",
  "password123",
  "senha12345",
  "senha123456",
  "minhasenha",
  "minhasenha1",
  "mudar12345",
  "mudar@123",
  "trocar1234",
  "admin12345",
  "admin@1234",
  "brasil1234",
  "iloveyou12",
  "abc1234567",
  "abcdefghij",
  "a1b2c3d4e5",
]);

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

// Executa uma verificação mesmo quando o usuário não existe, para que o tempo de resposta
// não revele quais e-mails/logins estão cadastrados.
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword("senha-inexistente-para-equalizar-tempo");
  await verifyPassword(await dummyHash, password);
  return false;
}

/** Retorna a mensagem de erro da política de senha, ou null se a senha for aceita. */
export function checkPasswordPolicy(
  password: string,
  identity: { email?: string | null; username?: string | null } = {},
): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `A senha deve ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`;
  }
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower) || /^(.)\1+$/.test(password)) {
    return "Esta senha é muito comum. Escolha outra.";
  }
  const parts = [identity.username, identity.email?.split("@")[0]]
    .filter((p): p is string => !!p && p.length >= 4)
    .map((p) => p.toLowerCase());
  if (parts.some((p) => lower.includes(p))) {
    return "A senha não pode conter seu login ou e-mail.";
  }
  return null;
}
