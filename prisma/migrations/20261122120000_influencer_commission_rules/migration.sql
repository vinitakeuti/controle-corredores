-- AlterTable
ALTER TABLE "Influencer" ADD COLUMN     "planCommission" BOOLEAN,
ADD COLUMN     "storeCommission" BOOLEAN,
ALTER COLUMN "commissionBps" DROP NOT NULL;

-- AlterTable
ALTER TABLE "MarketingSettings" ADD COLUMN     "defaultCommissionBps" INTEGER NOT NULL DEFAULT 1000,
ADD COLUMN     "planCommissionEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "storeCommissionEnabled" BOOLEAN NOT NULL DEFAULT true;

