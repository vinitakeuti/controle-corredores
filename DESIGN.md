---
name: Pace Lab Gestão
description: App de trabalho da Pace Lab (equipe e alunos), ferramenta sóbria e densa com a marca nos títulos, no marcador inclinado e no painel diagonal.
colors:
  accent: "#e15d37"
  accent-strong: "#c74727"
  accent-strong-hover: "#b23e21"
  accent-text: "#b03d1f"
  bg: "#edf0ec"
  surface: "#ffffff"
  surface-raised: "#f6f7f3"
  surface-sunken: "#e5e9e3"
  surface-hover: "#e9ede7"
  sidebar: "#151a1a"
  sidebar-raised: "#222a29"
  brand-panel-top: "#26332e"
  brand-panel-bottom: "#101714"
  line: "#d5dbd4"
  line-soft: "#e4e8e2"
  line-control: "#7f8a85"
  line-strong: "#17201d"
  text: "#17201d"
  text-secondary: "#394641"
  text-muted: "#5b6661"
  text-placeholder: "#6b7570"
  text-disabled: "#6f7873"
  on-dark: "#f4f6f3"
  on-dark-muted: "#c9d1cd"
  on-dark-subtle: "#8f9a94"
  on-dark-line: "#3a4443"
  accent-on-dark: "#f08a69"
  positive-on-dark: "#c8e3cf"
  danger-on-dark: "#ffd4dd"
  warning-on-dark: "#f6dfb2"
  positive: "#31523e"
  positive-soft: "#e3ebe4"
  danger: "#b3173a"
  danger-hover: "#9a1232"
  danger-soft: "#f7e4e8"
  warning: "#8a5a00"
  warning-strong: "#6b4600"
  warning-soft: "#f4ead6"
  info: "#2f4f63"
  info-soft: "#e2eaee"
typography:
  display:
    fontFamily: "Anton, Impact, Arial Narrow Bold, sans-serif"
    fontSize: "2.75rem"
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: "0.01em"
  display-mobile:
    fontFamily: "Anton, Impact, Arial Narrow Bold, sans-serif"
    fontSize: "2rem"
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: "0.01em"
  figure:
    fontFamily: "Anton, Impact, Arial Narrow Bold, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.01em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.005em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  body-sm:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.2
  label-caps:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.14em"
rounded:
  base: "2px"
  sheet: "12px"
  pill: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "24px"
  "6": "32px"
  "7": "48px"
  "8": "64px"
  control-h: "44px"
  sidebar-w: "248px"
  topbar-h: "56px"
  tabbar-h: "60px"
  content-max: "1220px"
components:
  button-primary:
    backgroundColor: "{colors.accent-strong}"
    textColor: "{colors.surface}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.base}"
    padding: "0 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.accent-strong-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.base}"
    padding: "0 16px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-raised}"
  button-quiet:
    textColor: "{colors.text}"
    rounded: "{rounded.base}"
    padding: "0 16px"
    height: "44px"
  button-quiet-hover:
    backgroundColor: "{colors.surface-hover}"
  button-danger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.danger}"
    rounded: "{rounded.base}"
    padding: "0 16px"
    height: "44px"
  button-danger-solid:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.surface}"
    rounded: "{rounded.base}"
    padding: "0 16px"
    height: "44px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.base}"
    padding: "10px 12px"
    height: "44px"
  status-pill:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.text-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
    height: "24px"
  status-pill-positive:
    backgroundColor: "{colors.positive-soft}"
    textColor: "{colors.positive}"
  status-pill-danger:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger}"
  status-pill-warning:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning-strong}"
  status-pill-info:
    backgroundColor: "{colors.info-soft}"
    textColor: "{colors.info}"
  filter-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "36px"
  filter-chip-current:
    backgroundColor: "{colors.text}"
    textColor: "{colors.surface}"
  sidebar-link:
    backgroundColor: "{colors.sidebar}"
    textColor: "{colors.on-dark-muted}"
    rounded: "{rounded.base}"
    padding: "0 12px"
    height: "40px"
  sidebar-link-current:
    backgroundColor: "{colors.sidebar-raised}"
    textColor: "{colors.surface}"
  tabbar:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-muted}"
    height: "60px"
  sheet:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.base}"
    width: "520px"
  sheet-mobile:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.sheet}"
    width: "100%"
  table-header:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.text-secondary}"
    typography: "{typography.label}"
    height: "40px"
  table-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    height: "52px"
