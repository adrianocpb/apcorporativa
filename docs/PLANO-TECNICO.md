# Plataforma Corporativa de Gestão do Conhecimento e Aprendizagem — Diagnóstico e Plano Técnico

> Status: **aprovado** em 29/10/2026. Fases 1 a 6 implementadas — ver [FUNCIONALIDADES.md](FUNCIONALIDADES.md).
> Data: 29/10/2026

---

## Etapa A — Diagnóstico

### A.1 Repositório

| Item | Situação |
| --- | --- |
| Repositório | `github.com/adrianocpb/apcorporativa` |
| Conteúdo | **Vazio** (nenhum commit, nenhuma branch) |
| Visibilidade | **Pública** — ver risco R1 |
| Acesso | `gh` autenticado como `adrianocpb`, push via HTTPS disponível |

Não há código a preservar: a stack será definida do zero.

### A.2 Ambiente de desenvolvimento (Windows 11 Home)

| Ferramenta | Versão | Observação |
| --- | --- | --- |
| Node.js | 24.21 (LTS) | Adequado |
| npm | 11.19 | Gerenciador padrão (pnpm não instalado; desnecessário) |
| Git / GitHub CLI | 2.56 / 2.103 | OK |
| Python | 3.14 (`py`) | Não necessário para a stack |
| **Docker** | **não instalado** | Não necessário na fase de validação |
| **PostgreSQL** | **não instalado** | Decisão D2: validação com **SQLite** (arquivo local, sem instalação) |
| CPU / disco | 8 núcleos / 348 GB livres | Suficiente, inclusive para vídeos locais |

### A.3 Design system de referência — RC+

Lido do artefato "RC+ apps":

- Fonte única **Public Sans** (400/500/600); escala h1–h6, `body` 15px, `body-sm` 13px, `overline` em caixa alta.
- Cor de marca única **violeta** (`primary #7367f0`), status `success / warning / danger / info` com variantes `*-subtle` (fundo) e `*-text` (texto acessível ≥ 4,5:1).
- Fundo `bg-body` cinza-lavanda, cards brancos com `shadow-sm` e sem borda, `radius-md` 6px, grade de 24px.
- Sidebar fixa de 260px + navbar flutuante de 56px; controles com 38px; ícones **Tabler** (traço 1,5px).
- Temas claro e escuro em todos os tokens de superfície e texto.

**Adaptação pedida ("cores mais fortes")** — proposta:

| Token | RC+ atual | Proposta | Motivo |
| --- | --- | --- | --- |
| `primary` | `#7367f0` (4,6:1 com branco) | `#5E50EE` (≈5,4:1) | Violeta mais denso, leitura mais firme de botões e menu ativo |
| `primary-hover` | `#685dd8` | `#4C3FD9` | Acompanha |
| `success` / `warning` / `danger` / `info` | tons pastel-vivos | tons mais saturados e escuros (ex.: `#16A34A`, `#EA8A1A`, `#E5383B`, `#0891B2`) | Barras de progresso e conquistas com mais presença |
| `*-subtle` | alfa 0,16 | alfa 0,18–0,20 | Selos mais visíveis |

Tudo o mais (tipografia, espaçamento, raios, sombras, layout) segue o RC+ sem alteração. Os tokens ficam centralizados em CSS custom properties, então trocar para a identidade da marca depois é uma edição de um arquivo.

Diferença de tom: o README do RC+ usa rótulos em inglês ("Active", "Add New User"). Aqui **toda a interface será em pt-BR** ("Ativo", "Novo colaborador"), mantendo as regras de forma (verbo + objeto, status em uma palavra, sem emoji).

### A.4 Riscos e pontos de atenção

