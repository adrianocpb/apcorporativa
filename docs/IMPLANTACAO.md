# Implantação

Guia para colocar a plataforma em um servidor da empresa. Há dois cenários.

## 1. Piloto (validação) — um servidor, SQLite

Adequado para dezenas de usuários, com uma única instância da aplicação.

**Servidor:** Linux (Ubuntu 24.04 LTS, por exemplo) com 2 vCPU, 4 GB de RAM e disco suficiente para os vídeos (o espaço é dominado por eles). Node.js 22.12 ou superior.

```bash
git clone https://github.com/adrianocpb/apcorporativa.git
cd apcorporativa
npm ci
cp .env.example .env        # ajuste APP_URL para o endereço real (https://...)
npm run db:setup
npm run build
npm run admin:criar -- --nome "Nome" --email admin@empresa.com
NODE_ENV=production npm start   # porta 3000
```

**Serviço:** mantenha o processo ativo com `systemd` (ou `pm2`) e reinício automático. Exemplo de unidade:

```ini
[Service]
WorkingDirectory=/opt/apcorporativa
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=always
User=apcorporativa
```

**Proxy reverso com HTTPS (obrigatório):** Nginx ou Caddy na frente da aplicação.

- Certificado TLS (Let's Encrypt ou da empresa).
- Repassar `Host` e **sobrescrever** `X-Forwarded-For` com o IP real (o limite de tentativas de login usa esse cabeçalho).
- Permitir uploads grandes e sem buffer, para vídeos: no Nginx, `client_max_body_size 2100m;` e `proxy_request_buffering off;` em `/api/arquivos`.
- Para vídeo, manter o suporte a `Range` (padrão) e aumentar `proxy_read_timeout` se necessário.

**Backup:** agendar `npm run backup` diariamente e copiar `backups/` **e** a pasta `storage/` para outro local (ver [BACKUP.md](BACKUP.md)). O índice de busca não precisa de backup.

**Atualizações:**

```bash
git pull
npm ci
npm run db:migrate     # aplica migrações novas
npm run db:seed        # sincroniza papéis, permissões e padrões de gamificação
npm run build
sudo systemctl restart apcorporativa
```

## 2. Produção — várias instâncias, PostgreSQL e armazenamento de objetos

Quando o uso crescer ou for preciso alta disponibilidade:

| Peça | Mudança |
| --- | --- |
| Banco | PostgreSQL (gerenciado ou em servidor próprio). Trocar o provider no `prisma/schema.prisma` e o adaptador em `src/server/db.ts` (`@prisma/adapter-pg`); gerar a migração inicial; copiar os dados (seção B.11 do [plano técnico](PLANO-TECNICO.md)). Ajustar buscas com `contains` para `mode: "insensitive"`. |
| Arquivos | Implementar `StorageProvider` para S3-compatível (MinIO, Cloudflare R2, AWS S3) em `src/server/storage/`. Copiar a pasta `storage/` para o bucket mantendo as chaves. |
| Busca | Implementar `SearchIndex` com `tsvector` em português + `unaccent` (ou manter um serviço de busca dedicado). Rodar `npm run search:reindex`. |
| Instâncias | As sessões já ficam no banco; qualquer instância atende qualquer usuário. Balanceador na frente. |
| E-mail | Conectar um SMTP para enviar convites e redefinições (hoje os links são gerados pelo administrador). |

## Checklist de segurança antes de liberar

- [ ] HTTPS ativo e `APP_URL` com `https://`.
- [ ] `NODE_ENV=production` (cookies `Secure`).
- [ ] Proxy sobrescrevendo `X-Forwarded-For`.
- [ ] `.env` com permissão restrita ao usuário do serviço; nada sensível no repositório.
- [ ] Backup diário testado com uma restauração.
- [ ] Repositório Git privado (recomendado).
- [ ] Administradores com senhas fortes; contas de teste removidas ou desativadas.
