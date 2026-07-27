CREATE TABLE "PaymentIntegration" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'APPMAX',
    "environment" TEXT NOT NULL DEFAULT 'sandbox',
    "clientId" TEXT NOT NULL,
    "clientSecretEncrypted" TEXT NOT NULL,
    "externalId" TEXT,
    "appId" TEXT,
    "softDescriptor" TEXT NOT NULL DEFAULT 'PABULA',
    "recurrenceEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentIntegration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentIntegration_provider_key" ON "PaymentIntegration"("provider");
CREATE INDEX "PaymentIntegration_updatedAt_idx" ON "PaymentIntegration"("updatedAt");
