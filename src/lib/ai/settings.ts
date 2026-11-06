import { cache } from "react";
import { Prisma } from "@prisma/client";
import { decryptSecret, encryptSecret } from "@/lib/integration-crypto";
import { maceioDateParts, maceioDayStart } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { ChatUsage, ModelPricing, OpenRouterModel } from "@/lib/ai/openrouter";

const SETTINGS_ID = "platform";

export type AiSettingsSummary = {
  enabled: boolean;
  assistantName: string;
  leadInstructions: string;
  studentInstructions: string;
  staffInstructions: string;
  hasApiKey: boolean;
  apiKeyHint: string | null;
  model: string | null;
  modelName: string | null;
  modelPricing: ModelPricing | null;
  modelSupportsTools: boolean;
  generalInstructions: string;
  businessInfo: string;
  monthlyBudgetUsd: number | null;
  updatedAt: string | null;
};

export async function getAiSettingsRecord() {
  return prisma.aiSettings.findUnique({ where: { id: SETTINGS_ID } });
}

function pricingFrom(value: Prisma.JsonValue | null | undefined): ModelPricing | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const read = (key: string) => (typeof source[key] === "number" ? (source[key] as number) : null);
  return { prompt: read("prompt") ?? 0, completion: read("completion") ?? 0, inputCacheRead: read("inputCacheRead"), inputCacheWrite: read("inputCacheWrite"), request: read("request") ?? 0 };
}

export async function getAiSettingsSummary(): Promise<AiSettingsSummary> {
  const record = await getAiSettingsRecord();
  return {
    enabled: record?.enabled ?? false,
    assistantName: record?.assistantName ?? "",
    leadInstructions: record?.leadInstructions ?? "",
    studentInstructions: record?.studentInstructions ?? "",
    staffInstructions: record?.staffInstructions ?? "",
    hasApiKey: Boolean(record?.apiKeyEncrypted),
    apiKeyHint: record?.apiKeyHint ?? null,
    model: record?.model ?? null,
    modelName: record?.modelName ?? null,
    modelPricing: pricingFrom(record?.modelPricing),
    modelSupportsTools: record?.modelSupportsTools ?? true,
    generalInstructions: record?.generalInstructions ?? "",
    businessInfo: record?.businessInfo ?? "",
    monthlyBudgetUsd: record?.monthlyBudgetMicros != null ? record.monthlyBudgetMicros / 1_000_000 : null,
    updatedAt: record?.updatedAt.toISOString() ?? null,
  };
}

export async function getAiApiKey() {
  const record = await getAiSettingsRecord();
  if (!record?.apiKeyEncrypted) return null;
  try {
    return decryptSecret(record.apiKeyEncrypted);
  } catch (error) {
    console.error("AI key decryption failed", error);
    return null;
  }
}

// Só os campos enviados mudam. A chave nunca volta para o navegador, só os 4 últimos caracteres.
export async function saveAiSettings(input: {
  apiKey?: string | null;
  model?: OpenRouterModel | null;
  enabled?: boolean;
  generalInstructions?: string;
  businessInfo?: string;
  monthlyBudgetUsd?: number | null;
  assistantName?: string;
  leadInstructions?: string;
  studentInstructions?: string;
  staffInstructions?: string;
}, updatedById: string) {
  const data: Prisma.AiSettingsUncheckedUpdateInput = { updatedById };
  if (input.apiKey !== undefined) {
    data.apiKeyEncrypted = input.apiKey ? encryptSecret(input.apiKey) : null;
    data.apiKeyHint = input.apiKey ? input.apiKey.slice(-4) : null;
    if (!input.apiKey) data.enabled = false;
  }
  if (input.model !== undefined) {
    data.model = input.model?.id ?? null;
    data.modelName = input.model?.name ?? null;
    data.modelPricing = input.model ? (input.model.pricing as unknown as Prisma.InputJsonValue) : Prisma.DbNull;
    data.modelSupportsTools = input.model?.supportsTools ?? true;
  }
  if (input.enabled !== undefined) data.enabled = input.enabled;
  if (input.generalInstructions !== undefined) data.generalInstructions = input.generalInstructions.slice(0, 8000) || null;
  if (input.businessInfo !== undefined) data.businessInfo = input.businessInfo.slice(0, 12000) || null;
  if (input.assistantName !== undefined) data.assistantName = input.assistantName || null;
  if (input.leadInstructions !== undefined) data.leadInstructions = input.leadInstructions.slice(0, 8000) || null;
  if (input.studentInstructions !== undefined) data.studentInstructions = input.studentInstructions.slice(0, 8000) || null;
  if (input.staffInstructions !== undefined) data.staffInstructions = input.staffInstructions.slice(0, 8000) || null;
  if (input.monthlyBudgetUsd !== undefined) data.monthlyBudgetMicros = input.monthlyBudgetUsd == null ? null : Math.round(input.monthlyBudgetUsd * 1_000_000);

  return prisma.aiSettings.upsert({
    where: { id: SETTINGS_ID },
    update: data,
    create: { id: SETTINGS_ID, ...(data as Prisma.AiSettingsUncheckedCreateInput) },
  });
}

// Custo em micro-dólares (1 US$ = 1.000.000). Usa o custo informado pelo OpenRouter;
// sem ele, calcula pela tabela de preços do modelo salva nas configurações.
export function costMicrosFor(usage: ChatUsage, pricing: ModelPricing | null) {
  if (usage.costUsd != null) return Math.max(0, Math.round(usage.costUsd * 1_000_000));
  if (!pricing) return 0;
  const uncached = Math.max(0, usage.inputTokens - usage.cachedTokens - usage.cacheWriteTokens);
  const cost = uncached * pricing.prompt
    + usage.cachedTokens * (pricing.inputCacheRead ?? pricing.prompt)
    + usage.cacheWriteTokens * (pricing.inputCacheWrite ?? pricing.prompt)
    + usage.outputTokens * pricing.completion
    + pricing.request;
  return Math.max(0, Math.round(cost * 1_000_000));
}

export function maceioMonthStart(date = new Date()) {
  const { year, month } = maceioDateParts(date);
  return maceioDayStart(year, month, 1);
}

export async function monthCostMicros(date = new Date()) {
  const result = await prisma.aiMessage.aggregate({ where: { createdAt: { gte: maceioMonthStart(date) } }, _sum: { costMicros: true } });
  return result._sum.costMicros ?? 0;
}

export function formatUsd(micros: number) {
  const value = micros / 1_000_000;
  const digits = value > 0 && value < 1 ? 4 : 2;
  return `US$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

// Nome que aparece no menu e com que a IA se apresenta. Uma consulta por requisição.
export const getAssistantName = cache(async () => {
  const record = await prisma.aiSettings.findUnique({ where: { id: SETTINGS_ID }, select: { assistantName: true } });
  return record?.assistantName?.trim() || null;
});
