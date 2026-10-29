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
| `RolePermission` | Permissões de cada perfil | Escopo por categoria (gestor de uma área) fica para quando houver esse perfil; o catálogo já separa `conteudos.gerenciar` e `categorias.gerenciar`. |
| `User` | Pessoa com acesso | `email` e `username` únicos (minúsculas). `status`: `INVITED` (sem senha), `ACTIVE`, `INACTIVE`. Nunca é apagado pela interface. |
| `Group` / `GroupMember` | Agrupamento para atribuições em massa | Nome único. Grupo só é excluído se estiver vazio. |
| `Session` | Sessão autenticada | `id` = SHA-256 do token do cookie. Expira por inatividade (8 h) e por limite absoluto (30 dias). |
| `AuthToken` | Convite e redefinição de senha | Só o hash é gravado. Uso único (`usedAt`), expira (convite 72 h, redefinição 24 h). Gerar novo invalida os anteriores do mesmo tipo. |
| `LoginAttempt` | Limite de tentativas | 5 falhas por identificador ou 20 por IP em 15 min bloqueiam novas tentativas. |
| `AuditLog` | Registro de operações administrativas | Somente inserção; `details` em JSON sem senhas, hashes ou tokens. |

## Fase 2 — conteúdo

```
Category 1─N Category (subcategorias, 2 níveis) · Category 1─N Content
Content 1─N ContentVersion · Content 1─1 ContentVersion (versão vigente)
ContentVersion N─1 StoredFile (arquivo principal)
ContentVersion N─M StoredFile (imagens no texto, via ContentVersionAsset)
```

| Entidade | Finalidade | Regras |
| --- | --- | --- |
| `Category` | Categoria ou subcategoria | Máximo de dois níveis. Nome único por nível. Arquivar não afeta conteúdos (só some dos seletores); a principal só é arquivada sem subcategorias ativas. |
| `Content` | Conteúdo reutilizável (trilhas e biblioteca) | `type`: VIDEO, PDF, IMAGE, ARTICLE, FAQ, LINK. `status`: DRAFT (nunca publicado), PUBLISHED, ARCHIVED. `inLibrary` controla a visibilidade na Central. `title` espelha a versão vigente. |
| `ContentVersion` | Versão do conteúdo | `number` sequencial por conteúdo. DRAFT → PUBLISHED → SUPERSEDED. Versões publicadas não são alteradas. `requiresRecompletion` marca mudança relevante (usada na Fase 3). |
| `StoredFile` | Metadados do arquivo | `storageKey` interno e único, nome original limpo, tipo detectado pelo conteúdo, tamanho, SHA-256. Bytes no armazenamento, nunca no banco. Não pode ser apagado enquanto uma versão o referenciar. |
| `ContentVersionAsset` | Imagens incorporadas em artigos | Libera o acesso às imagens de artigos publicados. |

### Versionamento

- Editar um conteúdo publicado cria (ou atualiza) **um** rascunho; a versão vigente continua no ar.
- Publicar: o rascunho vira vigente e a anterior passa a SUPERSEDED, com texto e arquivo preservados.
- Mudança relevante (`requiresRecompletion`): as conclusões anteriores **não** são apagadas; a Fase 3 usará a marca para pedir nova conclusão nas trilhas em andamento.
- Excluir só é permitido para conteúdo que nunca foi publicado. Publicados são arquivados.

## Fase 3 — trilhas e progresso

```
Track 1─N TrackModule 1─N TrackItem N─1 Content
Track 1─N TrackAssignment (pessoa OU grupo) · Track 1─N Enrollment (pessoa)
User 1─N ContentProgress (por versão de conteúdo) · User 1─N CompletionRecord (histórico)
```

| Entidade | Finalidade | Regras |
| --- | --- | --- |
| `Track` | Trilha | DRAFT/PUBLISHED/ARCHIVED; `sequential`, `isOnboarding`, `videoThresholdPct` (padrão 90), `minReadSeconds` (padrão 30). |
| `TrackModule` / `TrackItem` | Etapas e conteúdos | Ordem por `position`. Item aponta para o conteúdo (sem cópia), com `required` e `completionRule` (WATCH, CONFIRM, VIEW). Um conteúdo aparece uma vez por trilha. Conteúdo em uso não pode ser apagado (Restrict). |
| `TrackAssignment` | Atribuição | Única por (trilha, pessoa) e (trilha, grupo). |
| `Enrollment` | Matrícula materializada | Única por (trilha, pessoa). Criada ao publicar/atribuir/entrar no grupo. Nunca apagada: `removedAt` marca quem perdeu a atribuição antes de concluir. Guarda status, início, conclusão e `lastItemId` (onde parou). |
| `ContentProgress` | Progresso por versão | Abertura, posição do vídeo, intervalos assistidos validados, última atividade. Independe da trilha: concluir um conteúdo vale em todas as trilhas que o usam. |
| `CompletionRecord` | Histórico de aprendizagem | **Somente inserção**, único por (pessoa, versão): evita conclusão (e pontuação) duplicada. Método e evidência registrados. |

### Regras de progresso

- Sequencial: item disponível quando todos os obrigatórios anteriores estão concluídos, ou se já foi iniciado (reordenar nunca rebloqueia).
- Conteúdo arquivado deixa de contar e some para quem não o concluiu.
- Mudança relevante numa versão posterior reabre o item em trilhas **em andamento**; trilha já concluída não é reaberta.
- Trilha concluída e conteúdos continuam visíveis para revisão mesmo após arquivamento da trilha ou remoção da atribuição.

## Fase 4 — gamificação

| Entidade | Finalidade | Regras |
| --- | --- | --- |
| `Level` | Níveis | `minPoints` único; `number` recalculado pela ordem de pontos; o primeiro nível começa em 0 e não pode ser excluído. Nível não é gravado por pessoa: é calculado pelo total de pontos, então mudar níveis vale para todos na hora. |
| `PointRule` | Valor por evento | Um por evento (`CONTENT_VIDEO`, `CONTENT_READING`, `CONTENT_OTHER`, `MODULE_COMPLETED`, `TRACK_COMPLETED`); pode ser desativado. |
| `PointTransaction` | Livro-razão | **Somente inserção.** Único por (pessoa, evento, tipo de origem, origem): o mesmo conteúdo/etapa/trilha/conquista pontua uma vez. Ajuste manual é um novo lançamento (positivo ou negativo) com motivo e autor. Total = soma dos lançamentos. |
| `Achievement` / `UserAchievement` | Conquistas | Critério em JSON validado; atribuição automática e única por pessoa. |
| `Notification` | Avisos | Novo nível, nova conquista, nova trilha atribuída; lidas ao abrir o sino. |

Pontos de conteúdo são por **conteúdo** (não por versão): reconcluir após mudança relevante não pontua de novo. Mudar o valor de uma regra não recalcula pontos já concedidos.

## Fase 5 — Central de Conhecimento

| Entidade | Finalidade | Regras |
| --- | --- | --- |
| `Favorite` | Favoritos | Único por (pessoa, conteúdo). |
| `ContentView` | Acessos à página do conteúdo | Um acesso da mesma pessoa ao mesmo conteúdo em 30 min conta uma vez; também incrementa `Content.viewCount`. Base de "mais acessados" (90 dias) e "vistos recentemente". |

O **índice de busca** não fica neste banco: é um arquivo SQLite FTS5 próprio (`data/search.db`), dado derivado e reconstruível. Assim as migrações do Prisma não lidam com tabelas virtuais, e na migração para PostgreSQL basta trocar a implementação de `SearchIndex` (tsvector em português + unaccent).

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
