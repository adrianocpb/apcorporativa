# Segurança

## Autenticação

- Senhas com **Argon2id** (19 MiB, 2 iterações — mínimo OWASP). Nunca em texto puro.
- Política: mínimo 10 caracteres, bloqueio de senhas comuns e de senhas que contenham o login ou o e-mail.
- Login por e-mail ou login. Resposta idêntica para usuário inexistente e senha errada; verificação de hash executada mesmo quando o usuário não existe (tempo de resposta uniforme).
- **Limite de tentativas** persistente: 5 falhas por identificador ou 20 por IP em 15 minutos.
- Sem senhas padrão: contas são criadas sem senha e ativadas por **link de convite de uso único**. O primeiro administrador também (`npm run admin:criar`).

## Sessões

- Token aleatório de 256 bits no cookie `apc_session` (`HttpOnly`, `SameSite=Lax`, `Secure` em produção). O banco guarda apenas o SHA-256.
- Expiração por inatividade (8 h, renovada a cada 5 min de uso) e absoluta (30 dias).
- Cada requisição valida a sessão **e** o status do usuário: desativação, redefinição de senha e troca de perfil têm efeito imediato.
- Sair apaga a sessão no banco. Trocar a própria senha encerra as outras sessões; redefinir por link encerra todas.

## Autorização

- Permissões granulares por perfil (`src/server/auth/permissions.ts`).
- Três camadas: `proxy.ts` (sem cookie → login), layouts/páginas (`requirePermission`) e **serviços** (`assertPermission`). A última é a que garante a regra mesmo se uma Server Action for chamada diretamente.
- Testes chamam cada serviço administrativo como colaborador e esperam `ForbiddenError` sem alteração no banco.

## Entradas e erros

- Toda entrada validada com Zod no servidor.
- `runAction` devolve apenas mensagens de `AppError`; erros inesperados viram mensagem genérica e são registrados só no log.
- Redirecionamento pós-login aceita apenas caminhos internos (sem redirecionamento aberto).

## Cabeçalhos HTTP

`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` (links de convite não vazam para outros sites), `Permissions-Policy`, CSP com `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`. Server Actions do Next verificam a origem (proteção CSRF).

## Arquivos

- Upload só para quem tem `conteudos.gerenciar`, com verificação de **mesma origem** (CSRF) e sessão.
- Tipo validado pelos bytes do arquivo, não pela extensão nem pelo tipo declarado. Aceitos: MP4, WebM, PDF, PNG, JPG, WebP, GIF. SVG e HTML recusados (risco de script).
- Limites configuráveis (padrão: vídeo 2 GB, PDF 50 MB, imagem 10 MB), aplicados durante a gravação.
- Nomes internos aleatórios; o nome original é limpo e usado só para exibição/download. Gravação em arquivo temporário e renomeação, sem sobrescrever.
- Leitura: gestores de conteúdo veem tudo; demais usuários, só arquivos da versão vigente de conteúdo publicado (ou imagens incorporadas nela). Sem acesso e inexistente respondem igual (404).
- Respostas de arquivo com `nosniff`, `Content-Disposition` e `frame-ancestors 'self'` (PDF exibido apenas dentro da própria aplicação).

## Conteúdo rico

- O HTML de artigos é gerado no servidor a partir de uma lista fechada de elementos; texto sempre escapado; links só http/https/mailto/internos (externos com `noopener noreferrer`); imagens só da própria plataforma. Testado contra `<script>`, `javascript:` e injeção de atributos.

## Progresso e conclusão

- Toda regra (bloqueio, tempo mínimo, conclusão) é aplicada no servidor; abrir, concluir ou enviar progresso de item bloqueado é recusado mesmo por chamada direta.
- Vídeo: o navegador informa trechos assistidos; o servidor aceita no máximo o tempo real decorrido × 2 (+3 s), limitado a 30 s por sinal, e soma intervalos sem repetição. Pular, acelerar ou deixar a página parada não gera crédito. A duração do MP4 é lida do próprio arquivo; a informada pelo navegador só vale quando não há outra (WebM) e fica fixada no primeiro sinal.
- Leitura: a confirmação só é aceita após o tempo mínimo contado desde a primeira abertura registrada no servidor.
- Rota de progresso exige sessão e mesma origem; conclusão é idempotente (restrição única).
- Limitação conhecida: um usuário mal-intencionado pode simular sinais de vídeo em tempo real (deixando a página tocar). O controle torna a fraude tão demorada quanto assistir.

## Relatórios e exportação

- Relatórios e CSV exigem a permissão `relatorios.ver` (auditoria: `auditoria.ver`); a rota de exportação valida sessão e permissão como as telas.
- Células CSV que começam com =, +, - ou @ recebem um apóstrofo (evita execução de fórmulas no Excel).
- Os arquivos exportados contêm dados pessoais (nome, e-mail, área): trate-os conforme a política de privacidade da empresa (LGPD).

## Segredos e dados

- `.env` fora do Git; `.env.example` sem valores reais.
- Banco, backups e arquivos enviados (`data/`, `backups/`, `storage/`) fora do Git.
- Auditoria nunca grava senhas, hashes ou tokens.

## Produção — checklist

- [ ] HTTPS obrigatório; `NODE_ENV=production`.
- [ ] Proxy reverso sobrescrevendo `X-Forwarded-For` (senão o limite por IP pode ser burlado com cabeçalho forjado).
- [ ] `APP_URL` com o domínio real (usado nos links de convite).
- [ ] Backup diário automatizado e teste de restauração ([BACKUP.md](BACKUP.md)).
- [ ] Repositório privado recomendado (decisão D4).
