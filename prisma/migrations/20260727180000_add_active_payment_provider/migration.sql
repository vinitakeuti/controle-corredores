ALTER TABLE "PaymentIntegration"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT false;

UPDATE "PaymentIntegration"
SET "isActive" = true
WHERE "provider" = 'APPMAX'
  AND NOT EXISTS (SELECT 1 FROM "PaymentIntegration" WHERE "isActive" = true);

CREATE UNIQUE INDEX "PaymentIntegration_only_one_active_key"
ON "PaymentIntegration" ("isActive")
WHERE "isActive" = true;
