import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // Módulos marcados com "server-only" são importados normalmente nos testes (Node).
      "server-only": path.resolve(import.meta.dirname, "tests/support/empty.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/support/global-setup.ts"],
    // Um único arquivo SQLite de teste: os arquivos rodam em sequência.
    fileParallelism: false,
    testTimeout: 20000,
  },
});
