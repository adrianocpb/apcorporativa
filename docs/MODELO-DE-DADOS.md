# Modelo de dados

Fonte da verdade: [`prisma/schema.prisma`](../prisma/schema.prisma). Este documento descreve as entidades já implementadas e as regras de integridade. O modelo completo planejado está na seção B.3 do [plano técnico](PLANO-TECNICO.md).

## Fase 1 — identidade, acesso e auditoria

```
Role 1─N User N─M Group (via GroupMember)
Role N─M Permission (via RolePermission)
User 1─N Session · User 1─N AuthToken · User 1─N AuditLog (como autor)
LoginAttempt (independente)
```

| Entidade | Finalidade | Regras |
| --- | --- | --- |
| `Role` | Perfil (`ADMIN`, `COLABORADOR`) | Chave única. Sincronizado do código por `seedBase`. |
| `Permission` | Permissão granular (`usuarios.gerenciar`, …) | Catálogo em `src/server/auth/permissions.ts`. |
| `RolePermission` | Permissões de cada perfil | Fase 2 acrescenta escopo opcional por categoria. |
| `User` | Pessoa com acesso | `email` e `username` únicos (minúsculas). `status`: `INVITED` (sem senha), `ACTIVE`, `INACTIVE`. Nunca é apagado pela interface. |
| `Group` / `GroupMember` | Agrupamento para atribuições em massa | Nome único. Grupo só é excluído se estiver vazio. |
| `Session` | Sessão autenticada | `id` = SHA-256 do token do cookie. Expira por inatividade (8 h) e por limite absoluto (30 dias). |
| `AuthToken` | Convite e redefinição de senha | Só o hash é gravado. Uso único (`usedAt`), expira (convite 72 h, redefinição 24 h). Gerar novo invalida os anteriores do mesmo tipo. |
| `LoginAttempt` | Limite de tentativas | 5 falhas por identificador ou 20 por IP em 15 min bloqueiam novas tentativas. |
| `AuditLog` | Registro de operações administrativas | Somente inserção; `details` em JSON sem senhas, hashes ou tokens. |

## Regras de integridade

- Chaves estrangeiras ativas no SQLite (verificado em teste).
- Excluir usuário (não exposto) apagaria em cascata sessões, tokens e participações em grupos; auditoria mantém o registro com `actorId` nulo.
- **Desativar usuário:** status `INACTIVE`, sessões apagadas, links pendentes expirados. Dados e histórico preservados.
- **Reativar:** volta a `ACTIVE`; quem nunca definiu senha volta a `INVITED`.
- Sempre existe ao menos um administrador ativo; ninguém altera o próprio perfil nem desativa a própria conta.

## Convenções

- IDs `cuid` (texto), datas em UTC.
- Datas sem hora (ex.: data de entrada) são gravadas à meia-noite UTC e exibidas em UTC.
- Tabelas e colunas em inglês; toda a interface em português.

## Migrações

```bash
# após alterar prisma/schema.prisma
npm run db:migrate:dev -- --name descricao_da_mudanca
# em outro ambiente (aplica as migrações versionadas)
npm run db:migrate
```
