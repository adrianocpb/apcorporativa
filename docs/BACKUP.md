# Backup e restauração

## O que precisa de backup

| Item | Local | Observação |
| --- | --- | --- |
| Banco de dados | `data/app.db` (SQLite) | Usuários, sessões, auditoria e, nas próximas fases, progresso e pontos |
| Arquivos enviados | `storage/` (ou `STORAGE_DIR`) | Vídeos, PDFs e imagens. Copie a pasta inteira junto com o backup do banco: o banco guarda só as referências. |
| Configuração | `.env` | Guardar em cofre de segredos, não junto com o backup comum |

## Fazer backup (SQLite)

```bash
npm run backup
```

Gera `backups/AAAAMMDD_HHMMSS/app.db` usando a API de backup online do SQLite: a cópia é consistente mesmo com a aplicação em uso. Defina `BACKUP_DIR` no `.env` para gravar em outro disco.

Recomendado: agendar diariamente (Agendador de Tarefas do Windows ou `cron`) e copiar a pasta para outro local/servidor. Copiar `app.db` manualmente com a aplicação rodando **não** é seguro (arquivos `-wal`/`-shm`).

## Restaurar

1. Pare a aplicação.
2. Guarde o banco atual: renomeie `data/app.db` para `data/app.db.antes-da-restauracao`; apague `data/app.db-wal` e `data/app.db-shm` se existirem.
3. Copie o backup escolhido para `data/app.db`.
4. Rode `npm run db:migrate` (aplica migrações mais novas que o backup, se houver).
5. Inicie a aplicação e confira o login e a lista de usuários.

Todas as sessões ativas no momento do backup voltam a valer até expirarem; para forçar novo login de todos, apague as linhas da tabela `Session` após restaurar.

## Produção (PostgreSQL)

Após a migração: `pg_dump` diário com retenção (ex.: 7 diários + 4 semanais), armazenado fora do servidor, e versionamento no bucket de arquivos. Teste a restauração periodicamente em um ambiente separado.