| # | Risco | Mitigação |
| --- | --- | --- |
| R1 | Repositório **público** para um sistema interno | Nenhum segredo, dado real ou arquivo enviado será versionado (`.env`, `storage/`, backups no `.gitignore`). Ainda assim recomendo tornar o repositório **privado** (decisão D4). |
| R2 | SQLite na validação e PostgreSQL depois | Prisma isola o banco; o pouco SQL específico (busca textual) fica atrás de uma interface `SearchProvider`; nada de recursos exclusivos do SQLite fora dela. Migração documentada na seção B.11. |
| R3 | Validar conclusão de vídeo no servidor é inerentemente aproximado (o navegador controla a reprodução) | Heartbeats com validação por tempo real decorrido (seção B.6.3). Torna a fraude cara, não impossível — documentado. |
| R4 | Vídeos de terceiros (YouTube/Vimeo) não permitem medir reprodução com segurança | Tratados como "link externo" com confirmação explícita; vídeo com conclusão medida só para arquivos hospedados no sistema. |
| R5 | Armazenamento em disco local não serve para produção com várias instâncias | Interface `StorageProvider` desde o dia 1; adaptador S3-compatível (MinIO, R2, S3) na implantação. |
| R6 | Sem SMTP no MVP | Convite e redefinição de senha funcionam por **link de uso único gerado pelo administrador** (copiar e enviar pelo canal interno). O envio fica atrás de uma interface `Mailer` para plugar SMTP depois sem mudar os fluxos. |
| R7 | Windows (dev) × Linux (produção) | Caminhos via `path`, scripts npm multiplataforma, testes de integração rodando em CI Linux (GitHub Actions). |

---

## Etapa B — Planejamento

### B.1 Arquitetura proposta

Monólito modular em **Next.js** (um único processo servindo interface e API), com as regras de negócio isoladas em uma camada de serviços que **não depende do Next**. Isso mantém a execução local simples e permite, no futuro, extrair uma API separada sem reescrever as regras.

```
Navegador
   │  HTML/RSC + Server Actions + rotas /api (upload, streaming de arquivos, heartbeat de vídeo)
   ▼
Next.js (App Router)
   ├── app/            → páginas e layouts (camada fina: valida entrada, chama serviço, renderiza)
   ├── server/auth     → sessão, hash de senha, guardas de permissão (requireUser / requirePermission)
   ├── server/services → regras de negócio: trilhas, progresso, gamificação, biblioteca, relatórios
   ├── server/storage  → StorageProvider (LocalDisk agora; S3 depois)
   └── server/db       → Prisma Client
   ▼
PostgreSQL (dados, busca textual em português, auditoria)      Disco local / S3 (arquivos)
```

Princípios aplicados:

- **Toda autorização no servidor.** Cada Server Action e rota chama um guarda (`requirePermission('trilhas.editar')`). A interface só esconde botões; não é a barreira.
- **Regras de negócio puras e testáveis.** Ex.: `calcularEstadoDaTrilha(trilha, progresso)` é uma função sem I/O, coberta por testes unitários.
- **Escritas críticas em transação.** Concluir conteúdo → registrar histórico → conceder pontos → avaliar conquistas → recalcular nível acontecem numa única transação idempotente.

### B.2 Stack e justificativas

