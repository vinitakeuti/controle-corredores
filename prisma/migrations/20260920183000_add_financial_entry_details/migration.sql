ALTER TABLE "FinancialEntry" ADD COLUMN "title" TEXT NOT NULL DEFAULT 'Lançamento sem título';
ALTER TABLE "FinancialEntry" ADD COLUMN "category" TEXT;
ALTER TABLE "FinancialEntry" ADD COLUMN "isFixed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FinancialEntry" ALTER COLUMN "description" DROP NOT NULL;
ALTER TABLE "FinancialEntry" ALTER COLUMN "title" DROP DEFAULT;
