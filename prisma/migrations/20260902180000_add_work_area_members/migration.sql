CREATE TABLE "WorkAreaMember" (
    "id" TEXT NOT NULL,
    "workAreaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkAreaMember_pkey" PRIMARY KEY ("id")
);

-- Áreas existentes permanecem acessíveis aos colaboradores já ativos.
INSERT INTO "WorkAreaMember" ("id", "workAreaId", "userId")
SELECT md5("WorkArea"."id" || ':' || "User"."id"), "WorkArea"."id", "User"."id"
FROM "WorkArea" CROSS JOIN "User"
WHERE "User"."active" = true AND "User"."role" IN ('ADMIN', 'OPERATOR');

CREATE UNIQUE INDEX "WorkAreaMember_workAreaId_userId_key" ON "WorkAreaMember"("workAreaId", "userId");
CREATE INDEX "WorkAreaMember_userId_idx" ON "WorkAreaMember"("userId");
ALTER TABLE "WorkAreaMember" ADD CONSTRAINT "WorkAreaMember_workAreaId_fkey" FOREIGN KEY ("workAreaId") REFERENCES "WorkArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkAreaMember" ADD CONSTRAINT "WorkAreaMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