| Camada | Escolha | Por quê |
| --- | --- | --- |
| Linguagem | **TypeScript** (estrito) | Um só idioma de ponta a ponta; tipos compartilhados entre UI e servidor. |
| Framework | **Next.js 16 (App Router)** + React 19 | Amplamente usado, bem documentado; Server Actions reduzem código de API; roda em qualquer servidor Node. |
| Banco | **SQLite** (validação) → **PostgreSQL 17** (produção) | SQLite: zero instalação, um arquivo, chaves estrangeiras e transações reais, modo WAL; suficiente para validar com poucos usuários simultâneos. PostgreSQL ao aprovar a solução: concorrência de escrita, busca em português com `tsvector`. |
| ORM / migrações | **Prisma 7** (driver adapters) | Migrações versionadas (`prisma migrate`), schema legível como documentação do modelo, seed integrado. SQL bruto onde necessário (busca, relatórios). |
| Autenticação | **Sessões próprias em banco** + **Argon2id** (`@node-rs/argon2`) | Padrão consolidado (o recomendado após a descontinuação do Lucia): cookie `HttpOnly`/`Secure`/`SameSite=Lax` com token aleatório; banco guarda só o hash do token. Permite revogar sessões ao desativar usuário — algo que JWT sem estado não faz bem. |
| Validação | **Zod** | Mesmo schema valida formulário e servidor. |
| UI | **Tailwind CSS 4** + primitivos **Radix UI** | Tokens do RC+ como variáveis CSS; Radix dá acessibilidade (modais, menus, foco) sem impor visual. Componentes próprios em `components/ui`. |
| Ícones | **Tabler Icons** (`@tabler/icons-react`) | Exigido pelo RC+. |
| Editor rico | **Tiptap** (núcleo MIT + extensões de tabela, imagem, link) | Salva JSON estruturado (fácil de versionar e indexar) e renderiza HTML sanitizado. |
| Arrastar e soltar | **dnd-kit** | Acessível (teclado), mantido, leve. |
| Gráficos (relatórios) | **Recharts** | Simples para barras/linhas/percentuais. |
| Arquivos | `StorageProvider` → **disco local** (dev) / **S3-compatível** (prod) | Requisito 10; verificação de tipo real por *magic bytes* (`file-type`). |
| Visualização de PDF | Visualizador nativo do navegador via `<iframe>` servido pela rota autenticada | Sem dependência pesada; PDF.js pode entrar depois se for preciso rastrear páginas lidas. |
| E-mail | Fora do MVP | Interface `Mailer` pronta; links gerados pelo administrador. |
| Testes | **Vitest** (unidade + integração com banco de teste) e **Playwright** (E2E) | Rápidos, padrão de mercado. |
| Qualidade | ESLint, Prettier, `tsc --noEmit`, GitHub Actions | CI roda lint + tipos + testes a cada push. |

Nada pago e nenhuma infraestrutura além de Node + PostgreSQL.

### B.3 Modelo de dados inicial

Convenções: chaves `id` em `cuid2`, `createdAt`/`updatedAt` em todas as tabelas, **exclusão lógica** (status/`archivedAt`) em vez de `DELETE` para tudo que tem histórico. Nomes de tabelas/colunas em inglês no banco (convenção do Prisma e do ecossistema); tudo que o usuário vê é pt-BR.

#### Identidade e acesso

| Entidade | Campos principais | Observações |
| --- | --- | --- |
| `User` | nome completo, e-mail (único), login (único), departamento, cargo, `roleId`, `status` (ATIVO/INATIVO/CONVITE_PENDENTE), `hireDate`, `passwordHash?` | Sem `passwordHash` até o convite ser aceito. |
| `Role` | chave (`ADMIN`, `COLABORADOR`), nome | Futuro: `GESTOR_CONTEUDO`. |
| `Permission` | chave (`usuarios.gerenciar`, `trilhas.editar`, `conteudos.publicar`, `relatorios.ver`, `gamificacao.configurar`…) | |
| `RolePermission` | `roleId`, `permissionId`, `scopeCategoryId?` | O escopo opcional por categoria prepara o "gestor de conteúdo de uma área". |
| `Group` / `GroupMember` | nome, descrição / `groupId`, `userId` | Grupos para atribuição em massa (ex.: "Novos — Financeiro"). |
| `Session` | `tokenHash`, `userId`, `expiresAt`, `ip`, `userAgent` | Apagadas ao desativar o usuário. |
| `AuthToken` | `tokenHash`, `userId`, `type` (CONVITE / REDEFINICAO), `expiresAt`, `usedAt` | Uso único, expiração (convite 72h, redefinição 24h — o link é repassado pelo administrador, não por e-mail). |

#### Conteúdo (único, reutilizável)

