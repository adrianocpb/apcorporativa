# Testes

```bash
npm test          # executa todos
npm run test:watch
```

- **Vitest**, ambiente Node.
- Testes de integração usam um banco SQLite **separado** (`data/test.db`), recriado a partir das migrações a cada execução e limpo antes de cada teste. O banco de desenvolvimento nunca é tocado.
- Os serviços são testados diretamente (sem navegador), o que cobre também chamadas diretas às Server Actions.
- A CI (GitHub Actions) roda lint, tipos, testes e build a cada push.

## Cobertura atual — 63 testes

| Arquivo | Fluxos críticos cobertos |
| --- | --- |
| `tests/unit/password.test.ts` | Política de senha, Argon2id, tokens |
| `tests/integration/auth.test.ts` | Login por e-mail/login; mensagem única para erro; bloqueio de inativo e convite pendente; limite de tentativas; expiração de sessão; **desativação revoga sessões**; convite de uso único, expirado, reemitido; redefinição encerra sessões; troca da própria senha |
| `tests/integration/users.test.ts` | **Colaborador não executa nenhuma operação administrativa** (10 operações); não se autopromove; cadastro com convite e auditoria; duplicidade; validação; mudança de perfil com efeito imediato; proteção do último admin; reativação; links por estado; chaves estrangeiras ativas |
| `tests/integration/groups.test.ts` | Criação, nome duplicado, membros, exclusão só de grupo vazio, permissão |
| `tests/unit/rich-text.test.ts` | HTML do editor: elementos permitidos, escape de `<script>`, links `javascript:` recusados, imagens só da plataforma, tabelas |
| `tests/integration/files.test.ts` | **Upload**: nome interno aleatório, metadados e hash; tipo conferido pelo conteúdo; vazio e acima do limite sem sobras; colaborador não envia. **Acesso seguro**: colaborador só lê arquivo de conteúdo publicado (rascunho e arquivado = 404); imagem incorporada liberada, imagem solta não |
| `tests/integration/contents.test.ts` | Rascunho → publicação → nova versão sem tirar a vigente do ar; histórico preservado; mudança relevante; essenciais por tipo; validação de link e tipo de arquivo; substituição de arquivo; arquivar/restaurar; excluir só nunca publicado; filtro por categoria; permissões; auditoria |
| `tests/integration/categories.test.ts` | Árvore em dois níveis, nomes por nível, reordenação, arquivamento hierárquico, permissões |

## Validação manual feita na Fase 1

Convite do primeiro admin → definição de senha → painel; cadastro com erros de validação (campos preservados) e e-mail duplicado; link de convite exibido; ativação da colaboradora; colaboradora bloqueada na área administrativa; sair; login com senha errada e redirecionamento para a página pedida; desativação; grupos; auditoria; tema escuro; menu em gaveta no celular.

## Validação manual feita na Fase 2

Categorias e subcategoria; artigo com título, negrito, lista e tabela publicado; PDF enviado pelo fluxo real (progresso, validação), erro de título preservando o arquivo, pré-visualização com PDF incorporado; entrega com Range (206) e cabeçalhos; 401 sem sessão e 403 para outra origem; edição do artigo publicado gerando a versão 2 com “exige nova conclusão” e a versão 1 como substituída.

## Próximas fases

Bloqueio/desbloqueio de etapas, persistência de progresso, pontuação duplicada e acesso pós-conclusão entram com suas fases. Testes E2E (Playwright) entram na Fase 3, quando houver o fluxo completo do colaborador.
