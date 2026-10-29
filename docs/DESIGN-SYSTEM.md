# Design system

Base: **RC+** (Public Sans, violeta como cor única de marca, cards brancos com sombra leve sobre fundo cinza-lavanda, raio de 6 px, grade de 24 px, ícones Tabler), com **cores de marca e status mais fortes** (decisão D3).

Todos os tokens ficam em [`src/app/globals.css`](../src/app/globals.css). Para aplicar a identidade da empresa, altere apenas esse bloco e [`src/lib/brand.ts`](../src/lib/brand.ts) (nome e sigla).

## Cores

| Token | Claro | Uso |
| --- | --- | --- |
| `primary` | `#5E50EE` | Ação principal, item ativo do menu, barras de progresso. Texto branco (≈5,4:1). |
| `primary-text` | `#4B3FD0` / escuro `#B3ABFA` | Links e texto sobre `primary-subtle` |
| `success` / `warning` / `danger` / `info` | `#16A34A` / `#EA8A1A` / `#E5383B` / `#0891B2` | Barras, ícones, fundos sólidos |
| `*-subtle` + `*-text` | — | Selos e alertas: fundo suave + texto com contraste ≥ 4,5:1 nos dois temas |
| `page` / `surface` | `#F6F5FA` / `#FFFFFF` | Fundo da página / cards, menu, barra superior |
| `ink` / `ink-soft` / `ink-muted` | `#2F2B3D` / `#5D5A68` / `#8A8795` | Títulos e números / texto corrente / apoio (só informação secundária) |

Classes Tailwind correspondentes: `bg-primary`, `text-primary-text`, `bg-success-subtle text-success-text`, `bg-page`, `bg-surface`, `text-ink`, `border-line`, etc.

Tema escuro: automático pela preferência do sistema ou escolhido pelo usuário (botão na barra superior, salvo em cookie).

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
- Foco visível: anel de 2 px `primary` em todos os controles.
- Estados vazios explicam o que acontece e qual o próximo passo.
- Ações destrutivas sempre pedem confirmação e dizem o efeito.
- Sem emoji, gradientes ou animações desnecessárias; `prefers-reduced-motion` respeitado.
