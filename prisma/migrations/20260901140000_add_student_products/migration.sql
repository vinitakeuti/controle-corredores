-- Um aluno pode manter mais de um produto ativo ao mesmo tempo.
-- A versão inicial podia existir como constraint ou apenas como unique index.
-- As guardas tornam esta migration segura após uma tentativa interrompida.
ALTER TABLE "Subscription" DROP CONSTRAINT IF EXISTS "Subscription_userId_key";
DROP INDEX IF EXISTS "Subscription_userId_key";

CREATE INDEX IF NOT EXISTS "Subscription_userId_idx" ON "Subscription"("userId");

-- Uma cobrança inicial pode quitar mais de um produto do aluno.
CREATE TABLE IF NOT EXISTS "PaymentSubscription" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,

    CONSTRAINT "PaymentSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentSubscription_paymentId_subscriptionId_key"
ON "PaymentSubscription"("paymentId", "subscriptionId");

CREATE INDEX IF NOT EXISTS "PaymentSubscription_subscriptionId_idx"
ON "PaymentSubscription"("subscriptionId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentSubscription_paymentId_fkey') THEN
    ALTER TABLE "PaymentSubscription"
    ADD CONSTRAINT "PaymentSubscription_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentSubscription_subscriptionId_fkey') THEN
    ALTER TABLE "PaymentSubscription"
    ADD CONSTRAINT "PaymentSubscription_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
