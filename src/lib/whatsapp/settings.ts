import { randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret } from "@/lib/integration-crypto";
import { prisma } from "@/lib/prisma";
import { hashOpaqueToken } from "@/lib/tokens";
import type { EvolutionConfig } from "@/lib/whatsapp/evolution";

const SETTINGS_ID = "platform";

export type WhatsAppSummary = {
  enabled: boolean;
  baseUrl: string;
  hasApiKey: boolean;
  apiKeyHint: string | null;
  instance: string;
  botNumber: string;
  webhookConfiguredAt: string | null;
  groupTrigger: string;
  leadPrices: boolean;
  pauseHours: number;
  teamNotifyTarget: string;
  updatedAt: string | null;
};

export async function getWhatsAppRecord() {
  return prisma.whatsAppSettings.findUnique({ where: { id: SETTINGS_ID } });
}

export async function getWhatsAppSummary(): Promise<WhatsAppSummary> {
  const record = await getWhatsAppRecord();
  return {
    enabled: record?.enabled ?? false,
    baseUrl: record?.baseUrl ?? "",
    hasApiKey: Boolean(record?.apiKeyEncrypted),
    apiKeyHint: record?.apiKeyHint ?? null,
    instance: record?.instance ?? "",
    botNumber: record?.botNumber ?? "",
    webhookConfiguredAt: record?.webhookConfiguredAt?.toISOString() ?? null,
    groupTrigger: record?.groupTrigger ?? "assistente",
    leadPrices: record?.leadPrices ?? true,
    pauseHours: record?.pauseHours ?? 12,
    teamNotifyTarget: record?.teamNotifyTarget ?? "",
    updatedAt: record?.updatedAt.toISOString() ?? null,
  };
}

export function evolutionConfigFrom(record: Awaited<ReturnType<typeof getWhatsAppRecord>>): EvolutionConfig | null {
  if (!record?.baseUrl || !record.apiKeyEncrypted || !record.instance) return null;
  try {
    return { baseUrl: record.baseUrl, apiKey: decryptSecret(record.apiKeyEncrypted), instance: record.instance };
  } catch (error) {
    console.error("Evolution key decryption failed", error);
    return null;
  }
}

export async function getEvolutionConfig() {
  return evolutionConfigFrom(await getWhatsAppRecord());
}

export type WhatsAppInput = Partial<{ enabled: boolean; baseUrl: string | null; apiKey: string | null; instance: string | null; botNumber: string | null; groupTrigger: string; leadPrices: boolean; teamNotifyTarget: string | null }>;

export async function saveWhatsAppSettings(input: WhatsAppInput, updatedById: string) {
  const data: Record<string, unknown> = { updatedById };
  if (input.baseUrl !== undefined) data.baseUrl = input.baseUrl;
  if (input.apiKey !== undefined) {
    data.apiKeyEncrypted = input.apiKey ? encryptSecret(input.apiKey) : null;
    data.apiKeyHint = input.apiKey ? input.apiKey.slice(-4) : null;
    if (!input.apiKey) data.enabled = false;
  }
  if (input.instance !== undefined) data.instance = input.instance;
  if (input.botNumber !== undefined) { data.botNumber = input.botNumber; data.botLid = null; }
  if (input.groupTrigger !== undefined) data.groupTrigger = input.groupTrigger;
  if (input.leadPrices !== undefined) data.leadPrices = input.leadPrices;
  if (input.teamNotifyTarget !== undefined) data.teamNotifyTarget = input.teamNotifyTarget;
  if (input.enabled !== undefined) data.enabled = input.enabled;
  return prisma.whatsAppSettings.upsert({ where: { id: SETTINGS_ID }, update: data, create: { id: SETTINGS_ID, ...data } });
}

// O token vai no caminho do webhook. No banco fica só o hash.
export async function rotateWebhookToken() {
  const token = randomBytes(24).toString("base64url");
  await prisma.whatsAppSettings.upsert({ where: { id: SETTINGS_ID }, update: { webhookTokenHash: hashOpaqueToken(token), webhookConfiguredAt: new Date() }, create: { id: SETTINGS_ID, webhookTokenHash: hashOpaqueToken(token), webhookConfiguredAt: new Date() } });
  return token;
}
