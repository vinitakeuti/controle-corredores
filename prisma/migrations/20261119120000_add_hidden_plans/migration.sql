-- Planos ocultos e cortesia. A regra "um plano por categoria e período" passa
-- a valer só para planos públicos e é garantida pela API.
DROP INDEX "Plan_serviceId_period_key";

ALTER TABLE "Plan" ADD COLUMN     "isCourtesy" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isHidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "name" TEXT;

CREATE INDEX "Plan_serviceId_period_idx" ON "Plan"("serviceId", "period");
