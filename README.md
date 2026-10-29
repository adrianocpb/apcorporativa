# Aprendizagem Corporativa

Plataforma interna de gestão do conhecimento e aprendizagem: onboarding de novos colaboradores, trilhas de treinamento, Central de Conhecimento e gamificação.

> **Status:** Fases 1 a 5 concluídas — acesso e usuários, gestão de conteúdo, trilhas com progresso validado no servidor, gamificação e Central de Conhecimento (busca, filtros, favoritos, mais acessados). Falta a Fase 6 (relatórios). Veja [docs/FUNCIONALIDADES.md](docs/FUNCIONALIDADES.md).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Prisma 7 · SQLite (validação) → PostgreSQL (produção) · Tailwind CSS 4 · Radix UI · Tabler Icons · Tiptap (editor) · Argon2id · Vitest

Detalhes e justificativas: [docs/PLANO-TECNICO.md](docs/PLANO-TECNICO.md) e [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Requisitos

- Node.js 22.12 ou superior (desenvolvido com Node 24)
- npm 10+

Não é preciso instalar banco de dados: na fase de validação o SQLite é um arquivo em `data/` e os arquivos enviados ficam em `storage/`.

## Primeira execução

```bash
npm install                 # instala dependências e gera o cliente Prisma
cp .env.example .env        # no Windows (PowerShell): Copy-Item .env.example .env
npm run db:setup            # cria o banco (migrações) e os papéis/permissões
npm run admin:criar -- --nome "Seu Nome" --email voce@empresa.com --login seu.login
npm run dev
```

O comando `admin:criar` imprime um **link de convite** de uso único (72 h). Abra-o no navegador para definir a senha do primeiro administrador. Não existem senhas padrão.

Acesse http://localhost:3000.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build e execução de produção |
| `npm test` | Testes automatizados (Vitest, banco SQLite de teste separado) |
| `npm run lint` / `npm run typecheck` | Qualidade de código |
| `npm run db:setup` | Aplica migrações e sincroniza papéis/permissões |
| `npm run db:migrate:dev` | Cria nova migração a partir do `prisma/schema.prisma` (desenvolvimento) |
| `npm run admin:criar` | Cria administrador e gera o link de convite |
| `npm run search:reindex` | Reconstrói o índice de busca (ex.: após restaurar um backup) |
| `npm run backup` | Cópia consistente do banco em `backups/` ([docs/BACKUP.md](docs/BACKUP.md)) |

## Fluxo de contas

1. O administrador cadastra o colaborador em **Administração → Usuários → Novo usuário**.
2. O sistema gera um link de convite (72 h, uso único). O administrador o envia pelo canal interno.
3. O colaborador abre o link, define a senha e entra.
4. Esqueceu a senha? O administrador gera um link de redefinição (24 h) na página do usuário.

Não há envio de e-mail nesta versão (decisão D5); a integração SMTP pode ser adicionada sem mudar os fluxos.

## Conteúdos

Em **Administração → Conteúdos**: vídeos (MP4/WebM), PDFs, imagens, artigos/manuais escritos no editor, perguntas frequentes e links externos. Cada conteúdo é salvo como rascunho, pré-visualizado e publicado; editar algo publicado cria uma nova versão sem tirar a atual do ar, e o histórico de versões fica preservado. **Categorias** organizam a Central de Conhecimento em dois níveis.

## Trilhas

Em **Administração → Trilhas**: crie a trilha, monte as etapas arrastando os conteúdos, defina o que é obrigatório e como cada item é concluído (assistir ao vídeo, confirmar leitura ou abrir), atribua a pessoas ou grupos e publique. A aba **Pessoas e progresso** mostra onde cada um parou. O colaborador vê a próxima ação no **Painel** e segue em **Minhas trilhas**.

## Gamificação

Cada conteúdo, etapa e trilha concluídos geram pontos uma única vez; os pontos definem o nível e as conquistas são atribuídas automaticamente. Em **Administração → Gamificação** o administrador ajusta os valores, os níveis e as conquistas e consulta o histórico de pontos. O colaborador vê nível e pontos no **Painel**, detalhes em **Conquistas** e avisos no sino de notificações. Não há ranking entre colaboradores.

## Central de Conhecimento

Em **Central de Conhecimento** qualquer pessoa busca por título e texto (sem depender de acentos: "ferias" encontra "férias"), filtra por tipo e categoria, vê perguntas frequentes em lista expansível, marca favoritos e encontra os conteúdos que já concluiu nas trilhas. A busca também fica na barra superior de todas as páginas.

## Documentação

| Documento | Conteúdo |
| --- | --- |
| [docs/PLANO-TECNICO.md](docs/PLANO-TECNICO.md) | Diagnóstico, decisões e plano por fases |
| [docs/ARQUITETURA.md](docs/ARQUITETURA.md) | Camadas, pastas, fluxo de requisição, dev × produção |
| [docs/MODELO-DE-DADOS.md](docs/MODELO-DE-DADOS.md) | Entidades, relacionamentos e regras de integridade |
| [docs/SEGURANCA.md](docs/SEGURANCA.md) | Autenticação, sessões, autorização, cabeçalhos |
| [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md) | Tokens, componentes e padrões de interface |
| [docs/TESTES.md](docs/TESTES.md) | Estratégia e cobertura dos testes |
| [docs/BACKUP.md](docs/BACKUP.md) | Backup e restauração |
| [docs/FUNCIONALIDADES.md](docs/FUNCIONALIDADES.md) | Implementado e pendente |
