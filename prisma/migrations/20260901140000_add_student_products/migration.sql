-- Um aluno pode manter mais de um produto ativo ao mesmo tempo.
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_userId_key";

CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- Uma cobrança inicial pode quitar mais de um produto do aluno.
CREATE TABLE "PaymentSubscription" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,

    CONSTRAINT "PaymentSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentSubscription_paymentId_subscriptionId_key"
ON "PaymentSubscription"("paymentId", "subscriptionId");

CREATE INDEX "PaymentSubscription_subscriptionId_idx"
ON "PaymentSubscription"("subscriptionId");

ALTER TABLE "PaymentSubscription"
ADD CONSTRAINT "PaymentSubscription_paymentId_fkey"
FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentSubscription"
ADD CONSTRAINT "PaymentSubscription_subscriptionId_fkey"
FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
