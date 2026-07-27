-- CreateEnum
CREATE TYPE "PaymentLinkStatus" AS ENUM ('OPEN', 'COMPLETED', 'REVOKED');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "birthDate" TIMESTAMP(3),
ADD COLUMN "cpf" TEXT,
ADD COLUMN "passwordIsTemporary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "phone" TEXT;

-- AlterTable
ALTER TABLE "Payment"
ADD COLUMN "paymentLinkId" TEXT;

-- CreateTable
CREATE TABLE "PaymentLink" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT,
    "createdById" TEXT NOT NULL,
    "status" "PaymentLinkStatus" NOT NULL DEFAULT 'OPEN',
    "planName" TEXT NOT NULL DEFAULT 'Treinamento mensal',
    "amountCents" INTEGER NOT NULL DEFAULT 15000,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_cpf_key" ON "User"("cpf");
CREATE INDEX "Payment_paymentLinkId_idx" ON "Payment"("paymentLinkId");
CREATE UNIQUE INDEX "PaymentLink_tokenHash_key" ON "PaymentLink"("tokenHash");
CREATE INDEX "PaymentLink_userId_status_idx" ON "PaymentLink"("userId", "status");
CREATE INDEX "PaymentLink_createdById_createdAt_idx" ON "PaymentLink"("createdById", "createdAt");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paymentLinkId_fkey" FOREIGN KEY ("paymentLinkId") REFERENCES "PaymentLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentLink" ADD CONSTRAINT "PaymentLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentLink" ADD CONSTRAINT "PaymentLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