---

# Design System: Pace Lab Gestão

## Overview

**Creative North Star: "A Prancheta do Treinador"**

O app de trabalho da Pace Lab é um sistema só, para equipe e alunos, no computador e no celular. A marca vive em três lugares e só neles: os títulos condensados em caixa alta que terminam em ponto, o marcador laranja inclinado que diz "você está aqui", e as superfícies escuras com faixas diagonais translúcidas (sidebar, topo do celular, painel do login, cartão da assinatura, tutorial). Todo o resto é ferramenta: neutros esverdeados, texto quase preto, divisórias finas, números tabulares, cantos de 2px.

A densidade é de operação. A equipe lê mais de mil registros por dia, então as telas são seções planas empilhadas e separadas por réguas, com faixas de números no topo e tabelas que viram listas empilhadas no celular. Não há grade de cartões de dashboard nem cartão dentro de cartão; a profundidade é tonal e só os overlays (diálogo, menu, tutorial) ganham sombra.

O laranja da marca é o acento único. Ele aparece em três papéis, cada um com seu tom: o marcador (#e15d37 puro, nunca em texto), o preenchimento da ação primária (tom mais escuro, para o branco passar AA) e os links (tom ainda mais escuro, para passar AA sobre o fundo claro).

**Key Characteristics:**
- Seções planas separadas por divisórias; uma régua forte (`line-strong`) abre cada faixa de números.
- Títulos de página em Anton, caixa alta, terminando em ponto; o resto na sans do sistema com numerais tabulares.
- Marcador em paralelogramo laranja a -12° só no item atual: navegação, aba, passo, métrica.
- Superfície escura com faixas a 112° como assinatura do shell e das telas de acesso.
- Cantos de 2px em tudo que é controle ou contêiner; pílula só para status e filtros; círculo só para marcadores numéricos e avatares.
- Alvos de toque de 44px, foco visível em laranja escuro, movimento curto e substituído por opacidade em `prefers-reduced-motion`.

## Colors

Neutros frios levemente esverdeados, um laranja de corrida como acento único e quatro cores de estado sóbrias.

### Primary
- **Laranja Pace (Marcador)** (`accent`): a cor da marca em estado puro. Só em marcas não textuais: o marcador de "você está aqui", a barra de progresso e o contorno do tutorial, e o anel de foco sobre superfícies escuras. Nunca em texto e nunca como preenchimento de botão (3,6:1 contra branco).
- **Laranja Ação** (`accent-strong`): preenchimento do botão primário, anel de foco padrão (`--focus-ring`), borda de campo em foco, `accent-color` de checkbox e radio, cursor de texto. Branco sobre ele dá 4,8:1. Hover em `accent-strong-hover`.
- **Laranja Link** (`accent-text`): texto de link (`.link`), hover de títulos em linhas clicáveis, ícone de ordenação ativo. 5,2:1 sobre o fundo, 5,9:1 sobre branco.

### Neutral
- **Névoa de Pista** (`bg`): fundo de todas as telas.
- **Branco Papel** (`surface`): campos, tabelas, diálogos, barra inferior, painel do formulário de acesso.
- **Papel Elevado** (`surface-raised`): hover de linha de tabela, campos somente leitura, caixa de código, opção marcada.
- **Papel Rebaixado** (`surface-sunken`): cabeçalho de tabela, pílula neutra, controle segmentado, botão desabilitado.
- **Papel em Hover** (`surface-hover`): hover de botão discreto, item de menu, métrica clicável e linha de extrato.
- **Grafite de Pista** (`sidebar`) e **Grafite Elevado** (`sidebar-raised`): superfície escura do shell; o elevado marca hover e item atual na sidebar.
- **Painel da Marca** (gradiente 160° de `brand-panel-top` para `brand-panel-bottom`): painel do login, cartão da assinatura do aluno, cartão do tutorial.
- **Linhas**: `line` divide seções e contorna tabelas; `line-soft` divide linhas dentro de uma lista; `line-control` é a borda de campos, chips e botões secundários (3,6:1, passa como não texto); `line-strong` é a régua que abre faixas de números.
- **Texto**: `text` para conteúdo e títulos; `text-secondary` para cabeçalhos de tabela e a linha de contexto; `text-muted` para apoio, rótulos e metadados (5,2:1 sobre o fundo); `text-placeholder` só em placeholder; `text-disabled` só no texto de botão desabilitado.
- **Texto sobre escuro**: `on-dark`, `on-dark-muted` (links da sidebar), `on-dark-subtle` (rótulos de grupo, papel do usuário), `on-dark-line` (barra de rolagem da sidebar).
- **Sobre o painel da marca**: `accent-on-dark` é o laranja dos rótulos curtos no painel escuro (login, cartão da assinatura, tutorial; 7:1 sobre `sidebar`), o único caso em que um laranja vira texto fora de `accent-text`. `positive-on-dark`, `danger-on-dark` e `warning-on-dark` são o texto das pílulas de estado sobre o cartão da assinatura do aluno.

### Estados
- **Verde de Valor** (`positive` / `positive-soft`): pago, em dia, ativo, receita, passo concluído.
- **Carmim** (`danger` / `danger-soft`, hover `danger-hover`): erro, atraso, custo, ações destrutivas.
- **Ocre** (`warning` / `warning-soft`, texto em `warning-strong`): aguardando, pendente.
- **Azul Ardósia** (`info` / `info-soft`): cortesia, valor exclusivo, avisos informativos.

### Named Rules
**The Three Oranges Rule.** O laranja tem três tons com três papéis fixos: `accent` marca, `accent-strong` preenche a ação, `accent-text` é texto. Um tom nunca faz o papel do outro.

**The One Accent Rule.** O laranja é o único acento da marca. Estados usam verde, carmim, ocre e ardósia, todos dessaturados; nenhuma outra cor de marca entra.

**The Text Is The Status Rule.** Toda cor de estado vem acompanhada de texto (pílula com ponto + rótulo, mensagem com ícone + frase). A cor reforça; nunca é a única informação.

## Typography

**Display Font:** Anton (servida por `next/font/local` a partir de `src/app/fonts/anton-latin.woff2`, variável `--font-anton`; fallback Impact, Arial Narrow Bold)
**Body Font:** sans do sistema (-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial), com `font-variant-numeric: tabular-nums` no corpo inteiro

**Character:** Um condensado pesado de cartaz de prova para títulos e números grandes, e uma sans neutra e nativa para trabalhar. O contraste entre os dois é a tipografia da marca.

### Hierarchy
- **Display** (Anton 400, `display` 2.75rem / `display-mobile` 2rem abaixo de 560px, line-height 0.95, caixa alta, `text-wrap: balance`): o H1 de cada página, sempre terminando em ponto ("Alunos.", "Saúde da base.", "Bem-vindo de volta."). No painel do login sobe para `clamp(2.75rem, 5vw, 4.5rem)`.
- **Figure** (Anton 400, 1.75rem a `clamp(1.75rem, 3.4vw, 2.75rem)`, line-height 1): números que pedem decisão: valores da faixa-resumo, métricas, totais do extrato, preço do plano, valor a pagar. Numeral grande em Anton é o segundo uso legítimo da fonte display.
- **Title** (sans 700, 1.125rem, line-height 1.25): títulos de seção (`.section-title`) e de diálogo. Sem caixa alta, sem ponto.
- **Body** (sans 400, 1rem, line-height 1.5): texto corrido e valor de campos. Textos de apoio limitados a 68ch.
- **Body small** (sans 0.875rem): botões (600), células de tabela, listas, mensagens.
- **Label** (sans 600, 0.75rem): rótulos de métrica e de lista de definição, cabeçalho de tabela, pílulas.
- **Label caps** (sans 600, 0.75rem ou 11px, letter-spacing 0.14em, caixa alta): só a linha de contexto da página e os rótulos de grupo da navegação.

### Named Rules
**The Full Stop Rule.** Todo título em Anton termina em ponto final. Títulos de seção na sans não levam ponto.

**The Two Faces Rule.** Anton só para o H1 da página e para números de decisão. Tudo que se lê em sequência ou se opera fica na sans do sistema. Nenhuma terceira família, exceto a monoespaçada do sistema na caixa de código copiável.

**The One Context Line Rule.** A linha de contexto em caixa alta espaçada existe uma vez por página, acima do H1. Ela veio dos antigos eyebrows (decisão aprovada pelo dono: "Eyebrow vira linha de contexto") e por isso guarda o texto que cada tela já tinha: a área ("Comercial", "Área do aluno"), o caminho com volta ("‹ Alunos / Perfil", link para a lista) ou o rótulo herdado ("Base histórica", "Gestão financeira", "Pagamento confirmado"). Telas novas usam área ou caminho. Trocar um rótulo herdado é mudança de texto e passa pelo dono. Ela não aparece em títulos de seção internos.

## Layout

Coluna única de conteúdo com largura máxima de 1220px (`content-max`), centrada à direita da sidebar. Espaço em grade de 4px (`space-1` a `space-8`); seções respiram 32px acima e abaixo (`space-6`), separadas por `line`.

- **Desktop (≥ 900px):** sidebar escura fixa de 248px à esquerda, agrupada em Operação, Comercial e Financeiro, com Configurações, Admin da loja, Tutorial e a conta presos no rodapé. Conteúdo com 48px no topo e laterais de `clamp(32px, 4vw, 64px)`.
- **Tablet (560–899px):** sem sidebar; topo escuro e barra inferior como no celular; laterais de 32px.
- **Celular (< 560px):** topo escuro sticky de 56px com o wordmark; barra inferior fixa de 60px com as quatro primeiras áreas permitidas (ordem: Visão geral, Demandas, Alunos, Vendas, Analisar, Financeiro, Planos, Integrações) e "Mais", que abre um sheet com o restante, a conta e Sair. O aluno não tem barra inferior: o menu fica no botão do topo. O conteúdo reserva a altura da barra mais `env(safe-area-inset-bottom)`.
- **Listas:** tabela acima de 760px; abaixo, lista empilhada (`responsive-rows`) com linhas de 64px.
- **Duas colunas:** perfil e visão geral dividem em duas colunas (1.6fr/1fr e 1.4fr/1fr) a partir de 1100px.
- **Faixas de números:** colunas automáticas de 170px no mínimo; métricas em 3 ou 4 colunas que caem para 2 abaixo de 760px e para 1 abaixo de 400px; valores em dinheiro ficam um por linha abaixo de 560px.
- **Filtros no celular:** chips em uma linha só com rolagem lateral até a borda da tela.
- **Acesso:** login e senha em duas colunas (painel da marca + formulário de até 400px) a partir de 900px; empilhados abaixo.

### Named Rules
**The Same Tool Everywhere Rule.** Nenhuma tarefa é exclusiva do desktop. Toda tabela tem a lista empilhada equivalente, todo diálogo vira bottom sheet e toda ação primária fica alcançável pelo polegar acima da barra inferior.

## Elevation & Depth

O sistema é plano. A profundidade vem do tom (fundo `bg`, superfícies brancas, cabeçalhos rebaixados) e das divisórias. Sombra só existe em camadas que flutuam sobre a página e em três sinais de estado pequenos.

### Shadow Vocabulary
- **Overlay** (`--shadow-overlay`: `0 18px 40px rgba(16,23,20,0.18), 0 2px 6px rgba(16,23,20,0.08)`): diálogo/sheet, menu de ações, cartão do tutorial.
- **Scrim** (`--scrim`: `rgba(16,23,20,0.46)`): fundo do `<dialog>` aberto.
- **Anel de foco de campo** (`0 0 0 3px rgba(199,71,39,0.28)` com borda `accent-strong`).
- **Anel de seleção** (`inset 0 0 0 1px` na cor `text`, somado à borda `text`): opção de pagamento, cartão de escolha, alternância marcada.
- **Segmento ativo** (`0 1px 2px rgba(16,23,20,0.12)`): o botão pressionado do controle segmentado.

### Named Rules
**The Flat Page Rule.** Nada que fica na página tem sombra. Se um bloco precisa se destacar, ganha régua, tom ou posição, não elevação.

## Shapes

Cantos quase retos (2px, `rounded.base`) em botões, campos, menus, diálogos no desktop, mensagens e painéis. A exceção de raio maior é o topo do bottom sheet no celular (12px, `rounded.sheet`). Pílula (`rounded.pill`) só em pílulas de status e chips de filtro. Círculo só em avatares, número do passo, marca de atividade e sinal de lançamento.

A forma-assinatura é o **paralelogramo inclinado a -12°**, o ângulo do itálico do wordmark. Ele é recortado por `clip-path` com dois tokens: `--marker-shape` (corte de 4px, marcadores curtos) e `--marker-shape-bar` (corte de 7px, barras longas como aba ativa e barra inferior, para o corte aparecer em 1x). O mesmo ângulo diagonal aparece nas faixas translúcidas a 112° das superfícies escuras (`--stripes-dark` no shell e no tutorial; faixas mais largas no painel do login).

### Named Rules
**The You-Are-Here Rule.** O paralelogramo laranja marca só a posição atual: item atual da sidebar, aba atual da barra inferior e do menu "Mais", aba ativa, passo atual do stepper, métrica atual ou em hover numa faixa que navega. Ele nunca decora título, seção, botão ou cartão.

## Components

### Buttons
Diretos e firmes; texto curto em sans 600.
- **Shape:** cantos de 2px, altura mínima de 44px (`control-h`), padding lateral de 16px, ícone opcional de 20px com 8px de gap.
- **Primary:** fundo `accent-strong`, texto branco; hover `accent-strong-hover`. Uma ação primária por bloco.
- **Secondary:** fundo branco, borda `line-control`; hover em `surface-raised` com borda `text-secondary`.
- **Quiet:** sem fundo nem borda; hover em `surface-hover`.
- **Danger:** contorno carmim sobre branco (hover `danger-soft`); **Danger solid** com fundo carmim só para confirmar uma destruição.
- **Disabled:** fundo `surface-sunken`, sem borda, cursor bloqueado.
- **Icon button:** quadrado de 44px, sem fundo, hover em cinza translúcido.
- **Transição:** cor, fundo e borda em 140ms (`--dur-1`) com `--ease-out`.

### Chips
- **Filtro (`FilterChips`):** pílula de 36px (44px em toque ou abaixo de 900px), borda `line-control`, texto `text-secondary`, contagem em `text-muted` (carmim no filtro de atraso).
- **Atual:** fundo `text` e texto branco (`aria-current="true"` ou `aria-pressed="true"`). O atual de um filtro é preenchido em grafite, não em laranja.

### Status pill
- `StatusPill` com `toneForLabel`: ponto de 6px na cor do texto + rótulo, 0.75rem 600, pílula de 24px. Tons positive, danger, warning, info e neutral mapeados a partir dos rótulos já usados pelo sistema ("Em dia", "Em atraso", "Aguardando pagamento", "Cortesia", "Inativo").

### Cards / Containers
- Não há cartão de conteúdo. A unidade é a **seção plana** (`section-block`): 32px de respiro vertical, régua `line` no topo, cabeçalho com título (Title) e texto de apoio em `text-muted`.
- **Faixa-resumo e faixa de métricas:** régua `line-strong` em cima e `line` embaixo, colunas separadas por `line`, rótulo em Label e número em Figure. Uma métrica clicável leva à lista filtrada e mostra o marcador ao passar o mouse.
- **Cartões de escolha** (plano, forma de pagamento, alternância) são controles, não contêineres: borda `line-control` de 1px, 2px de canto, seleção por anel interno em `text`.
- **Superfície da marca:** cartão da assinatura do aluno e cartão do tutorial usam o painel escuro com faixas, 2px de canto.

### Inputs / Fields
- **Style:** fundo branco, borda 1px `line-control`, 2px de canto, altura mínima de 44px, padding 10px 12px, texto 1rem. Rótulo acima em 0.875rem 600; dica e erro abaixo em 0.75rem/0.875rem.
- **Hover:** borda `text-secondary`.
- **Focus:** borda `accent-strong` + anel de 3px em laranja translúcido; outros elementos usam outline de 2px `--focus-ring` com offset de 2px.
- **Error:** borda carmim (`aria-invalid`), mensagem carmim com ícone.
- **Disabled / readonly:** fundo `surface-raised`, texto `text-secondary`.
- **Select:** chevron SVG desenhado no próprio CSS, sem aparência nativa.
- **Checkbox e radio:** nativos, 20px, `accent-color: accent-strong`; o rótulo inteiro (`.check`) é o alvo de toque.

### Tabelas e listas
- Cabeçalho de 40px em `surface-sunken`, rótulos em `text-secondary`; linhas de 52px em branco divididas por `line-soft`; hover em `surface-raised`. Números alinhados à direita. Coluna ordenável com ícone que fica laranja-link quando ativo.
- Célula principal em 600, secundária em 0.75rem `text-muted`; atraso em carmim 600.
- No celular, lista empilhada de 64px por linha; a linha inteira é o link.
- **Paginação** (`Pagination`): texto do intervalo à esquerda, botões secundários à direita; abaixo de 400px os botões dividem a largura.

### Navigation
- **Sidebar:** grafite com faixas, rótulos de grupo em Label caps `on-dark-subtle`, links de 40px em `on-dark-muted` com ícone de 18px; hover e atual em `sidebar-raised` com texto branco; o atual leva o paralelogramo laranja colado à borda esquerda.
- **Barra inferior:** branca, borda `line` no topo, ícones de 22px sobre rótulos de 11px 600; o atual fica em `text` com uma barra-paralelogramo laranja de 6px no topo.
- **Menu "Mais" / menu do aluno:** lista de links de 48px dentro do Sheet, divididos por `line-soft`; o atual em 700 com o marcador inclinado à direita.
- **Abas:** links de 44px em `text-muted`, borda `line` embaixo; a ativa em `text` com barra-paralelogramo de 6px.
- **Linha de contexto:** ver The One Context Line Rule; quando tem link, ganha seta de volta e alvo de 44px no toque.

### Sheet (diálogo)
- `<dialog>` nativo: foco preso, Esc fecha, clique no fundo fecha e o foco volta a quem abriu. Desktop: centrado, até 520px (680px no largo), 2px de canto, sombra Overlay, scrim. Abaixo de 560px: bottom sheet de largura total, topo de 12px, alça de 40×4px, `safe-area-inset-bottom` respeitado. Entrada de 220ms subindo 8px (24px no celular); em movimento reduzido, só opacidade.

### Menu de ações
- `MenuButton`: gatilho em icon button com borda; lista branca de no mínimo 220px, borda `line`, sombra Overlay, itens de 44px; item destrutivo em carmim.

### Mensagens e feedback
- Faixa de 2px de canto no tom de estado (`*-soft` de fundo, cor plena no texto) com ícone. `Feedback` mantém duas regiões sempre no DOM: `aria-live="polite"` para sucesso e `role="alert"` para erro.

### Stepper
- Passos de 44px com número em círculo de 26px. Atual: círculo preenchido em `text` e o paralelogramo laranja de 5px sob o rótulo. Concluído: círculo em `positive-soft`/`positive`.

### Ícones
- `Icon`: SVG próprio em grade de 24, traço único de 1,75, pontas e junções arredondadas, 20px por padrão (16px pequeno). Decorativo por padrão (`aria-hidden`); com `label` vira `role="img"`.

### Wordmark
- `Brand`: o SVG "PACE LAB." de `public/assets/images/pace-lab.svg`, invertido para branco por filtro em superfícies escuras. 104px na sidebar e no login, 64px no topo do celular.

## Do's and Don'ts

### Do:
- **Do** usar os tokens de `src/styles/tokens.css` para toda cor, espaço, raio, movimento e forma; o arquivo é a fonte da verdade.
- **Do** escrever CSS puro dentro das camadas `reset, tokens, base, components, shell, screens`, repetindo a declaração de ordem no topo de cada arquivo de camada, e importar o arquivo novo em `src/app/globals.css`.
- **Do** terminar todo H1 em Anton com ponto final e manter uma única linha de contexto acima dele.
- **Do** preencher a ação primária com `accent-strong` e escrever links em `accent-text`.
- **Do** aplicar o paralelogramo com `clip-path: var(--marker-shape)` ou `var(--marker-shape-bar)` e cor `accent`, só no item atual.
- **Do** separar seções por divisórias e abrir faixas de números com a régua `line-strong`.
- **Do** dar 44px de alvo a todo controle tocável e respeitar `env(safe-area-inset-*)` no topo, na barra inferior e no sheet.
- **Do** oferecer lista empilhada para toda tabela abaixo de 760px e transformar todo diálogo em bottom sheet abaixo de 560px.
- **Do** trocar deslocamento por opacidade ou cor quando `prefers-reduced-motion: reduce`.
- **Do** servir fontes só por `next/font` (local ou google), mantendo o CSP estrito (`font-src 'self' data:`, sem CDN externo).

### Don't:
- **Don't** usar `accent` (#e15d37) como texto ou como fundo de botão com texto branco; ele não passa AA.
- **Don't** usar o marcador laranja como enfeite de título, seção, botão ou cartão.
- **Don't** montar grade de cartões de dashboard nem cartão dentro de cartão; não dar sombra a nada que fique na página.
- **Don't** arredondar além de 2px fora do topo do bottom sheet; não usar pílula em botão, campo ou contêiner.
- **Don't** usar Anton em texto corrido, rótulos, botões ou títulos de seção.
- **Don't** introduzir uma segunda cor de marca, ícones de fonte ou glifos no lugar de ícones SVG.
- **Don't** redesenhar, distorcer ou trocar o wordmark, nem usar o logo antigo de faixas vermelhas.
- **Don't** adicionar Tailwind, biblioteca de componentes ou qualquer dependência nova sem aprovação.
- **Don't** carregar fontes, estilos ou scripts de CDN externo nem afrouxar o CSP.
- **Don't** aplicar este sistema ao layout HTML dos e-mails (`src/lib/email.ts`) nem à loja (`loja-pacelab/`), que tem identidade própria.
- **Don't** alterar a marcação nem os atributos dos campos de cartão do Appmax em `src/components/checkout-payment.tsx`; estilize ao redor deles.
