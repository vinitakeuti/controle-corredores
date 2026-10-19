CREATE TYPE "EmailLogStatus" AS ENUM ('SENT', 'FAILED');

CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "status" "EmailLogStatus" NOT NULL,
    "error" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");
CREATE INDEX "EmailLog_status_createdAt_idx" ON "EmailLog"("status", "createdAt");
CREATE INDEX "EmailLog_type_createdAt_idx" ON "EmailLog"("type", "createdAt");

-- Histórico anterior ao log detalhado: e-mails de pagamento rastreados por
-- EmailDelivery e lembretes de vencimento registrados em RenewalReminder.
INSERT INTO "EmailLog" ("id", "type", "subject", "recipient", "status", "detail", "createdAt")
SELECT
    'legacy_' || "id",
    "type",
    CASE "type" WHEN 'PAYMENT_PAID' THEN 'Pagamento confirmado · Pace Lab' ELSE 'Não foi possível concluir seu pagamento · Pace Lab' END,
    "recipient",
    'SENT',
    'Importado do histórico anterior ao log detalhado.',
    "sentAt"
FROM "EmailDelivery"
WHERE "sentAt" IS NOT NULL;

INSERT INTO "EmailLog" ("id", "type", "subject", "recipient", "status", "error", "detail", "createdAt")
SELECT
    'legacy_' || "id",
    "type",
    CASE "type" WHEN 'PAYMENT_PAID' THEN 'Pagamento confirmado · Pace Lab' ELSE 'Não foi possível concluir seu pagamento · Pace Lab' END,
    "recipient",
    'FAILED',
    'Falha registrada antes do log detalhado.',
    LEFT("lastError", 500),
    "updatedAt"
FROM "EmailDelivery"
WHERE "sentAt" IS NULL AND "lastError" IS NOT NULL;

INSERT INTO "EmailLog" ("id", "type", "subject", "recipient", "status", "detail", "createdAt")
SELECT
    'legacy_' || r."id",
    'DUE_TOMORROW',
    'Sua mensalidade vence amanhã · Pace Lab',
    u."email",
    'SENT',
    'Importado do histórico anterior ao log detalhado.',
    r."sentAt"
FROM "RenewalReminder" r
JOIN "User" u ON u."id" = r."userId"
WHERE r."sentAt" IS NOT NULL;
