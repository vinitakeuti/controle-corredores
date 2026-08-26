ALTER TABLE "Subscription"
ADD COLUMN "allowedMethods" "PaymentMethod"[] NOT NULL DEFAULT ARRAY['PIX', 'CARD', 'BOLETO']::"PaymentMethod"[];

ALTER TABLE "PaymentLink"
ADD COLUMN "allowedMethods" "PaymentMethod"[] NOT NULL DEFAULT ARRAY['PIX', 'CARD', 'BOLETO']::"PaymentMethod"[];

CREATE TABLE "BillingSettings" (
    "id" TEXT NOT NULL DEFAULT 'platform',
    "basePriceCents" INTEGER NOT NULL DEFAULT 15000,
    "defaultAllowedMethods" "PaymentMethod"[] NOT NULL DEFAULT ARRAY['PIX', 'CARD', 'BOLETO']::"PaymentMethod"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingSettings_pkey" PRIMARY KEY ("id")
);
