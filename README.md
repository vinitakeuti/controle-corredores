# Pabula — Controle de assinaturas

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

O `Dockerfile` usa o modo standalone do Next.js. O comando de inicialização executa `prisma migrate deploy` antes de iniciar o servidor, aplicando automaticamente as migrations presentes em `prisma/migrations` quando o container sobe conectado ao Postgres.

Configure no serviço as variáveis `DATABASE_URL` e `SESSION_SECRET`. Não é necessário publicar a porta do Postgres; o serviço web precisa apenas alcançar o banco pela rede configurada no EasyPanel.

O gateway e o provedor de e-mail ainda estão representados por pontos de integração. A geração de PIX nesta base cria um pedido local com status pendente e está pronta para receber a chamada real do gateway.
