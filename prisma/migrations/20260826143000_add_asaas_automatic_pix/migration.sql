ALTER TABLE "Subscription"
ADD COLUMN "asaasPixAuthorizationId" TEXT,
ADD COLUMN "asaasPixAuthorizationStatus" TEXT;

CREATE UNIQUE INDEX "Subscription_asaasPixAuthorizationId_key"
ON "Subscription"("asaasPixAuthorizationId");
