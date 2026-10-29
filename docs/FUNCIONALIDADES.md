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
- [x] Testes automatizados; CI no GitHub Actions

## Implementadas — Fase 2 (Gestão de conteúdo)

- [x] Upload de vídeos (MP4/WebM), PDFs e imagens com barra de progresso, validação de tipo real e de tamanho
- [x] Armazenamento em disco com nomes seguros, sem sobrescrita, preparado para S3
- [x] Entrega autenticada de arquivos, com Range para vídeo e controle de acesso por publicação
- [x] Categorias e subcategorias: criar, editar, reordenar, arquivar e restaurar
- [x] Conteúdos: vídeo, PDF, imagem, artigo/manual, pergunta frequente e link externo
- [x] Editor rico: títulos, listas, negrito, itálico, sublinhado, links, imagens com descrição e legenda, tabelas, destaques; modo Visualizar
- [x] Rascunho, pré-visualização, publicação, arquivamento, restauração e exclusão de nunca publicados
- [x] Versionamento com histórico, substituição segura de arquivo e marcação de mudança relevante
- [x] Um mesmo conteúdo serve à biblioteca e às trilhas (opção "Exibir na Central de Conhecimento")
- [x] Auditoria das operações de conteúdo e categoria; indicadores na visão geral

## Pendentes (próximas fases)

- [ ] **Fase 3 — Trilhas:** trilhas, módulos, ordenação por arrastar e soltar, atribuição a usuários/grupos, desbloqueio sequencial, progresso e retomada, conclusão validada no servidor
- [ ] **Fase 4 — Gamificação:** pontos, níveis, conquistas, notificações
- [ ] **Fase 5 — Central de Conhecimento:** busca, filtros, favoritos, mais acessados
- [ ] **Fase 6 — Relatórios:** indicadores, progresso individual, exportação CSV
- [ ] Escopo de permissão por categoria (gestor de conteúdo de uma área)
- [ ] Limpeza de arquivos enviados e não usados em nenhum conteúdo
- [ ] Envio de e-mail (SMTP) — fora do MVP
- [ ] Migração para PostgreSQL — após a validação
