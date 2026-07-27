import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { clearAppmaxTokenCache } from "@/lib/appmax";
import { getAppmaxIntegrationSummary, normalizeAppmaxEnvironment } from "@/lib/appmax-integration";
import { encryptSecret } from "@/lib/integration-crypto";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

const MAX_BODY_LENGTH = 16_384;

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStoreHeaders() });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalText(value: unknown, maxLength: number) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length <= maxLength ? normalized || null : undefined;
}

async function requireAdmin(request: Request) {
  if (!isSameOrigin(request)) return { error: response({ error: "Origem inválida" }, 403) } as const;
  const user = await getCurrentUser();
  if (!user || user.role !== UserRole.ADMIN) return { error: response({ error: "Apenas administradores podem gerenciar integrações" }, 403) } as const;
  return { user } as const;
}

export async function GET(request: Request) {
  const access = await requireAdmin(request);
  if ("error" in access) return access.error;

  try {
    return response(await getAppmaxIntegrationSummary());
  } catch {
    return response({ error: "Não foi possível carregar a integração." }, 500);
  }
}

export async function POST(request: Request) {
  const access = await requireAdmin(request);
  if ("error" in access) return access.error;
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return response({ error: "Formato inválido" }, 415);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_LENGTH) return response({ error: "Payload muito grande" }, 413);

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_LENGTH) return response({ error: "Payload muito grande" }, 413);

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return response({ error: "JSON inválido" }, 400);
  }
  if (!isObject(body)) return response({ error: "Dados inválidos" }, 422);

  const environment = normalizeAppmaxEnvironment(body.environment);
  const submittedClientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
  const submittedSecret = typeof body.clientSecret === "string" ? body.clientSecret.trim() : "";
  const externalId = optionalText(body.externalId, 255);
  const appId = optionalText(body.appId, 255);
  const softDescriptorInput = typeof body.softDescriptor === "string" ? body.softDescriptor.trim() : "PACELAB";
  const softDescriptor = softDescriptorInput.replace(/[^A-Za-z0-9]/g, "").slice(0, 13).toUpperCase();
  const existing = await prisma.paymentIntegration.findUnique({ where: { provider: "APPMAX" } });
  const activeRecord = existing ? null : await prisma.paymentIntegration.findFirst({ where: { isActive: true }, select: { id: true } });

  if (!environment) return response({ error: "Escolha um ambiente válido." }, 422);
  if ((!existing && !submittedClientId) || submittedClientId.length > 255) return response({ error: "Informe um Client ID válido." }, 422);
  if (externalId === undefined || appId === undefined) return response({ error: "External ID ou App ID excede o limite permitido." }, 422);
  if (softDescriptor.length < 3 || softDescriptor.length > 13) return response({ error: "O soft descriptor deve ter entre 3 e 13 caracteres alfanuméricos." }, 422);
  if (typeof body.recurrenceEnabled !== "boolean") return response({ error: "Informe se a recorrência está habilitada." }, 422);
  if (!existing && !submittedSecret) return response({ error: "Informe o Client Secret para criar a integração." }, 422);
  if (submittedSecret && (submittedSecret.length < 8 || submittedSecret.length > 1024)) return response({ error: "O Client Secret informado é inválido." }, 422);

  const clientId = submittedClientId || existing?.clientId;
  if (!clientId) return response({ error: "Não foi possível preservar o Client ID atual." }, 422);

  let clientSecretEncrypted = existing?.clientSecretEncrypted;
  if (submittedSecret) {
    try {
      clientSecretEncrypted = encryptSecret(submittedSecret);
    } catch {
      return response({ error: "A chave de criptografia da aplicação não está configurada corretamente." }, 500);
    }
  }
  if (!clientSecretEncrypted) return response({ error: "Não foi possível preservar o Client Secret atual." }, 422);

  await prisma.paymentIntegration.upsert({
    where: { provider: "APPMAX" },
    create: {
      provider: "APPMAX",
      isActive: !activeRecord,
      environment,
      clientId,
      clientSecretEncrypted,
      externalId,
      appId,
      softDescriptor,
      recurrenceEnabled: body.recurrenceEnabled,
    },
    update: {
      environment,
      clientId,
      clientSecretEncrypted,
      externalId,
      appId,
      softDescriptor,
      recurrenceEnabled: body.recurrenceEnabled,
    },
  });
  clearAppmaxTokenCache();

  return response(await getAppmaxIntegrationSummary());
}

export async function DELETE(request: Request) {
  const access = await requireAdmin(request);
  if ("error" in access) return access.error;

  await prisma.$transaction(async (transaction) => {
    const deleted = await transaction.paymentIntegration.findUnique({ where: { provider: "APPMAX" } });
    await transaction.paymentIntegration.deleteMany({ where: { provider: "APPMAX" } });
    if (deleted?.isActive) {
      const fallback = await transaction.paymentIntegration.findFirst({ orderBy: { createdAt: "asc" } });
      if (fallback) await transaction.paymentIntegration.update({ where: { id: fallback.id }, data: { isActive: true } });
    }
  });
  clearAppmaxTokenCache();
  return response({ ok: true });
}
