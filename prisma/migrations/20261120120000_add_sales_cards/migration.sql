-- AlterTable
ALTER TABLE "User" ADD COLUMN     "salesCardId" TEXT;

-- CreateTable
CREATE TABLE "SalesCard" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PlanToSalesCard" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PlanToSalesCard_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesCard_code_key" ON "SalesCard"("code");

-- CreateIndex
CREATE INDEX "SalesCard_expiresAt_idx" ON "SalesCard"("expiresAt");

-- CreateIndex
CREATE INDEX "SalesCard_createdById_createdAt_idx" ON "SalesCard"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "_PlanToSalesCard_B_index" ON "_PlanToSalesCard"("B");

-- CreateIndex
CREATE INDEX "User_salesCardId_idx" ON "User"("salesCardId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_salesCardId_fkey" FOREIGN KEY ("salesCardId") REFERENCES "SalesCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesCard" ADD CONSTRAINT "SalesCard_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PlanToSalesCard" ADD CONSTRAINT "_PlanToSalesCard_A_fkey" FOREIGN KEY ("A") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PlanToSalesCard" ADD CONSTRAINT "_PlanToSalesCard_B_fkey" FOREIGN KEY ("B") REFERENCES "SalesCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