| Entidade | Campos principais | Observações |
| --- | --- | --- |
| `Category` | nome, `slug`, `parentId?`, ordem, `status` | Árvore de categorias/subcategorias. |
| `Content` | `type` (VIDEO, PDF, IMAGEM, ARTIGO, TEXTO, LINK, FAQ), título, `categoryId`, `status` (RASCUNHO/PUBLICADO/ARQUIVADO), `inLibrary` (bool), `currentVersionId`, `authorId`, contadores de acesso | **Uma única entidade** usada por trilhas e pela biblioteca — sem cópias. |
| `ContentVersion` | `contentId`, número, descrição, `body` (JSON do Tiptap), `bodyText` (texto plano p/ busca), `fileId?`, `url?`, `durationSeconds?`, `requiresRecompletion` (bool), `publishedAt`, `publishedById` | Versões imutáveis após publicadas. FAQ usa título = pergunta, `body` = resposta. |
| `File` | `storageKey`, nome original, `mimeType`, tamanho, `sha256`, `uploadedById`, `status` (ATIVO/SUBSTITUIDO/ARQUIVADO), `replacedById?` | Metadados no banco; bytes no storage. Nunca sobrescreve: substituição cria novo `File`. |
| `Favorite` | `userId`, `contentId` | Único por par. |
| `ContentView` | `userId`, `contentId`, `viewedAt` | Base para "mais acessados" e "recentes". |

#### Trilhas

| Entidade | Campos principais | Observações |
| --- | --- | --- |
| `Track` | nome, descrição, `coverFileId?`, `categoryId`, `createdById`, `status`, `sequential` (bool), `isOnboarding` (bool), `videoThresholdPct` (padrão 90) | |
| `TrackModule` | `trackId`, título, descrição, `position`, `required` | Etapas. |
| `TrackItem` | `moduleId`, `contentId`, `position`, `required`, `completionRule` (AUTO_VIDEO / CONFIRMACAO / VISUALIZACAO), `thresholdPct?` | Tabela de junção trilha↔conteúdo; o mesmo conteúdo pode estar em várias trilhas. |
| `TrackAssignment` | `trackId`, `userId?`, `groupId?`, `assignedById`, `dueDate?`, `assignedAt` | Atribuição direta ou por grupo. |
| `Enrollment` | `trackId`, `userId`, `status` (NAO_INICIADA/EM_ANDAMENTO/CONCLUIDA), `startedAt`, `completedAt`, `lastItemId` | Materializa "o colaborador tem esta trilha"; único por (trilha, usuário). Sobrevive à remoção da atribuição (histórico preservado). |

#### Progresso e histórico

| Entidade | Campos principais | Observações |
| --- | --- | --- |
| `ContentProgress` | `userId`, `contentVersionId`, `status` (EM_ANDAMENTO/CONCLUIDO), `positionSeconds`, `watchedSeconds`, `percent`, `startedAt`, `lastActivityAt`, `completedAt` | Um por (usuário, versão). Progresso é **por conteúdo**, não por trilha: concluir um vídeo vale em todas as trilhas que o usam. |
| `CompletionRecord` | `userId`, `contentId`, `contentVersionId`, `method` (VIDEO_MEDIDO / CONFIRMACAO / VISUALIZACAO / ADMIN), `completedAt`, `evidence` (JSON) | **Somente inserção.** Histórico de aprendizagem auditável; nunca atualizado nem apagado. |
| `VideoHeartbeat` | `userId`, `contentVersionId`, `fromSec`, `toSec`, `receivedAt` | Usado para validar consumo real (podado após conclusão). |

#### Gamificação

| Entidade | Campos principais | Observações |
| --- | --- | --- |
| `Level` | número, nome, `minPoints` | Seed: Explorador (0), Aprendiz, Praticante, Especialista, Multiplicador de Conhecimento. |
| `PointRule` | `event` (CONTEUDO_VIDEO_CONCLUIDO, MANUAL_OBRIGATORIO_CONCLUIDO, ETAPA_CONCLUIDA, TRILHA_CONCLUIDA, CONQUISTA_OBTIDA), `points`, `active` | Valores configuráveis. |
| `PointTransaction` | `userId`, `ruleId`, `event`, `points`, `sourceType`, `sourceId`, `createdAt`, `reason` | **Livro-razão somente inserção** com `UNIQUE(userId, event, sourceType, sourceId)` → impossível pontuar duas vezes o mesmo fato, mesmo com requisições concorrentes. Ajustes manuais = nova linha com motivo, auditada. |
| `Achievement` | chave, nome, descrição, ícone, `criteria` (JSON tipado: `{tipo: 'CONTEUDOS_CONCLUIDOS', minimo: 5}`, `{tipo: 'TRILHA_CONCLUIDA', trackId}`, `{tipo: 'ONBOARDING_CONCLUIDO'}`, `{tipo: 'CATEGORIA_CONCLUIDA', categoryId}`), `active` | |
| `UserAchievement` | `userId`, `achievementId`, `awardedAt` | Único por par. |
| `Notification` | `userId`, `type`, título, corpo, `link`, `readAt` | Novo nível, conquista, trilha atribuída. |

