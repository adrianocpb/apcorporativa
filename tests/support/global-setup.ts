import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

export const TEST_DATABASE_URL = "file:./data/test.db";

// Recria o banco de teste a partir das migrações a cada execução da suíte.
export default function setup() {
  const root = path.resolve(__dirname, "../..");
  const dataDir = path.join(root, "data");
  if (!existsSync(dataDir)) mkdirSync(dataDir);
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    rmSync(path.join(dataDir, `test.db${suffix}`), { force: true });
  }
  execSync("npx prisma migrate deploy", {
    cwd: root,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "pipe",
  });
  process.env.DATABASE_URL = TEST_DATABASE_URL;
}
