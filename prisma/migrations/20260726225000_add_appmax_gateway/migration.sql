-- Extend payment methods and statuses for the Appmax integration.
ALTER TYPE "PaymentStatus" ADD VALUE 'EXPIRED';
ALTER TYPE "PaymentMethod" ADD VALUE 'BOLETO';

CREATE TYPE "GatewayEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');

ALTER TABLE "Subscription"
ADD COLUMN "recurringEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "recurringMethod" "PaymentMethod";

ALTER TABLE "Payment"
ADD COLUMN "requestKey" TEXT,
ADD COLUMN "recurringRequested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "providerOrderId" TEXT,
ADD COLUMN "providerStatus" TEXT,
ADD COLUMN "pixQrCode" TEXT,
ADD COLUMN "boletoUrl" TEXT,
ADD COLUMN "boletoDigitableLine" TEXT,
ADD COLUMN "lastError" TEXT;

CREATE UNIQUE INDEX "Payment_requestKey_key" ON "Payment"("requestKey");
CREATE UNIQUE INDEX "Payment_providerOrderId_key" ON "Payment"("providerOrderId");

CREATE TABLE "GatewayEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'APPMAX',
    "eventKey" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "providerOrderId" TEXT,
    "providerSubscriptionId" TEXT,
    "providerCustomerId" TEXT,
    "amountCents" INTEGER,
    "occurredAt" TIMESTAMP(3),
    "status" "GatewayEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "error" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    CONSTRAINT "GatewayEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GatewayEvent_eventKey_key" ON "GatewayEvent"("eventKey");
CREATE INDEX "GatewayEvent_provider_status_receivedAt_idx" ON "GatewayEvent"("provider", "status", "receivedAt");
CREATE INDEX "GatewayEvent_providerOrderId_idx" ON "GatewayEvent"("providerOrderId");
CREATE INDEX "GatewayEvent_providerSubscriptionId_idx" ON "GatewayEvent"("providerSubscriptionId");
