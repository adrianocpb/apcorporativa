import "dotenv/config";
import { createDbClient } from "../src/server/db";
import { seedBase } from "../src/server/seed-base";

const db = createDbClient();

seedBase(db)
  .then(() => console.log("Papéis e permissões sincronizados."))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
