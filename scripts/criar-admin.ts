// Cria um administrador e imprime o link de convite para ele definir a própria senha.
// Nenhuma senha é digitada no terminal nem gravada em arquivo.
//
// Uso: npm run admin:criar -- --nome "Maria Souza" --email maria@empresa.com

import "dotenv/config";
import { parseArgs } from "node:util";
import { createDbClient } from "../src/server/db";
import { seedBase } from "../src/server/seed-base";
import { issueAuthToken } from "../src/server/services/auth";
import { audit } from "../src/server/services/audit";
import { userInputSchema } from "../src/lib/validation/users";

async function main() {
  const { values } = parseArgs({
    options: {
      nome: { type: "string" },
      email: { type: "string" },
    },
  });
  const parsed = userInputSchema.safeParse({
    name: values.nome ?? "",
    email: values.email ?? "",
    department: "",
    hireDate: "",
    roleKey: "ADMIN",
  });
  if (!parsed.success) {
    console.error("Dados inválidos:");
    for (const issue of parsed.error.issues) console.error(`  - ${String(issue.path[0])}: ${issue.message}`);
    console.error('\nUso: npm run admin:criar -- --nome "Nome Completo" --email e@empresa.com');
    process.exitCode = 1;
    return;
  }

  const db = createDbClient();
  try {
    await seedBase(db);
    const input = parsed.data;
    const exists = await db.user.findFirst({
      where: { email: input.email },
    });
    if (exists) {
      console.error("Já existe um usuário com este e-mail.");
      process.exitCode = 1;
      return;
    }
    const role = await db.role.findUniqueOrThrow({ where: { key: "ADMIN" } });
    const invite = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: input.name,
          email: input.email,
          roleId: role.id,
          status: "INVITED",
        },
      });
      await audit(tx, {
        actorId: null,
        action: "sistema.admin_inicial",
        entityType: "usuario",
        entityId: user.id,
        details: { email: user.email, origem: "linha de comando" },
      });
      return issueAuthToken(tx, { userId: user.id, type: "INVITE", createdById: null });
    });
    console.log(`\nAdministrador ${input.name} criado.`);
    console.log(`Abra o link abaixo para definir a senha (válido por 72 horas, uso único):\n`);
    console.log(`  ${invite.url}\n`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
