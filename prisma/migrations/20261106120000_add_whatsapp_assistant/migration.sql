-- AlterTable
ALTER TABLE "User" ADD COLUMN     "assistantWhatsapp" TEXT;

-- AlterTable
ALTER TABLE "AiSettings" ADD COLUMN     "assistantName" TEXT,
ADD COLUMN     "leadInstructions" TEXT,
ADD COLUMN     "staffInstructions" TEXT,
ADD COLUMN     "studentInstructions" TEXT;

-- AlterTable
ALTER TABLE "AiConversation" ADD COLUMN     "aiPausedUntil" TIMESTAMP(3),
ADD COLUMN     "isGroup" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "needsHuman" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "needsHumanReason" TEXT;

-- AlterTable
ALTER TABLE "AiMessage" ADD COLUMN     "authorName" TEXT,
ADD COLUMN     "authorPhone" TEXT,
ADD COLUMN     "externalId" TEXT;

-- CreateTable
CREATE TABLE "WhatsAppSettings" (
    "id" TEXT NOT NULL DEFAULT 'platform',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "baseUrl" TEXT,
    "apiKeyEncrypted" TEXT,
    "apiKeyHint" TEXT,
    "instance" TEXT,
    "botNumber" TEXT,
    "botLid" TEXT,
    "webhookTokenHash" TEXT,
    "webhookConfiguredAt" TIMESTAMP(3),
    "groupTrigger" TEXT NOT NULL DEFAULT 'assistente',
    "leadPrices" BOOLEAN NOT NULL DEFAULT true,
    "pauseHours" INTEGER NOT NULL DEFAULT 12,
    "teamNotifyTarget" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_assistantWhatsapp_key" ON "User"("assistantWhatsapp");

-- CreateIndex
CREATE INDEX "AiConversation_channel_needsHuman_idx" ON "AiConversation"("channel", "needsHuman");

-- CreateIndex
CREATE UNIQUE INDEX "AiMessage_externalId_key" ON "AiMessage"("externalId");

