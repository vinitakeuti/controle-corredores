-- AlterTable
ALTER TABLE "WhatsAppSettings" ADD COLUMN     "internalGroups" TEXT[] DEFAULT ARRAY[]::TEXT[];

