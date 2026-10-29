# Testes

```bash
npm test          # executa todos
npm run test:watch
```

- **Vitest**, ambiente Node.
- Testes de integração usam um banco SQLite **separado** (`data/test.db`), recriado a partir das migrações a cada execução e limpo antes de cada teste. O banco de desenvolvimento nunca é tocado.
- Os serviços são testados diretamente (sem navegador), o que cobre também chamadas diretas às Server Actions.
- A CI (GitHub Actions) roda lint, tipos, testes e build a cada push.

## Cobertura atual — 113 testes

| Arquivo | Fluxos críticos cobertos |
| --- | --- |
| `tests/unit/password.test.ts` | Política de senha, Argon2id, tokens |
| `tests/integration/auth.test.ts` | Login por e-mail/login; mensagem única para erro; bloqueio de inativo e convite pendente; limite de tentativas; expiração de sessão; **desativação revoga sessões**; convite de uso único, expirado, reemitido; redefinição encerra sessões; troca da própria senha |
| `tests/integration/users.test.ts` | **Colaborador não executa nenhuma operação administrativa** (10 operações); não se autopromove; cadastro com convite e auditoria; duplicidade; validação; mudança de perfil com efeito imediato; proteção do último admin; reativação; links por estado; chaves estrangeiras ativas |
| `tests/integration/groups.test.ts` | Criação, nome duplicado, membros, exclusão só de grupo vazio, permissão |
| `tests/unit/rich-text.test.ts` | HTML do editor: elementos permitidos, escape de `<script>`, links `javascript:` recusados, imagens só da plataforma, tabelas |
| `tests/integration/files.test.ts` | **Upload**: nome interno aleatório, metadados e hash; tipo conferido pelo conteúdo; vazio e acima do limite sem sobras; colaborador não envia. **Acesso seguro**: colaborador só lê arquivo de conteúdo publicado (rascunho e arquivado = 404); imagem incorporada liberada, imagem solta não |
| `tests/integration/contents.test.ts` | Rascunho → publicação → nova versão sem tirar a vigente do ar; histórico preservado; mudança relevante; essenciais por tipo; validação de link e tipo de arquivo; substituição de arquivo; arquivar/restaurar; excluir só nunca publicado; filtro por categoria; permissões; auditoria |
| `tests/unit/learning-rules.test.ts` | **Bloqueio/desbloqueio sequencial**, opcional, trilha livre, reordenação sem rebloqueio, conteúdo arquivado, mudança relevante; validação de trechos de vídeo (pulo, aceleração, espera, limites) |
| `tests/integration/tracks.test.ts` | Bloqueio de etapas futuras e **desbloqueio após conclusão válida** (inclusive chamadas diretas recusadas); tempo mínimo de leitura; **conclusão sem duplicidade**; vídeo concluído só com trechos assistidos e duração lida do MP4; **persistência e retomada**; mudança relevante; **acesso após a conclusão** com trilha arquivada; atribuição por grupo e remoção preservando histórico; relatório de progresso; permissões |
| `tests/integration/gamification.test.ts` | Pontos por conteúdo, etapa e trilha com origem; **sem pontuação duplicada** ao rever, reconfirmar, reconcluir ou em conclusões simultâneas; regras configuráveis; cálculo e aviso de novo nível; reorganização de níveis; conquistas automáticas e por trilha; ajuste manual auditado; colaborador não altera pontos; notificação de trilha atribuída |
| `tests/integration/library.test.ts` | Busca sem acentos, por prefixo e por relevância; trecho destacado sem HTML; entradas maliciosas na busca; só publicado e da biblioteca, acompanhando nova versão e arquivamento; filtros por tipo e categoria; reconstrução do índice; acessos sem inflar e mais acessados; favoritos; **acesso a conteúdo após concluir** e conteúdo só de trilha restrito; rascunho/arquivado bloqueados; categorias com contagem |
| `tests/integration/categories.test.ts` | Árvore em dois níveis, nomes por nível, reordenação, arquivamento hierárquico, permissões |

## Validação manual feita na Fase 1

Convite do primeiro admin → definição de senha → painel; cadastro com erros de validação (campos preservados) e e-mail duplicado; link de convite exibido; ativação da colaboradora; colaboradora bloqueada na área administrativa; sair; login com senha errada e redirecionamento para a página pedida; desativação; grupos; auditoria; tema escuro; menu em gaveta no celular.

## Validação manual feita na Fase 2

Categorias e subcategoria; artigo com título, negrito, lista e tabela publicado; PDF enviado pelo fluxo real (progresso, validação), erro de título preservando o arquivo, pré-visualização com PDF incorporado; entrega com Range (206) e cabeçalhos; 401 sem sessão e 403 para outra origem; edição do artigo publicado gerando a versão 2 com “exige nova conclusão” e a versão 1 como substituída.

## Validação manual feita na Fase 3

Criação da trilha, inclusão de PDF e artigo, reordenação com arrastar e soltar (mouse) salva no banco, atribuição a grupo, publicação; painel com "Comece por aqui"; item seguinte bloqueado na lista e por URL direta; confirmação de leitura liberada após o tempo mínimo; 50% → próximo conteúdo → trilha concluída (100%); relatório do administrador com a conclusão. Não verificado no navegador: reprodução de vídeo real (sem arquivo de vídeo de teste) e reordenação pelo teclado — ambos cobertos apenas pelos testes automatizados e pela biblioteca (dnd-kit).

## Validação manual feita na Fase 4

Painel com nível e pontos; inclusão de um link em trilha já concluída (a trilha não foi reaberta, o item ficou disponível); abertura do link concluindo e gerando pontos; conquistas "Primeira trilha" e "Bem-vindo a bordo" atribuídas automaticamente; página de conquistas e histórico; sino com 2 avisos zerando ao abrir; tela de regras de pontuação.

## Validação manual feita na Fase 5

Busca "ferias" encontrando "Política de férias 2026"; busca por texto do artigo com trecho destacado; índice reconstruído automaticamente para conteúdos publicados antes da Fase 5; página do conteúdo com "você concluiu" e "nas suas trilhas"; favoritar; página inicial com favoritos, vistos recentemente, mais acessados, recentes e categorias com contagem.

## Próximas fases

Pontuação (Fase 4) e busca (Fase 5) trazem seus testes. O teste de ponta a ponta no navegador (Playwright) ficou pendente: o fluxo foi validado manualmente e pelos testes de integração dos serviços.
