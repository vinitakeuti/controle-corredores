ALTER TABLE "User"
ADD COLUMN "liabilityTermStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN "liabilityTermSignedPdf" BYTEA,
ADD COLUMN "liabilityTermFileName" TEXT,
ADD COLUMN "liabilityTermSubmittedAt" TIMESTAMP(3),
ADD COLUMN "liabilityTermReviewedAt" TIMESTAMP(3),
ADD COLUMN "liabilityTermReviewedById" TEXT,
ADD COLUMN "liabilityTermReviewNote" TEXT;

UPDATE "User"
SET "liabilityTermStatus" = 'APPROVED'
WHERE "liabilityTermAcceptedAt" IS NOT NULL;
