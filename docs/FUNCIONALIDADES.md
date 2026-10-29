# Funcionalidades

## Implementadas — Fase 1 (Fundação)

- [x] Projeto Next.js 16 + TypeScript + Prisma 7 + SQLite, com migrações versionadas
- [x] Login por e-mail ou login, sessões no banco, sair
- [x] Senhas Argon2id e política de senha
- [x] Limite de tentativas de login
- [x] Convite de uso único para ativação de conta (sem senha padrão)
- [x] Redefinição de senha por link gerado pelo administrador
- [x] Troca da própria senha (Minha conta)
- [x] Perfis Administrador e Colaborador com permissões granulares, validadas no servidor
- [x] Usuários: cadastrar, editar, filtrar, paginar, desativar, reativar, gerar links
- [x] Campos: nome, e-mail, login, área, cargo, perfil, data de entrada, status, data de criação
- [x] Grupos: criar, editar, excluir (vazio), adicionar e remover membros, definir grupos do usuário
- [x] Auditoria das operações administrativas, com filtro e paginação
- [x] Visão geral administrativa (contas ativas, convites pendentes, inativas, grupos)
- [x] Painel do colaborador (saudação, estado vazio de trilhas)
- [x] Layout com menu lateral, barra superior, menu em gaveta no celular, tema claro/escuro
- [x] Design system com tokens RC+ (cores fortes) e componentes reutilizáveis
- [x] Script do primeiro administrador e script de backup
- [x] 35 testes automatizados; CI no GitHub Actions

## Pendentes (próximas fases)

- [ ] **Fase 2 — Conteúdo:** upload de vídeos/PDFs/imagens, armazenamento, categorias, artigos com editor rico, FAQ, publicação, arquivamento e versionamento
- [ ] **Fase 3 — Trilhas:** trilhas, módulos, ordenação por arrastar e soltar, atribuição a usuários/grupos, desbloqueio sequencial, progresso e retomada, conclusão validada no servidor
- [ ] **Fase 4 — Gamificação:** pontos, níveis, conquistas, notificações
- [ ] **Fase 5 — Central de Conhecimento:** busca, filtros, favoritos, mais acessados
- [ ] **Fase 6 — Relatórios:** indicadores, progresso individual, exportação CSV
- [ ] Envio de e-mail (SMTP) — fora do MVP
- [ ] Migração para PostgreSQL — após a validação
