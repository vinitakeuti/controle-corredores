ALTER TABLE "User"
ADD COLUMN "liabilityTermRequiredAt" TIMESTAMP(3);

ALTER TABLE "User"
ADD COLUMN "liabilityTermAcceptedAt" TIMESTAMP(3),
ADD COLUMN "liabilityTermAcceptedName" TEXT,
ADD COLUMN "liabilityTermAcceptedCpf" TEXT,
ADD COLUMN "liabilityTermVersion" TEXT,
ADD COLUMN "liabilityTermDocument" TEXT;
