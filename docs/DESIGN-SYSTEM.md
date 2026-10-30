# Design system

Base: **RC+ apps** (artefato "RC+ apps"): a marca-mãe é monocromática — preto RC+ (`#0E0E0E`) como cor de ação sobre o papel RC+ (`#EFF0EB`), cards brancos com sombra leve, Public Sans, raio de 6 px, grade de 24 px, ícones Tabler. Ilustrações e badges vêm do artefato "Assets ilustrados - plataforma gestão de conhecimento" (decisão D3, revista em 30/10/2026: substitui o violeta `#5E50EE`).

Todos os tokens ficam em [`src/app/globals.css`](../src/app/globals.css). Nome do produto em [`src/lib/brand.ts`](../src/lib/brand.ts).

## Cores

| Token | Claro / escuro | Uso |
| --- | --- | --- |
| `primary` | `#0E0E0E` / `#EFF0EB` | Ação principal, item ativo do menu, barras de progresso. Texto `on-primary` (papel / preto). |
| `primary-subtle` / `primary-text` | — | Caixas de ícone, trilho de progresso; links (sublinhados — a cor é a do texto) |
| `success` / `warning` / `danger` / `info` | `#28C76F` / `#FF9F43` / `#FF4C51` / `#00BAD1` | Barras, ícones, fundos sólidos |
| `*-subtle` + `*-text` | — | Selos e alertas: fundo suave + texto com contraste ≥ 4,5:1 nos dois temas |
| `page` / `surface` | `#EFF0EB` / `#FFFFFF` (escuro `#0E0E0E` / `#1A1A19`) | Fundo da página / cards, menu, barra superior |
| `ink` / `ink-soft` / `ink-muted` | `#0E0E0E` / `#2E2E2C` / `#5C5C58` | Títulos e números / texto corrente / apoio (≥ 4,5:1) |
| `rchub` / `dpi` / `bkp` | `#FF4303` / `#F5195C` / `#0F96FF` | Só para identificar a empresa do grupo ou nas ilustrações — nunca como cor de estado |
| `focus` | `#0E0E0E` / `#EFF0EB` | Anel de foco sólido de 2 px, deslocado 2 px |

Classes Tailwind correspondentes: `bg-primary`, `text-primary-text`, `bg-success-subtle text-success-text`, `bg-page`, `bg-surface`, `text-ink`, `border-line`, `bg-paper`, `bg-rchub`, etc.

Tema escuro: automático pela preferência do sistema ou escolhido pelo usuário (botão na barra superior, salvo em cookie). O `primary` inverte para o papel RC+.

## Marca e ilustrações

| Arquivo / componente | Uso |
| --- | --- |
| `RcLogo` (`src/components/layout/rc-logo.tsx`) | Logo RC+ em `currentColor` (preto no claro, papel no escuro). Originais em `public/marca`. |
| `LevelIllustration` (`src/components/learning/level-badge.tsx`) | Badge ilustrado de cada nível (`public/niveis/nivel-1..5.svg`); o arco enche conforme o nível sobe. Níveis além do 5 usam o badge 5. |
| `LevelChip` | Versão compacta "Nível N · Nome" (menu do usuário). O último nível usa fundo preto com as cores das três empresas. |
| `LevelCard` / `LevelJourney` | Nível atual no painel; jornada com todos os níveis em Conquistas. |
| `public/ilustracoes/escada-niveis.svg` | Escada dos cinco níveis no painel ilustrado das telas de acesso. |

As telas de acesso (entrar, convite, redefinir senha) usam o layout dividido do artefato: formulário à esquerda e painel ilustrado no papel RC+ à direita (só em telas largas). Os títulos desse painel usam Archivo e Instrument Serif itálico; o restante do sistema usa só Public Sans.

## Tipografia

Public Sans 400/500/600. Classes: `text-h3` (KPI), `text-h4` (título de página), `text-h5` (título de card), `text-h6` (nome em lista), `text-body` (15 px), `text-small` (13 px), `text-caption` (11 px). Cabeçalhos de tabela e grupos do menu em caixa alta.

## Componentes (`src/components/ui`)

| Componente | Uso |
| --- | --- |
| `Button`, `ButtonLink` | Variantes `primary`, `tonal`, `outline`, `ghost`, `danger`, `danger-tonal`; tamanhos `md`/`sm`; estado `loading` |
| `Field` + `Input`, `Select`, `Textarea`, `Checkbox` | Rótulo, dica e erro acessíveis (`aria-invalid`, `aria-describedby`) |
| `Card`, `CardHeader`, `CardBody`, `StatCard` | Cards e indicadores (o número é o elemento mais forte) |
| `Badge`, `Alert`, `Avatar`, `ProgressBar`, `EmptyState` | Feedback e estado (`feedback.tsx`) |
| `Table`, `Th`, `Td`, `Tr` | Tabelas com rolagem horizontal em telas estreitas |
| `Modal` | Diálogo acessível (Radix) |
| `Toaster` / `toast()` | Notificações temporárias; Server Actions usam `setFlash()` para mensagens após redirecionamento |
| `CopyField` | Link somente leitura com botão Copiar |
| `PageHeader`, `Pagination` | Cabeçalho de página e paginação por links |

Componentes de formulário em `src/components/forms`: `ConfirmActionButton` (ação com confirmação), `LinkGeneratorButton` (gera e exibe link), `NewPasswordForm`, `useFormAction` (mantém valores digitados após erro).

Componentes de conteúdo em `src/components/content`: `RichTextEditor` (editor com barra de ferramentas e modo Visualizar), `FileUploadField` (envio com progresso), `ContentViewer` (exibição por tipo) e `ContentTypeIcon`. A classe `.rich-content` (em `globals.css`) define a tipografia de artigos.

## Padrões

- Uma ação `primary` por área; ações secundárias em `tonal`.
- Cor nunca sozinha: status sempre com palavra (“Ativo”, “Convite pendente”, “Inativo”).
- Foco visível: anel sólido de 2 px `focus` em todos os controles; inputs em foco trocam a borda para `primary`.
- Estados vazios explicam o que acontece e qual o próximo passo.
- Ações destrutivas sempre pedem confirmação e dizem o efeito.
- Sem emoji, gradientes ou animações desnecessárias; `prefers-reduced-motion` respeitado.
