# Testes

```bash
npm test          # executa todos
npm run test:watch
```

- **Vitest**, ambiente Node.
- Testes de integração usam um banco SQLite **separado** (`data/test.db`), recriado a partir das migrações a cada execução e limpo antes de cada teste. O banco de desenvolvimento nunca é tocado.
- Os serviços são testados diretamente (sem navegador), o que cobre também chamadas diretas às Server Actions.
- A CI (GitHub Actions) roda lint, tipos, testes e build a cada push.

## Cobertura atual (Fase 1) — 35 testes

| Arquivo | Fluxos críticos cobertos |
| --- | --- |
| `tests/unit/password.test.ts` | Política de senha, Argon2id, tokens |
| `tests/integration/auth.test.ts` | Login por e-mail/login; mensagem única para erro; bloqueio de inativo e convite pendente; limite de tentativas; expiração de sessão; **desativação revoga sessões**; convite de uso único, expirado, reemitido; redefinição encerra sessões; troca da própria senha |
| `tests/integration/users.test.ts` | **Colaborador não executa nenhuma operação administrativa** (10 operações); não se autopromove; cadastro com convite e auditoria; duplicidade; validação; mudança de perfil com efeito imediato; proteção do último admin; reativação; links por estado; chaves estrangeiras ativas |
| `tests/integration/groups.test.ts` | Criação, nome duplicado, membros, exclusão só de grupo vazio, permissão |

## Validação manual feita na Fase 1

Convite do primeiro admin → definição de senha → painel; cadastro com erros de validação (campos preservados) e e-mail duplicado; link de convite exibido; ativação da colaboradora; colaboradora bloqueada na área administrativa; sair; login com senha errada e redirecionamento para a página pedida; desativação; grupos; auditoria; tema escuro; menu em gaveta no celular.

## Próximas fases

Bloqueio/desbloqueio de etapas, persistência de progresso, pontuação duplicada, upload e acesso a arquivos e acesso pós-conclusão entram com suas fases. Testes E2E (Playwright) entram na Fase 3, quando houver o fluxo completo do colaborador.