#### Auditoria

| Entidade | Campos principais |
| --- | --- |
| `AuditLog` | `actorId`, `action` (ex.: `usuario.desativado`), `entityType`, `entityId`, `before`/`after` (JSON, sem dados sensíveis), `ip`, `createdAt` |

Pontos e nível **não são colunas editáveis**: total = soma do livro-razão (com cache em `UserStats` recalculado na mesma transação), nível = maior `Level.minPoints` ≤ total.

### B.4 Regras de negócio que respondem às perguntas da seção 11

| Situação | Regra proposta |
| --- | --- |
| **Conteúdo atualizado (mudança menor)** | Nova `ContentVersion` com `requiresRecompletion = false`. Quem concluiu a versão anterior continua concluído. |
| **Conteúdo atualizado (mudança relevante)** | Admin marca "exige nova conclusão" ao publicar. Conclusões antigas permanecem no histórico; o item volta a "Disponível" nas trilhas **em andamento** e aparece como "Atualizado — revisar" para quem já tinha concluído a trilha (a trilha concluída **não** é reaberta nem perde pontos; o admin pode exigir reatribuição explicitamente). Sem pontos novos pela reconclusão do mesmo conteúdo. |
| **Trilha reordenada** | Progresso é por conteúdo, então nada se perde. O estado (bloqueado/disponível) é recalculado sobre a nova ordem; itens já concluídos continuam concluídos, e o colaborador nunca é "re-bloqueado" em algo que já alcançou (regra: um item fica disponível se todos os obrigatórios anteriores estão concluídos **ou** se ele próprio já foi iniciado). |
| **Item adicionado a trilha em andamento** | Entra como pendente; se a trilha já estava concluída, permanece concluída (com aviso de novo conteúdo). |
| **Conteúdo arquivado** | Some da biblioteca e de novas trilhas; em trilhas existentes deixa de contar como obrigatório (não trava ninguém). Histórico e pontos preservados; colaborador ainda vê o registro "concluído em …" no histórico. |
| **Trilha arquivada** | Some das listas ativas; matrículas e histórico preservados e visíveis em "Histórico". |
| **Usuário desativado** | Login bloqueado, sessões revogadas na hora. Dados e histórico mantidos; aparece filtrado como "Inativo" nos relatórios; reativação restaura tudo. |
| **Exclusão física** | Não exposta na interface no MVP. |

### B.5 Estrutura de pastas

```
apcorporativa/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts                  # níveis, regras de pontos, papéis/permissões, categorias-base
├── src/
│   ├── app/
│   │   ├── (auth)/              # entrar, esqueci-senha, redefinir-senha, aceitar-convite
│   │   ├── (colaborador)/       # painel, trilhas/[id], conteudo/[id], biblioteca, conquistas, historico
│   │   ├── admin/               # usuarios, grupos, trilhas, conteudos, categorias, faq,
│   │   │                        # gamificacao, relatorios, auditoria
│   │   └── api/
│   │       ├── arquivos/[id]/   # streaming autenticado (suporta Range para vídeo)
│   │       ├── upload/
│   │       └── progresso/video/ # heartbeats
│   ├── components/
│   │   ├── ui/                  # design system: Button, Input, Select, Card, Table, Modal,
│   │   │                        # Toast, Badge, ProgressBar, Tabs, EmptyState, Avatar…
│   │   ├── layout/              # Sidebar, Navbar, PageHeader
│   │   └── features/            # TrackStepper, VideoPlayer, RichTextEditor, LevelCard…
│   ├── server/
│   │   ├── auth/                # session.ts, password.ts, guards.ts, rate-limit.ts
│   │   ├── services/            # users, tracks, progress, gamification, library, reports, audit
│   │   ├── storage/             # StorageProvider, LocalDiskStorage, (S3Storage)
│   │   ├── email/
│   │   └── db.ts
│   ├── lib/                     # validação (zod), formatação pt-BR, utilitários puros
│   └── styles/tokens.css        # tokens RC+ (claro/escuro)
├── scripts/                     # criar-admin.ts, backup.ts, restore.ts
├── storage/                     # arquivos enviados (dev) — fora do git
├── tests/
│   ├── unit/  ├── integration/  └── e2e/
├── docs/                        # arquitetura, modelo de dados, backup, testes, este plano
├── .env.example
└── README.md
```

