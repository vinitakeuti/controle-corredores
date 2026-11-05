# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Next.js 16 (App Router), React 19, Prisma e PostgreSQL. Também é PWA: alunos instalam no iPhone pela tela de início (`appleWebApp` com `statusBarStyle: black-translucent`, `src/app/manifest.ts`). Continua sendo web, não nativo.

## Users

Pace Lab é uma assessoria e academia de corrida de Maceió ("A academia do corredor"). O sistema tem dois públicos, servidos pelo mesmo app e separados por domínio (`src/proxy.ts`, `src/lib/portal.ts`):

- **Equipe** (`gestao.pacelabcoaching.com`): usa o sistema todos os dias, em todas as áreas, para controlar a empresa. Alterna meio a meio entre computador e celular.
  - **ADMIN**: acesso total, inclusive Configurações (Equipe e E-mails).
  - **MANAGER** (Gerente): áreas liberadas uma a uma pelo admin (visão geral, demandas, vendas, alunos, análise, financeiro, planos, integrações).
  - **OPERATOR** (Operador): demandas, vendas, alunos e análise. Tela inicial: `/admin/alunos`.
- **Alunos** (`alunos.pacelabcoaching.com`, enquanto `STUDENT_PORTAL_ENABLED=false` atendidos no domínio de gestão): escolhem o plano, pagam (Pix, Pix Automático, cartão, boleto), assinam o termo de responsabilidade e acompanham a assinatura. Muitos usam só o celular, frequentemente pelo app instalado na tela de início.

## Product Purpose

Sistema interno que gerencia alunos, planos, cobranças recorrentes, demandas da equipe, vendas e financeiro da Pace Lab. Para a equipe, sucesso é operar a empresa inteira em um só lugar, com leitura rápida e sem erro. Para o aluno, sucesso é entrar, escolher o plano, pagar e assinar o termo sem fricção, e depois saber de relance se a assinatura está em dia.

## Operating Context

- Volume: mais de 1.000 alunos ativos. Listas, tabelas, filtros e busca precisam funcionar com muitos registros.
- Todas as áreas da equipe são usadas diariamente: demandas, alunos e cobranças, vendas, análise, financeiro.
- Fuso de referência: sempre America/Maceio. Valores em R$ no formato pt-BR.
- Pagamentos via Appmax (Appmax JS tokeniza o cartão no navegador) e Asaas (Pix Automático; cartão pela fatura hospedada do Asaas).
- Tutorial da plataforma no primeiro acesso, por perfil (`src/components/platform-tutorial.tsx`), com oferta de instalar no iPhone.
- A loja Pace Lab é outro produto e outro repositório (`loja-pacelab/`), com identidade própria. O app de gestão só liga para ela ("IR PARA A LOJA" no aluno, "Admin da loja" na equipe).
- Deploy automático em produção (EasyPanel) a cada push na `main`.

## Capabilities and Constraints

Telas da equipe (`src/app/admin/...`):

- Visão geral, com valores financeiros que podem ser ocultados;
- Demandas: quadro por área, com colunas, pastas, agenda e arquivo;
- Vendas e análise de vendas;
- Alunos: lista, novo aluno e perfil (condição comercial, cortesia, inativação, link de redefinição de senha, termo);
- Analisar dados: atraso e vencimentos, com filtros;
- Financeiro: receitas, despesas fixas e variáveis, receita contratada × caixa, vendas da loja;
- Planos, Cobranças, Integrações (Appmax e Asaas);
- Configurações (só ADMIN): abas Equipe e E-mails (teste de modelos e registro de envios);
- Sem acesso.

Telas do aluno e públicas: `/aluno` (escolha de plano, pagamento, termo, aviso de conta inativa), `/pagamento/[token]` (link de pagamento), `/login`, `/recuperar-senha`, `/redefinir-senha/[token]` (com identificação da conta).

Restrições técnicas e de produto:

