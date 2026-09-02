-- Colunas de demandas passam a pertencer a cada área de trabalho.
CREATE TABLE "WorkAreaColumn" (
    "id" TEXT NOT NULL,
    "workAreaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkAreaColumn_pkey" PRIMARY KEY ("id")
);

INSERT INTO "WorkAreaColumn" ("id", "workAreaId", "name", "position", "updatedAt")
SELECT md5("WorkArea"."id" || ':open'), "WorkArea"."id", 'Em aberto', 0, CURRENT_TIMESTAMP FROM "WorkArea"
UNION ALL SELECT md5("WorkArea"."id" || ':monday'), "WorkArea"."id", 'Segunda', 1, CURRENT_TIMESTAMP FROM "WorkArea"
UNION ALL SELECT md5("WorkArea"."id" || ':tuesday'), "WorkArea"."id", 'Terça', 2, CURRENT_TIMESTAMP FROM "WorkArea"
UNION ALL SELECT md5("WorkArea"."id" || ':wednesday'), "WorkArea"."id", 'Quarta', 3, CURRENT_TIMESTAMP FROM "WorkArea"
UNION ALL SELECT md5("WorkArea"."id" || ':thursday'), "WorkArea"."id", 'Quinta', 4, CURRENT_TIMESTAMP FROM "WorkArea"
UNION ALL SELECT md5("WorkArea"."id" || ':friday'), "WorkArea"."id", 'Sexta', 5, CURRENT_TIMESTAMP FROM "WorkArea";

ALTER TABLE "Demand" ADD COLUMN "columnId" TEXT;

UPDATE "Demand" SET "columnId" = md5("workAreaId" || CASE "column"
  WHEN 'OPEN'::"DemandColumn" THEN ':open'
  WHEN 'MONDAY'::"DemandColumn" THEN ':monday'
  WHEN 'TUESDAY'::"DemandColumn" THEN ':tuesday'
  WHEN 'WEDNESDAY'::"DemandColumn" THEN ':wednesday'
  WHEN 'THURSDAY'::"DemandColumn" THEN ':thursday'
  WHEN 'FRIDAY'::"DemandColumn" THEN ':friday'
END);

ALTER TABLE "Demand" ALTER COLUMN "columnId" SET NOT NULL;
ALTER TABLE "Demand" ADD CONSTRAINT "Demand_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "WorkAreaColumn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
DROP INDEX "Demand_workAreaId_column_position_idx";
CREATE INDEX "Demand_workAreaId_columnId_position_idx" ON "Demand"("workAreaId", "columnId", "position");
ALTER TABLE "Demand" DROP COLUMN "column";
DROP TYPE "DemandColumn";

CREATE UNIQUE INDEX "WorkAreaColumn_workAreaId_name_key" ON "WorkAreaColumn"("workAreaId", "name");
CREATE INDEX "WorkAreaColumn_workAreaId_position_idx" ON "WorkAreaColumn"("workAreaId", "position");
ALTER TABLE "WorkAreaColumn" ADD CONSTRAINT "WorkAreaColumn_workAreaId_fkey" FOREIGN KEY ("workAreaId") REFERENCES "WorkArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Responsável comercial de cada aluno para os relatórios de vendas.
ALTER TABLE "User" ADD COLUMN "saleOwnerId" TEXT;
CREATE INDEX "User_saleOwnerId_idx" ON "User"("saleOwnerId");
ALTER TABLE "User" ADD CONSTRAINT "User_saleOwnerId_fkey" FOREIGN KEY ("saleOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
