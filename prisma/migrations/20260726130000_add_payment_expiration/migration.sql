ALTER TABLE "Payment" ADD COLUMN "expiresAt" TIMESTAMP(3);
CREATE INDEX "Payment_expiresAt_idx" ON "Payment"("expiresAt");
