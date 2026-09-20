CREATE TYPE "FinancialEntryType" AS ENUM ('REVENUE', 'EXPENSE');

CREATE TABLE "FinancialEntry" (
  "id" TEXT NOT NULL,
  "type" "FinancialEntryType" NOT NULL,
  "description" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FinancialEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinancialEntry_occurredAt_type_idx" ON "FinancialEntry"("occurredAt", "type");
CREATE INDEX "FinancialEntry_createdById_idx" ON "FinancialEntry"("createdById");

ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