### B.6 Fluxos e regras principais

#### B.6.1 Primeiro acesso e criação de contas

1. Após instalar, `npm run admin:criar` pede nome, e-mail e senha no terminal e cria o primeiro administrador. Nenhuma senha padrão existe no código ou no seed.
2. Admin cadastra colaborador → conta fica **"Convite pendente"** sem senha → sistema gera **link de convite de uso único (72h)**, exibido para copiar e, se SMTP estiver configurado, enviado por e-mail.
3. Colaborador abre o link, define a própria senha (mín. 10 caracteres, checagem contra lista de senhas comuns) → conta "Ativa".
4. "Esqueci minha senha": página orienta a pedir ao administrador um link de redefinição (24h, uso único); redefinir revoga todas as sessões.

#### B.6.2 Progressão sequencial

Para cada item da trilha, o servidor calcula:

- **Concluído** — existe conclusão válida da versão vigente (ou de versão anterior sem `requiresRecompletion`).
- **Em andamento** — existe progresso iniciado e não concluído.
- **Disponível** — trilha livre, **ou** todos os itens **obrigatórios** anteriores (na ordem módulo → item) estão concluídos.
- **Bloqueado** — demais casos. Abrir um item bloqueado por URL direta retorna 403 com mensagem amigável; heartbeats e confirmações para itens bloqueados são rejeitados.

Etapa concluída = todos os itens obrigatórios dela concluídos. Trilha concluída = todas as etapas obrigatórias concluídas. "Continue de onde parou" = item em andamento mais recente; senão, primeiro disponível não concluído.

#### B.6.3 Conclusão por tipo (validada no servidor)

| Tipo | Mecanismo |
| --- | --- |
| **Vídeo hospedado** | Player envia heartbeat a cada ~10s com o intervalo assistido. O servidor só aceita segundos novos até o limite do **tempo real decorrido desde o último heartbeat** (× velocidade máx. 2×), descarta saltos e acumula a cobertura em intervalos únicos. Concluído quando cobertura ≥ limite configurado (padrão 90%). A posição é salva para retomada. Rever um vídeo concluído não exige nada. |
| **PDF** | Abrir registra consulta; conclusão por botão "Confirmo que li" (habilitado após abrir o arquivo e um tempo mínimo configurável, padrão 30s, medido no servidor). |
| **Artigo / texto** | Botão "Marcar como lido" após tempo mínimo de permanência medido no servidor. |
| **Imagem / link externo** | Regra configurável por item: visualização basta, ou confirmação explícita. |
| **Vídeo externo (YouTube etc.)** | Tratado como link externo com confirmação; marcado como "conclusão declarada" nos relatórios. |

#### B.6.4 Gamificação

Ao concluir um conteúdo, numa única transação: grava `CompletionRecord` → tenta inserir `PointTransaction` (a restrição única ignora duplicatas) → verifica conclusão de etapa/trilha (mais pontos idempotentes) → avalia conquistas → recalcula nível → cria `Notification` se subiu de nível ou ganhou conquista. Sem ranking no MVP (deixa-se uma chave de configuração desligada para o futuro).

#### B.6.5 Biblioteca

