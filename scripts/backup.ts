// Cópia consistente do banco SQLite com a aplicação em execução (API de backup online).
// Uso: npm run backup  →  backups/AAAA-MM-DD_HHMMSS/app.db
// Restauração: docs/BACKUP.md

import "dotenv/config";
import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("file:")) {
    throw new Error("DATABASE_URL deve apontar para um arquivo SQLite (file:...).");
  }
  const dbPath = path.resolve(url.slice("file:".length));
  if (!existsSync(dbPath)) throw new Error(`Banco não encontrado: ${dbPath}`);

  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "_").slice(0, 15);
  const dir = path.resolve(process.env.BACKUP_DIR ?? "backups", stamp);
  mkdirSync(dir, { recursive: true });

  const source = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    await source.backup(path.join(dir, "app.db"));
  } finally {
    source.close();
  }
  console.log(`Backup gravado em ${dir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
