# Arquitetura

Monólito modular em Next.js: um processo serve a interface e executa as regras de negócio. As regras ficam em uma camada de serviços **sem dependência do Next**, testada diretamente contra o banco.

```
Navegador
  │  páginas (Server Components) · Server Actions · proxy
  ▼
src/app/                 camada fina: autentica, chama o serviço, renderiza
  │
src/server/auth/         sessão, senha, tokens, limite de tentativas, guardas
src/server/services/     regras de negócio (usuários, grupos, auth, auditoria…)
src/server/db.ts         Prisma Client (adaptador SQLite)
  ▼
SQLite (data/app.db) → PostgreSQL em produção
```

## Pastas

| Caminho | Conteúdo |
| --- | --- |
| `prisma/schema.prisma` | Modelo de dados (fonte da verdade) |
| `prisma/migrations/` | Migrações versionadas |
| `prisma/seed.ts` | Sincroniza papéis e permissões (sem usuários) |
| `src/app/(auth)/` | Entrar, convite, redefinição, esqueci a senha |
| `src/app/(app)/` | Área autenticada: painel, minha conta |
| `src/app/(app)/admin/` | Área administrativa |
| `src/components/ui/` | Design system (botões, campos, cartões, tabelas, modal, notificações, progresso) |
| `src/components/layout/` | Menu lateral, barra superior, tema |
| `src/components/forms/` | Componentes de formulário reutilizáveis |
| `src/server/` | Código exclusivo do servidor |
| `src/lib/` | Utilitários puros (formatação pt-BR, validação Zod, rótulos) |
| `src/proxy.ts` | Redireciona para o login quando não há cookie (checagem otimista). Não atua em `/api`. |
| `src/app/api/arquivos/` | Upload em fluxo (POST) e entrega autenticada de arquivos com suporte a Range (GET) |
| `src/server/storage/` | `StorageProvider` e implementação em disco local |
| `src/components/content/` | Editor rico (Tiptap), campo de upload, visualizador por tipo |
| `src/lib/rich-text.ts` | Converte o documento do editor em HTML seguro (lista fechada de elementos) |
| `scripts/` | `criar-admin.ts`, `backup.ts` |
| `tests/` | Unitários e de integração |

## Fluxo de uma operação administrativa

1. O formulário (Client Component) envia uma **Server Action**.
2. A action chama `requireUser()` — valida o cookie contra a tabela `Session` e o status do usuário.
3. A action chama o serviço passando o usuário (`actor`).
4. O serviço chama `assertPermission(actor, …)`, valida a entrada com Zod, aplica as regras e grava **em transação**, incluindo o registro de auditoria.
5. `runAction` converte `AppError` em mensagem amigável; qualquer outro erro vira mensagem genérica e só é detalhado no log do servidor.

Como a permissão é verificada no serviço, chamar a action diretamente (sem a interface) não contorna nenhuma regra.

## Decisões técnicas

- **Cache Components desligado** (`next.config.ts`): todo conteúdo é por usuário; nenhuma sessão ou permissão é servida de cache. Uma desativação vale na requisição seguinte.
- **Sessões no banco** em vez de JWT: permitem revogação imediata (desativação, troca de senha).
- **Prisma 7 com driver adapter** (`@prisma/adapter-better-sqlite3`): trocar para PostgreSQL é trocar `provider` e adaptador (`@prisma/adapter-pg`).
- **Busca textual** (Fase 5) ficará atrás de uma interface para isolar o SQL específico de cada banco.
- Consultas com `contains` são insensíveis a maiúsculas no SQLite; no PostgreSQL será preciso `mode: "insensitive"` (anotado para a migração).

## Desenvolvimento × produção

| Aspecto | Desenvolvimento / validação | Produção |
| --- | --- | --- |
| Banco | SQLite em `data/app.db` | PostgreSQL com backup diário |
| Instâncias | 1 | 1 ou mais (sessões já estão no banco) |
| Arquivos (Fase 2) | `storage/` em disco | Armazenamento de objetos S3-compatível |
| HTTPS | Não | Obrigatório (cookies `Secure` em `NODE_ENV=production`) |
| Proxy reverso | Não | Nginx/Caddy; deve sobrescrever `X-Forwarded-For` |
| Segredos | `.env` local | Variáveis de ambiente do servidor |

O SQLite atende um piloto com dezenas de usuários em **um único servidor**. Para várias instâncias, migre para PostgreSQL (ver seção B.11 do plano).

## Arquivos (Fase 2)

- **Upload em fluxo:** o navegador envia o arquivo como corpo de `POST /api/arquivos?tipo=VIDEO|PDF|IMAGE` (sem multipart), com barra de progresso. O servidor lê os primeiros bytes para identificar o tipo real, aplica o limite de tamanho enquanto grava, calcula o SHA-256 e salva com nome interno aleatório (`pdf/2026/10/<uuid>.pdf`). Vídeos grandes nunca ficam inteiros na memória nem no banco.
- **Entrega:** `GET /api/arquivos/:id` valida sessão e permissão a cada requisição e suporta `Range` (avançar e retomar vídeo). Os arquivos nunca ficam em `public/`.
- **Imutabilidade:** um arquivo nunca é sobrescrito; substituir cria nova versão do conteúdo apontando para um novo arquivo, e o antigo segue ligado à versão anterior.
- **Produção:** implementar `StorageProvider` para S3-compatível (MinIO, R2, S3) e trocar em `getStorage()`. O restante do código não muda.
- O proxy não atua em `/api` para não bufferizar uploads grandes; as rotas de API fazem a própria autenticação (401) e a verificação de origem (403).

## Conteúdo e editor

- Artigos e FAQs são editados com **Tiptap**; o documento é salvo em JSON e o servidor gera o HTML com `renderRichText`, que só aceita elementos e atributos conhecidos (títulos, parágrafos, listas, negrito, itálico, sublinhado, links http/https/mailto, imagens da própria plataforma com legenda, tabelas, destaque e linha divisória). O mesmo código gera o texto puro para a busca (Fase 5) e a lista de imagens incorporadas (controle de acesso).
- O componente `ContentViewer` exibe cada tipo (vídeo, PDF em iframe, imagem, artigo, FAQ, link) e será reutilizado nas trilhas e na Central de Conhecimento.
