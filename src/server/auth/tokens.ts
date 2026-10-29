import { createHash, randomBytes } from "node:crypto";

/** Token aleatório de 256 bits, seguro para URL e cookie. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Apenas o hash é gravado no banco: um vazamento do banco não expõe tokens válidos. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