Busca via `SearchProvider`: no SQLite, tabela virtual **FTS5** com tokenizador `unicode61 remove_diacritics 2` (ignora acentos: "configuracao" encontra "configuração") e ranking BM25 com peso maior no título; no PostgreSQL, `tsvector` em português + `unaccent` e índice GIN. Filtros por categoria e tipo, ordenação por relevância/recentes/mais acessados, favoritos. A biblioteca mostra conteúdos `PUBLICADO` com `inLibrary = true`; conteúdos de trilha que não estão na biblioteca continuam acessíveis ao colaborador matriculado, inclusive depois de concluir.

### B.7 Segurança

- Argon2id para senhas; tokens de sessão/convite com 256 bits aleatórios, só o hash no banco.
- Cookies `HttpOnly`, `Secure` (prod), `SameSite=Lax`; expiração deslizante (8h de inatividade, 30 dias máx.).
- Server Actions têm verificação de origem do Next; rotas `/api` próprias verificam `Origin` (proteção CSRF).
- Limite de tentativas de login por IP e por conta, com atraso progressivo.
- Guardas de permissão em **todas** as actions/rotas; testes que chamam as actions diretamente como colaborador e esperam 403.
- Zod em toda entrada; HTML do editor sanitizado (allowlist) antes de renderizar.
- Arquivos: nunca em `public/`; servidos por rota que checa sessão + permissão sobre o conteúdo; nomes internos aleatórios; tipo real por *magic bytes*; limites (vídeo MP4/WebM até 2 GB, PDF até 50 MB, imagem PNG/JPG/WebP até 10 MB — configuráveis por env); `Content-Disposition` e `X-Content-Type-Options: nosniff`; SVG não aceito (risco de script).
- Cabeçalhos de segurança (CSP, `frame-ancestors`, `Referrer-Policy`).
- Erros: mensagem genérica ao usuário, detalhe só no log do servidor.
- Segredos só em `.env` (fora do git); `.env.example` sem valores reais.
- Auditoria de: criar/editar/ativar/desativar usuário, atribuições, publicar/arquivar, substituir arquivo, alterar regras de pontos/níveis, ajustes manuais de pontos.
- **Backup:** `npm run backup` gera cópia consistente do banco (`VACUUM INTO` no SQLite; `pg_dump` no PostgreSQL) + cópia do diretório `storage/`, numa pasta datada; `npm run restore` documentado; em produção, dump diário com retenção e versionamento no bucket.

### B.8 Estratégia de testes

| Nível | Ferramenta | Cobertura principal |
| --- | --- | --- |
| Unidade | Vitest | Cálculo de estados da trilha, validação de heartbeats, regras de nível/conquista, hash e tokens |
| Integração | Vitest + banco SQLite de teste (arquivo separado, recriado por suíte) | Serviços com banco real: pontuação duplicada concorrente, desativação revoga sessão, permissões nas actions, versionamento, upload e acesso a arquivo |
| E2E | Playwright | Fluxo do MVP: admin cria colaborador → convite → cria trilha com vídeo e PDF → atribui → colaborador segue em ordem, ganha pontos/nível → admin vê conclusão → colaborador revê conteúdo concluído |

Os fluxos críticos da seção 16-D viram testes nomeados um a um. CI no GitHub Actions (SQLite agora; na migração, a mesma suíte passa a rodar também contra PostgreSQL).

### B.9 Plano de implementação por fases

