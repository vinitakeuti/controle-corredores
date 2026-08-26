import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/integration-crypto";

export type AppmaxEnvironment = "sandbox" | "production";

export type StoredAppmaxIntegration = {
  id: string;
  isActive: boolean;
  environment: AppmaxEnvironment;
  clientId: string;
  clientSecret: string;
  externalId: string | null;
  appId: string | null;
  softDescriptor: string;
  recurrenceEnabled: boolean;
};

export type AppmaxIntegrationSummary = {
  configured: boolean;
  active: boolean;
  integration: {
    id: string;
    provider: "APPMAX";
    environment: AppmaxEnvironment;
    clientIdMasked: string;
    externalId: string | null;
    appId: string | null;
    softDescriptor: string;
    recurrenceEnabled: boolean;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export function normalizeAppmaxEnvironment(value: unknown): AppmaxEnvironment | null {
  if (value === "sandbox" || value === "production") return value;
  return null;
}

export function maskClientId(value: string) {
  const normalized = value.trim();
  if (normalized.length <= 8) return `••••${normalized.slice(-4)}`;
  return `${normalized.slice(0, 4)}••••${normalized.slice(-4)}`;
}

export async function getStoredAppmaxIntegration(): Promise<StoredAppmaxIntegration | null> {
  const record = await prisma.paymentIntegration.findUnique({ where: { provider: "APPMAX" } });
  if (!record?.clientId || !record.clientSecretEncrypted) return null;

  const environment = normalizeAppmaxEnvironment(record.environment);
  if (!environment) throw new Error("Ambiente da integração Appmax inválido.");

  return {
    id: record.id,
    isActive: record.isActive,
    environment,
    clientId: record.clientId,
    clientSecret: decryptSecret(record.clientSecretEncrypted),
    externalId: record.externalId,
    appId: record.appId,
    softDescriptor: record.softDescriptor,
    recurrenceEnabled: record.recurrenceEnabled,
  };
}

export async function getAppmaxIntegrationSummary(): Promise<AppmaxIntegrationSummary> {
  const record = await prisma.paymentIntegration.findUnique({ where: { provider: "APPMAX" } });
  if (!record?.clientId || !record.clientSecretEncrypted) {
    return { configured: false, active: record?.isActive ?? false, integration: null };
  }

  const environment = normalizeAppmaxEnvironment(record.environment);
  if (!environment) return { configured: false, active: record.isActive, integration: null };

  return {
    configured: true,
    active: record.isActive,
    integration: {
      id: record.id,
      provider: "APPMAX",
      environment,
      clientIdMasked: maskClientId(record.clientId),
      externalId: record.externalId,
      appId: record.appId,
      softDescriptor: record.softDescriptor,
      recurrenceEnabled: record.recurrenceEnabled,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    },
  };
}
