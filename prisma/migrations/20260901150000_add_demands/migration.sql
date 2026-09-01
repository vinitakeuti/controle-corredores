CREATE TYPE "WorkAreaType" AS ENUM ('GENERAL', 'SECTOR');
CREATE TYPE "DemandColumn" AS ENUM ('OPEN', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY');

CREATE TABLE "WorkArea" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "WorkAreaType" NOT NULL DEFAULT 'SECTOR',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkArea_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkArea_name_key" ON "WorkArea"("name");
CREATE INDEX "WorkArea_type_name_idx" ON "WorkArea"("type", "name");

CREATE TABLE "Demand" (
  "id" TEXT NOT NULL,
  "workAreaId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "column" "DemandColumn" NOT NULL DEFAULT 'OPEN',
  "position" INTEGER NOT NULL DEFAULT 0,
  "scheduledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Demand_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Demand_workAreaId_column_position_idx" ON "Demand"("workAreaId", "column", "position");
CREATE INDEX "Demand_scheduledAt_idx" ON "Demand"("scheduledAt");
ALTER TABLE "Demand" ADD CONSTRAINT "Demand_workAreaId_fkey" FOREIGN KEY ("workAreaId") REFERENCES "WorkArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Demand" ADD CONSTRAINT "Demand_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "DemandAssignment" (
  "id" TEXT NOT NULL,
  "demandId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DemandAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DemandAssignment_demandId_userId_key" ON "DemandAssignment"("demandId", "userId");
CREATE INDEX "DemandAssignment_userId_idx" ON "DemandAssignment"("userId");
ALTER TABLE "DemandAssignment" ADD CONSTRAINT "DemandAssignment_demandId_fkey" FOREIGN KEY ("demandId") REFERENCES "Demand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DemandAssignment" ADD CONSTRAINT "DemandAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
