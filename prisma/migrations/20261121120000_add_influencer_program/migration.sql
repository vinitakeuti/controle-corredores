-- CreateEnum
CREATE TYPE "InfluencerType" AS ENUM ('EXPERT', 'CREATOR');

-- CreateEnum
CREATE TYPE "InfluencerSaleSource" AS ENUM ('PLAN', 'STORE');

-- CreateEnum
CREATE TYPE "InfluencerSaleStatus" AS ENUM ('CONFIRMED', 'CANCELED');

-- CreateEnum
CREATE TYPE "InfluencerPayoutStatus" AS ENUM ('APPROVED', 'PAID');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'PARTNER';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "referredAt" TIMESTAMP(3),
ADD COLUMN     "referredByInfluencerId" TEXT;

-- CreateTable
CREATE TABLE "Influencer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "InfluencerType" NOT NULL,
    "couponCode" TEXT NOT NULL,
    "commissionBps" INTEGER NOT NULL,
    "discountPercent" INTEGER NOT NULL DEFAULT 0,
    "discountUntil" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "pixKeyType" TEXT,
    "pixKeyEncrypted" TEXT,
    "pixKeyHint" TEXT,
    "pixKeyUpdatedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Influencer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InfluencerSale" (
    "id" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "source" "InfluencerSaleSource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "customerName" TEXT,
    "studentId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "commissionBps" INTEGER NOT NULL,
    "commissionCents" INTEGER NOT NULL,
    "status" "InfluencerSaleStatus" NOT NULL DEFAULT 'CONFIRMED',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InfluencerSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InfluencerPayout" (
    "id" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "status" "InfluencerPayoutStatus" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "salesCount" INTEGER NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL,
    "approvedById" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InfluencerPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingSettings" (
    "id" TEXT NOT NULL DEFAULT 'platform',
    "showCommission" BOOLEAN NOT NULL DEFAULT false,
    "storeSyncedAt" TIMESTAMP(3),
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Influencer_userId_key" ON "Influencer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Influencer_couponCode_key" ON "Influencer"("couponCode");

-- CreateIndex
CREATE INDEX "Influencer_active_type_idx" ON "Influencer"("active", "type");

-- CreateIndex
CREATE INDEX "InfluencerSale_influencerId_occurredAt_idx" ON "InfluencerSale"("influencerId", "occurredAt");

-- CreateIndex
CREATE INDEX "InfluencerSale_occurredAt_idx" ON "InfluencerSale"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "InfluencerSale_source_externalId_key" ON "InfluencerSale"("source", "externalId");

-- CreateIndex
CREATE INDEX "InfluencerPayout_month_idx" ON "InfluencerPayout"("month");

-- CreateIndex
CREATE UNIQUE INDEX "InfluencerPayout_influencerId_month_key" ON "InfluencerPayout"("influencerId", "month");

-- CreateIndex
CREATE INDEX "User_referredByInfluencerId_idx" ON "User"("referredByInfluencerId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_referredByInfluencerId_fkey" FOREIGN KEY ("referredByInfluencerId") REFERENCES "Influencer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Influencer" ADD CONSTRAINT "Influencer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfluencerSale" ADD CONSTRAINT "InfluencerSale_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "Influencer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfluencerPayout" ADD CONSTRAINT "InfluencerPayout_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "Influencer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