- Funcionalidades, regras, permissões e públicos são fixos. Mudanças de interface não alteram `src/lib/**`, `src/app/api/**`, `prisma/`, autenticação, sessões, `src/proxy.ts` nem fluxos de pagamento.
- Nenhuma função, campo, filtro, estado, dado exibido ou ação pode ser removido, nem mudar quem pode ver ou fazer o quê, sem aprovação.
- Textos factuais (prazos, valores, regras de cobrança, termos legais) não mudam.
- Checkout por cartão (`src/components/checkout-payment.tsx`) depende do Appmax JS e da fatura hospedada do Asaas; campos e scripts não podem quebrar.
- CSP (`next.config.ts`): `font-src 'self' data:`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' data: blob:`, scripts só do próprio site e de `scripts.appmax.com.br`. Sem CDN externo; fontes servidas pelo próprio app (`next/font/local` ou `next/font/google`). Afrouxar o CSP exige aprovação.
- CSS puro, sem Tailwind nem biblioteca de componentes. Dependência nova exige aprovação.
- PWA no iPhone: `black-translucent` e áreas seguras (`env(safe-area-inset-*)`) precisam continuar funcionando.
- Layout HTML dos e-mails (`src/lib/email.ts`) fica fora do escopo de design, salvo pedido.

## Brand Commitments

Identidade estabelecida e obrigatória (marca incompleta, mundo existente: evoluir, não substituir).

- **Nome e wordmark:** "PACE LAB." em itálico e caixa alta (`public/assets/images/pace-lab.svg`, componente `src/components/brand.tsx`; versões raster 2160×2160 em `public/assets/images/pace-lab.png` e `pace-lab-branco.png`). Não redesenhar, não distorcer, não trocar. O logo antigo de faixas vermelhas (`logo+name.png`, `icon.png`) não é a identidade atual e não deve ser usado.
- **Paleta:** fundo claro `#edf0ec`; superfícies `#ffffff` / `#f6f7f3`; texto `#17201d`; muted `#69746f`; linha `#d5dbd4`; sidebar escura `#151a1a`; acento laranja/coral `#e15d37` (variante `#c74727`); verde de valores positivos `#31523e`. Tons, contraste e escala de neutros podem ser refinados e estados criados, mas o laranja continua sendo o acento único da marca e o verde escuro continua indicando valores positivos.
- **Tipografia:** títulos condensados, pesados, em caixa alta (hoje Impact), terminando em ponto final ("Configurações.", "Olá, Ana."). Eyebrows pequenos, em caixa alta e espaçados acima dos títulos. Texto corrido sem serifa. A família pode trocar por uma condensada melhor que mantenha o caráter, respeitando o CSP.
- **Painel escuro com faixas diagonais translúcidas** (lado esquerdo do login, gradiente `#26332e` → `#101714`; banners em `.github/assets/`). É assinatura da marca.
- **Sobriedade estrutural:** seções planas organizadas por divisórias, sem cartões dentro de cartões.
- **Voz:** português do Brasil, direto e acolhedor, com vocabulário de corrida no lugar certo ("Seu próximo treino começa aqui.", "Cada aluno, no ritmo certo.").

## Evidence on Hand

- Wordmark: `public/assets/images/pace-lab.svg`, `pace-lab.png`, `pace-lab-branco.png`.
- Banners de marca: `.github/assets/banner.png`, `.github/assets/social-preview.png`.
- Termo de responsabilidade: `public/termos/PACELAB_Termo_Responsabilidade_2026.pdf`.
- Copy de tutorial e login existentes como referência de voz.
- Dados de demonstração via `npm run db:seed` (admin@pabula.com, aluno@pabula.com). Não há métricas, depoimentos ou números de negócio para exibir além dos dados do próprio sistema.

## Product Principles

1. **O dado vem primeiro.** A equipe opera a empresa inteira por aqui todos os dias; cada tela serve leitura rápida e ação precisa sobre muitos registros.
2. **Mesma ferramenta no computador e no celular.** A equipe alterna meio a meio; nenhuma tarefa pode ser exclusiva do desktop.
3. **Pagar é fácil e confiável.** O aluno paga, assina e acompanha sem ajuda, quase sempre no celular.
4. **Interface muda, comportamento não.** Funções, regras, permissões e textos factuais são preservados.
5. **A marca está no detalhe.** Wordmark, títulos com ponto final, acento laranja e o painel diagonal carregam a identidade; o resto é sóbrio.

## Accessibility & Inclusion

Contraste WCAG AA, foco visível, navegação por teclado em menus, abas e modais, alvos de toque de pelo menos 44px no celular e `prefers-reduced-motion` respeitado.
