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
- [x] Campos: nome, e-mail (é o acesso), área, perfil, data de entrada, grupos (já no cadastro), status, data de criação
- [x] Ordem das trilhas definida pelo administrador (Onboarding primeiro; concluídas vão para o fim da grade do colaborador)
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

## Implementadas — Fase 3 (Trilhas de aprendizagem)

- [x] Trilhas com etapas e conteúdos reutilizados da biblioteca (sem cópias)
- [x] Montagem com arrastar e soltar (etapas e conteúdos), mover entre etapas, obrigatório/opcional e regra de conclusão por item
- [x] Sequência obrigatória ou acesso livre; trilha de onboarding; percentual mínimo de vídeo (padrão 90%) e tempo mínimo de leitura configuráveis
- [x] Rascunho, publicação, arquivamento e restauração de trilhas
- [x] Atribuição a pessoas e grupos (novos membros do grupo recebem a trilha); remoção preserva o histórico
- [x] Estados por item: bloqueado, disponível, em andamento, concluído — calculados no servidor
- [x] Conclusão validada no servidor: vídeo por trechos realmente assistidos (duração do MP4 lida do arquivo), leitura com tempo mínimo, abertura para imagens/links
- [x] Retomada do vídeo e "onde parou"; painel com "Continue de onde parou" e progresso geral
- [x] Conteúdos concluídos continuam acessíveis, inclusive com a trilha arquivada
- [x] Mudança relevante de conteúdo reabre o item só em trilhas em andamento; histórico de conclusão somente inserção
- [x] Progresso por pessoa na trilha (percentual, onde parou, última atividade); auditoria das operações

## Implementadas — Fase 4 (Gamificação)

- [x] Pontos por concluir vídeo, leitura (PDF/manual/FAQ), imagem ou link, finalizar etapa e finalizar trilha — valores e ativação configuráveis
- [x] Livro-razão de pontos somente inserção, com origem, data, quantidade e evento; sem pontos repetidos ao rever ou reconcluir (restrição única no banco, testada com conclusões simultâneas)
- [x] Níveis configuráveis por pontos (padrão: Explorador, Aprendiz, Praticante, Especialista, Multiplicador de Conhecimento)
- [x] Painel com nível, pontos, pontos para o próximo nível e barra de progresso
- [x] Conquistas automáticas por critério (quantidade de conteúdos, quantidade de trilhas, onboarding concluído, trilha específica), com bônus opcional
- [x] Página de conquistas e histórico de pontos do colaborador
- [x] Notificações: novo nível, nova conquista, nova trilha atribuída
- [x] Ajuste manual de pontos com motivo (novo lançamento, auditado); colaborador não altera pontos nem níveis
- [x] Sem ranking público

## Implementadas — Fase 5 (Central de Conhecimento)

- [x] Busca por título, descrição e texto de artigos/FAQ, sem acentos e com prefixo, ordenada por relevância (título pesa mais), com trecho destacado
- [x] Busca global na barra superior e no painel
- [x] Filtros por tipo e categoria (incluindo subcategorias); navegação por categorias com contagem
- [x] Perguntas frequentes em lista expansível
- [x] Publicados recentemente, mais acessados (90 dias), vistos recentemente e favoritos
- [x] Página do conteúdo com visualização por tipo, favorito, "nas suas trilhas", relacionados e indicação de concluído
- [x] "Concluídos por mim": revisão de tudo que foi concluído nas trilhas (inclusive conteúdos só de trilha)
- [x] Conteúdo só de trilha acessível a quem tem a trilha ou já concluiu; rascunho e arquivado nunca aparecem
- [x] Índice de busca atualizado ao publicar/arquivar/excluir e reconstruível (`npm run search:reindex`)

## Implementadas — Fase 6 (Administração e relatórios)

- [x] Indicadores: usuários ativos, trilhas publicadas, atribuições, taxa de conclusão, pendências, onboarding concluído, tempo de conclusão (mediana, do primeiro acesso à conclusão), conteúdos mais acessados
- [x] Conclusão por trilha (atribuídas, não iniciadas, em andamento, concluídas, taxa, tempo) e por área
- [x] Filtros por trilha, área, pessoa e período
- [x] Progresso por pessoa (percentual e onde parou) e acompanhamento individual (trilhas, pontos, conquistas, histórico de aprendizagem)
- [x] Histórico de conclusões
- [x] Exportação CSV (progresso, trilhas, histórico, auditoria) com proteção contra fórmulas e acentuação correta no Excel
- [x] Guia de implantação (servidor, HTTPS, atualizações, caminho para produção)

## Pendentes / evoluções sugeridas

- [ ] Prazo (data limite) nas atribuições de trilha — o campo já existe no banco
- [ ] Teste automatizado de ponta a ponta no navegador (Playwright)
- [ ] Escopo de permissão por categoria (gestor de conteúdo de uma área)
- [ ] Limpeza de arquivos enviados e não usados em nenhum conteúdo
- [ ] Envio de e-mail (SMTP) — fora do MVP
- [ ] Migração para PostgreSQL — após a validação
