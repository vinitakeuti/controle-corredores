# Pace Lab — Controle de assinaturas

Base inicial em Next.js, Prisma e PostgreSQL para uma equipe de corredores e atletas.

## Rodando localmente

1. Copie `.env.example` para `.env` e ajuste `DATABASE_URL`.
2. Suba o PostgreSQL: `docker compose up -d db`.
3. Instale as dependências: `npm install`.
4. Crie as tabelas: `npm run db:deploy`.
5. Popule o ambiente de demonstração: `npm run db:seed`.
6. Rode: `npm run dev`.

Usuários de demonstração:

- Admin: `admin@pabula.com` / `Admin@123`
- Aluno: `aluno@pabula.com` / `Aluno@123`

## Deploy no EasyPanel

O `Dockerfile` usa o modo standalone do Next.js, escuta explicitamente em `0.0.0.0:3000` e executa `prisma migrate deploy` antes de iniciar o servidor, aplicando automaticamente as migrations presentes em `prisma/migrations` quando o container sobe conectado ao Postgres. O container também possui healthcheck em `/login`.

Configure no serviço as variáveis `DATABASE_URL`, `SESSION_SECRET` e `INTEGRATION_ENCRYPTION_KEY`. Use chaves aleatórias estáveis com pelo menos 32 caracteres para `SESSION_SECRET` e `INTEGRATION_ENCRYPTION_KEY`. `APPMAX_WEBHOOK_TOKEN` é necessário quando o webhook da Appmax for habilitado, mas não é necessário para o processo HTTP subir. Não é necessário publicar a porta do Postgres; o serviço web precisa apenas alcançar o banco pela rede configurada no EasyPanel.

No EasyPanel, em `Domains & Proxy`, use `Proxy Port = 3000`. O `DATABASE_URL` deve apontar para o nome do serviço PostgreSQL dentro da rede do projeto, nunca para `localhost`. A porta publicada do banco não é necessária para o app.

Se o serviço aparecer como `not reachable`, confira primeiro se o domínio está encaminhando para a porta interna `3000`. Depois leia os logs de runtime: o container agora interrompe o startup com uma mensagem explícita quando `SESSION_SECRET`, `INTEGRATION_ENCRYPTION_KEY` ou `DATABASE_URL` estiverem ausentes.

Em produção, publique o serviço atrás de HTTPS. Quando a requisição chegar com HTTPS, a sessão usa automaticamente um cookie `__Host-`; em desenvolvimento/local HTTP, usa um cookie compatível com `localhost`.

## E-mail SMTP

O envio usa o servidor SMTP da hospedagem. No EasyPanel, configure:

```text
SMTP_HOST=mail.vixpi.host
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=contato@pacelabcoaching.com
SMTP_PASSWORD=senha-da-caixa-de-email
EMAIL_FROM=Pace Lab <contato@pacelabcoaching.com>
APP_URL=https://gestao.pacelabcoaching.com
EMAIL_CRON_SECRET=chave-aleatoria-longa
```

Depois de reiniciar o serviço, abra `Administração > Integrações > E-mails da Pace Lab` para enviar testes dos quatro modelos: redefinição de senha, pagamento falho, pagamento confirmado e lembrete de vencimento.

Para os lembretes de vencimento funcionarem automaticamente, crie uma tarefa diária às 09:00 (horário de Maceió) no agendador do EasyPanel que faça uma requisição GET para:

```text
https://gestao.pacelabcoaching.com/api/cron/email-reminders
```

com o header `Authorization: Bearer SEU_EMAIL_CRON_SECRET`. A rota é protegida pelo segredo e evita duplicar o aviso para o mesmo aluno e vencimento.

As proteções iniciais incluem rate limit de login em memória, comparação de senha contra hash dummy para reduzir enumeração por tempo, tokens de sessão armazenados apenas como HMAC no banco, validação de origem em POSTs, headers de segurança, respostas sem cache em autenticação/pagamentos e container sem root. Para múltiplas réplicas, substitua o rate limit em memória por Redis ou outro armazenamento compartilhado.

## Appmax

A integração cria ou atualiza o cliente, cria o pedido e processa Pix, boleto ou cartão. O cartão é tokenizado diretamente no navegador pelo Appmax JS; número e CVV não passam pelo servidor da aplicação.

Abra `Administração > Integrações` para cadastrar ou editar a conexão. A central lista os provedores de pagamento e permite manter somente um gateway ativo por vez. O Client Secret é criptografado com AES-256-GCM no banco, nunca é retornado pela API e não pode ser visualizado novamente pela interface. Excluir a integração desativa imediatamente os pagamentos Appmax.

Variáveis necessárias:

- `INTEGRATION_ENCRYPTION_KEY`: chave estável usada para criptografar as credenciais salvas na tela de integrações.
- `APPMAX_WEBHOOK_TOKEN`: segredo próprio usado na URL do webhook.

Na tela de integração, informe o ambiente (`sandbox` ou `production`), as credenciais do merchant, o identificador usado pelo Appmax JS (`External ID`), o `App ID` opcional e se a recorrência beta está habilitada na conta.

Configure na Appmax o webhook:

```text
https://SEU_DOMINIO/api/webhooks/appmax?token=SEU_APPMAX_WEBHOOK_TOKEN
```

A Appmax não assina webhooks com HMAC. Por isso o endpoint exige o token secreto na URL, limita o payload, valida o `app_id` quando configurado, registra eventos de forma idempotente e confirma pedidos consultando a API antes de alterar a assinatura.

No sandbox, use o cartão de sucesso `4000000000000010` ou o cartão de falha `4000000000000028`, sempre com uma validade futura. Nunca coloque credenciais de produção em arquivos versionados.

Pix e cartão recebem o objeto de recorrência apenas quando a opção é habilitada na tela de integração. O boleto continua avulso. A data da próxima cobrança local passa a ser um mês após a confirmação do primeiro pagamento; a execução automática dos próximos ciclos fica sob responsabilidade da recorrência da Appmax.

## Asaas

Abra `Administração > Integrações > Asaas` e informe a API key do ambiente e um token secreto de webhook com 32 a 255 caracteres. A chave fica criptografada no banco e o token é armazenado somente como hash.

No painel do Asaas, cadastre o webhook `https://SEU_DOMINIO/api/webhooks/asaas` com o mesmo token no campo de autenticação. O endpoint valida o header `asaas-access-token`, deduplica pelo ID do evento e confirma a cobrança na API antes de liberar a assinatura.

Com o Asaas ativo, o Pix usa o fluxo de **Pix Automático**: o primeiro QR Code recebe o pagamento e o consentimento do aluno; as mensalidades seguintes são debitadas automaticamente na data configurada da assinatura. Configure também os eventos `PIX_AUTOMATIC_RECURRING_AUTHORIZATION_*` e `PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_*`, além dos eventos comuns de cobrança. A conta e a API key precisam ter acesso ao recurso Pix Automático do Asaas.

O checkout gera o QR Code Pix dentro do sistema. Para cartão, o aluno é direcionado à fatura hospedada pelo Asaas; assim, número do cartão e CVV não passam pelo servidor da aplicação.

Comece em `sandbox`, valide Pix, cartão e webhook, e só então troque para `production`. Nunca coloque API keys em arquivos versionados.
