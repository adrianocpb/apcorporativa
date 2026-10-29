// Reconstrói o índice de busca a partir do banco principal (ex.: após restaurar um backup).
// Uso: npm run search:reindex

import "dotenv/config";
import { createDbClient } from "../src/server/db";
import { rebuildSearchIndex } from "../src/server/services/library";

const db = createDbClient();
rebuildSearchIndex(db)
  .then((n) => console.log(`Índice de busca reconstruído: ${n} conteúdo(s) publicado(s).`))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
