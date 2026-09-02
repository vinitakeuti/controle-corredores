ALTER TABLE "Demand"
  ADD COLUMN "requestKey" TEXT,
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "folderId" TEXT;

CREATE UNIQUE INDEX "Demand_requestKey_key" ON "Demand"("requestKey");
CREATE INDEX "Demand_workAreaId_archivedAt_idx" ON "Demand"("workAreaId", "archivedAt");
CREATE INDEX "Demand_folderId_idx" ON "Demand"("folderId");

CREATE TABLE "DemandFolder" (
  "id" TEXT NOT NULL,
  "workAreaId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DemandFolder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DemandFolder_workAreaId_name_key" ON "DemandFolder"("workAreaId", "name");
CREATE INDEX "DemandFolder_workAreaId_name_idx" ON "DemandFolder"("workAreaId", "name");

ALTER TABLE "DemandFolder" ADD CONSTRAINT "DemandFolder_workAreaId_fkey"
  FOREIGN KEY ("workAreaId") REFERENCES "WorkArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Demand" ADD CONSTRAINT "Demand_folderId_fkey"
  FOREIGN KEY ("folderId") REFERENCES "DemandFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