| Fase | Entregas | Como validar |
| --- | --- | --- |
| **1 — Fundação** | Projeto Next+TS, Prisma + migração inicial, tokens RC+ (cores fortes) e componentes base do design system, layout (sidebar/navbar, claro/escuro, responsivo), login por e-mail ou login, sessões, convite e redefinição de senha, papéis/permissões, CRUD de usuários e grupos, ativar/desativar, auditoria básica, script do primeiro admin, CI | Testes de login/permissão/desativação; navegar como admin e colaborador |
| **2 — Gestão de conteúdo** | StorageProvider local, upload com validação, streaming com Range, categorias (árvore), conteúdos de todos os tipos, editor Tiptap com pré-visualização, rascunho/publicar/arquivar, versionamento, substituição segura de arquivo, FAQ | Testes de upload e acesso indevido a arquivo; criar manual e publicar |
| **3 — Trilhas** | CRUD de trilhas, módulos e itens com arrastar-e-soltar, obrigatoriedade, sequencial/livre, atribuição a usuários/grupos, player de vídeo com heartbeats e retomada, conclusões por tipo, estados de item, "continue de onde parou" | Testes de bloqueio/desbloqueio, persistência, manipulação de progresso |
| **4 — Gamificação** | Regras de pontos e níveis configuráveis, livro-razão, conquistas automáticas, notificações, painel do colaborador completo | Teste de pontuação duplicada (inclusive concorrente) |
| **5 — Central de Conhecimento** | Busca em português, filtros, recentes, mais acessados, favoritos, páginas de detalhe por tipo, acesso pós-conclusão | Teste de acesso a conteúdo após concluir trilha |
| **6 — Administração e relatórios** | Indicadores, progresso individual ("onde parou"), relatórios por trilha/área/período, exportação CSV, tela de auditoria, scripts de backup/restore, docs de implantação | E2E completo do MVP |

Cada fase termina com: testes passando, documentação atualizada, resumo do que funciona e como testar, commit/push no GitHub.

### B.10 Desenvolvimento × produção

| Aspecto | Desenvolvimento | Produção (recomendado) |
| --- | --- | --- |
| Banco | SQLite (`./data/app.db`) | PostgreSQL gerenciado ou em servidor dedicado, com backup diário |
| Arquivos | `./storage` em disco | Armazenamento de objetos S3-compatível (MinIO próprio, Cloudflare R2, AWS S3) |
| App | `npm run dev` | `npm run build && npm start` atrás de Nginx/Caddy com HTTPS; várias instâncias possíveis (sessões no banco, arquivos no bucket) |
| E-mail | Links gerados pelo admin | SMTP corporativo |
| Segredos | `.env` local | Variáveis de ambiente do servidor/serviço |

Um piloto com SQLite num único servidor (uma instância da aplicação, arquivos em disco com backup) é aceitável para dezenas de usuários; não para várias instâncias.

### B.11 Migração SQLite → PostgreSQL (após a validação)

Cuidados tomados desde já para que a migração seja troca de configuração, não reescrita:

- Schema Prisma sem tipos exclusivos do SQLite; datas sempre em UTC; IDs `cuid2` (texto) nos dois bancos.
- Status como enums do Prisma (suportados nos dois).
- SQL específico apenas no `SearchProvider` e em consultas de relatório isoladas em `server/services/reports`.

Passos: trocar `provider` e `DATABASE_URL` → gerar migração inicial para PostgreSQL → script `scripts/migrar-sqlite-postgres.ts` copia os dados tabela a tabela na ordem das chaves estrangeiras e confere contagens → reindexar a busca → rodar a suíte de testes contra o PostgreSQL. Arquivos em `storage/` não mudam.

---

## Decisões que precisam da sua aprovação

| # | Decisão | Proposta padrão |
| --- | --- | --- |
| **D1** | Stack | ✅ Decidido: Next.js + TypeScript + Prisma, sessões próprias com Argon2id (seção B.2). |
| **D2** | Banco | ✅ Decidido: **SQLite** na validação, PostgreSQL após aprovação (B.11). |
| **D3** | Cores | ✅ Revisto em 30/10/2026: design system RC+ apps (monocromático, preto RC+) com os assets ilustrados — ver docs/DESIGN-SYSTEM.md. Antes: violeta `#5E50EE` (seção A.3). |
| **D4** | Visibilidade do repositório | Recomendado **privado** (sistema interno); o dono do repositório continua podendo enviar commits normalmente. Se mantido público, nada sensível será versionado. |
| **D5** | E-mail | ✅ Decidido: sem SMTP no MVP; links de convite/redefinição gerados pelo admin. |

Decisões pequenas já assumidas (reversíveis): nomes de banco em inglês e interface em pt-BR; sem ranking; PDF sem rastreamento de páginas; SVG não aceito em upload; limites de tamanho configuráveis.
