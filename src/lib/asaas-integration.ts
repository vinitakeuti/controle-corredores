import { decryptSecret } from "@/lib/integration-crypto";
import { prisma } from "@/lib/prisma";

export type AsaasEnvironment = "sandbox" | "production";

export type StoredAsaasIntegration = {
  id: string;
  isActive: boolean;
  environment: AsaasEnvironment;
  apiKey: string;
};

export type AsaasIntegrationSummary = {
  configured: boolean;
  active: boolean;
  integration: {
    id: string;
    provider: "ASAAS";
    environment: AsaasEnvironment;
    apiKeyMasked: string;
    webhookTokenConfigured: boolean;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export function normalizeAsaasEnvironment(value: unknown): AsaasEnvironment | null {
  if (value === "sandbox" || value === "production") return value;
  return null;
}

function maskApiKey(value: string) {
  const normalized = value.trim();
  return `••••${normalized.slice(-4)}`;
}

export async function getStoredAsaasIntegration(): Promise<StoredAsaasIntegration | null> {
  const record = await prisma.paymentIntegration.findUnique({ where: { provider: "ASAAS" } });
  if (!record?.apiKeyEncrypted || !record.webhookTokenHash) return null;

  const environment = normalizeAsaasEnvironment(record.environment);
  if (!environment) throw new Error("Ambiente da integração Asaas inválido.");

  return {
    id: record.id,
    isActive: record.isActive,
    environment,
    apiKey: decryptSecret(record.apiKeyEncrypted),
  };
}

export async function getAsaasIntegrationSummary(): Promise<AsaasIntegrationSummary> {
  const record = await prisma.paymentIntegration.findUnique({ where: { provider: "ASAAS" } });
  if (!record?.apiKeyEncrypted || !record.webhookTokenHash) {
    return { configured: false, active: record?.isActive ?? false, integration: null };
  }

  const environment = normalizeAsaasEnvironment(record.environment);
  if (!environment) return { configured: false, active: record.isActive, integration: null };

  const apiKey = decryptSecret(record.apiKeyEncrypted);
  return {
    configured: true,
    active: record.isActive,
    integration: {
      id: record.id,
      provider: "ASAAS",
      environment,
      apiKeyMasked: maskApiKey(apiKey),
      webhookTokenConfigured: true,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    },
  };
}
