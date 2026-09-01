ALTER TABLE "Plan"
ADD COLUMN "allowedMethods" "PaymentMethod"[] NOT NULL DEFAULT ARRAY['PIX', 'CARD', 'BOLETO']::"PaymentMethod"[];

ALTER TABLE "Plan"
ADD COLUMN "automaticPixEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Subscription"
ADD COLUMN "billingPeriod" "PlanPeriod" NOT NULL DEFAULT 'MONTHLY';

ALTER TABLE "Subscription"
ADD COLUMN "automaticPixEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Payment"
ADD COLUMN "installmentCount" INTEGER NOT NULL DEFAULT 1;
