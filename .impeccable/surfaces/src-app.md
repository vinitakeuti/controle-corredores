---
version: 1
slug: "src-app"
primary_target: "src/app"
related_targets: ["src/components/app-shell.tsx","src/components/mobile-nav.tsx"]
---

# Surface brief: app de gestão Pace Lab (todas as telas)

## Escopo e modo
Todas as telas de `src/app` (equipe: `/admin/**`; aluno e públicas: `/aluno`, `/pagamento/[token]`, `/login`, `/recuperar-senha`, `/redefinir-senha/[token]`) e o shell (`src/components/app-shell.tsx`, `mobile-nav.tsx`, `platform-tutorial.tsx`). Modo: **Operate** em todas. Login e redefinição de senha podem ter mais presença de marca, mas continuam Operate. Code-first, sem comps em imagem.

## Tarefa
Equipe (ADMIN, MANAGER, OPERATOR): operar a empresa diariamente, meio a meio entre computador e celular, sobre mais de 1.000 alunos. A primeira leitura é o que pede ação: atraso, vencimento, pendência. Aluno: pagar, assinar o termo e saber se está em dia, quase sempre no celular.

## Restrições desta superfície
Evolução do mundo estabelecido. Funções, dados, permissões e textos factuais não mudam. CSS puro, CSP estrito, fontes servidas pelo app. PWA no iPhone: o usuário confirmou que o topo aparece normal hoje, então o comportamento do status bar não muda; o inset inferior continua respeitado.

Comportamentos liberados pelo usuário em 2026-11-05: paginar Vendas; filtro e ordenação em Alunos; mostrar ao aluno em atraso que ele está em atraso (com o texto aprovado antes). Analisar dados mantém o padrão atual ("Em dia").

## Direção escolhida
Evolução fixada pelo brief, sem roll. A assinatura é o marcador laranja inclinado. Diagnóstico de 2026-11-05: design 21/40, técnica 10/20.

## Decisões tomadas (2026-11-05)
- Fonte de títulos: Anton, servida via next/font/local.
- Eyebrow vira linha de contexto no topo da página e sai dos títulos de seção internos.
- Celular da equipe: barra inferior com as 4 primeiras áreas permitidas + "Mais" (sheet com o restante, a conta e Sair).
- Liberado: coluna "Próxima cobrança" e "venceu há X dias" nas listas; status real do aluno ATIVO com vencimento passado na /aluno.
- Não liberado: telefone clicável e botão "Ligar" no perfil (o telefone continua texto).
- Tela piloto: perfil do aluno.

## Direction contract
THESIS: O app de trabalho da Pace Lab é um sistema só. A marca vive nos títulos condensados com ponto final, no marcador laranja inclinado de "você está aqui" e nos painéis escuros com faixas diagonais. O resto é uma ferramenta sóbria, densa e acessível. Recusa o dashboard SaaS de grade de cartões e os remendos por tela.

OWN-WORLD: Neutros #edf0ec / #ffffff / #f6f7f3 / #e5e9e3, texto #17201d, muted #5b6661, borda de controle #7f8a85. Shell escuro #151a1a com faixas translúcidas a 112°. Laranja #e15d37 para marcas, #c74727 para preencher a ação, #b03d1f para links. Carmim #b3173a para erro e atraso, verde #31523e para positivo, ocre #8a5a00 para atenção. Títulos em Anton (next/font/local), caixa alta, com ponto. Corpo na sans do sistema com numerais tabulares. Cantos de 2px; seções planas separadas por divisórias; pill só para status; ícones SVG com traço de 1,75.

STORY: A equipe vê primeiro o que pede ação, chega ao registro em um toque, age e recebe confirmação. O aluno sabe de relance se está em dia e paga em três passos.

FIRST VIEWPORT: Desktop: sidebar escura de 248px, agrupada (Operação, Comercial, Financeiro), com a conta fixa no rodapé. No conteúdo, a linha de contexto (ALUNOS / PERFIL) fica acima do H1 em Anton com ponto. Logo abaixo, uma faixa-resumo com régua: status, próxima cobrança, valor na fonte display e termo. Na visão geral, uma faixa de métricas em que cada número leva à lista filtrada. Celular: topo escuro de 56px, barra inferior com quatro áreas permitidas e um sheet "Mais"; a ação primária fica ao alcance do polegar.

FORM: Evolução do mundo estabelecido da Pace Lab (fixado pelo brief). Movimento-assinatura: marcador laranja inclinado a -12°, o itálico do wordmark, no item de navegação atual, na aba ativa e no passo atual. seed: none (unavailable)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
