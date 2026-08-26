ALTER TABLE "Payment"
ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'APPMAX',
ADD COLUMN "checkoutUrl" TEXT;

DROP INDEX "Payment_providerOrderId_key";

CREATE UNIQUE INDEX "Payment_provider_providerOrderId_key"
ON "Payment"("provider", "providerOrderId");

ALTER TABLE "PaymentIntegration"
ALTER COLUMN "clientId" DROP NOT NULL,
ALTER COLUMN "clientSecretEncrypted" DROP NOT NULL,
ADD COLUMN "apiKeyEncrypted" TEXT,
ADD COLUMN "webhookTokenHash" TEXT;

ALTER TABLE "User"
ADD COLUMN "asaasCustomerId" TEXT;

CREATE UNIQUE INDEX "User_asaasCustomerId_key"
ON "User"("asaasCustomerId");
