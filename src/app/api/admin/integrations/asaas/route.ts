import { PaymentStatus, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAsaasIntegrationSummary, normalizeAsaasEnvironment } from "@/lib/asaas-integration";
import { encryptSecret } from "@/lib/integration-crypto";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";
import { hashOpaqueToken } from "@/lib/tokens";

const MAX_BODY_LENGTH = 16_384;
const MAX_API_KEY_LENGTH = 2_048;
const MIN_WEBHOOK_TOKEN_LENGTH = 32;
const MAX_WEBHOOK_TOKEN_LENGTH = 255;

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStoreHeaders() });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function requireAdmin(request: Request) {
  if (!isSameOrigin(request)) return { error: response({ error: "Origem inválida" }, 403) } as const;
  const user = await getCurrentUser();
  if (!user || user.role !== UserRole.ADMIN) {
    return { error: response({ error: "Apenas administradores podem gerenciar integrações" }, 403) } as const;
  }
  return { user } as const;
}

export async function GET(request: Request) {
  const access = await requireAdmin(request);
  if ("error" in access) return access.error;

  try {
    return response(await getAsaasIntegrationSummary());
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

  const environment = normalizeAsaasEnvironment(body.environment);
  const submittedApiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  const rawWebhookToken = typeof body.webhookToken === "string" ? body.webhookToken : "";
  const submittedWebhookToken = rawWebhookToken.trim();
  const existing = await prisma.paymentIntegration.findUnique({ where: { provider: "ASAAS" } });
  const activeRecord = existing
    ? null
    : await prisma.paymentIntegration.findFirst({ where: { isActive: true }, select: { id: true } });

  if (!environment) return response({ error: "Escolha um ambiente válido." }, 422);
  const existingEnvironment = normalizeAsaasEnvironment(existing?.environment);
  const environmentChanged = Boolean(existingEnvironment && existingEnvironment !== environment);
  if (environmentChanged) {
    const pendingPayment = await prisma.payment.findFirst({
      where: { provider: "ASAAS", status: PaymentStatus.PENDING },
      select: { id: true },
    });
    if (pendingPayment) {
      return response({ error: "Não é possível alterar o ambiente enquanto houver pagamentos Asaas pendentes." }, 409);
    }
  }
  if (!existing && !submittedApiKey) return response({ error: "Informe a chave da API para criar a integração." }, 422);
  if (existing && !submittedApiKey && existing.environment !== environment) {
    return response({ error: "Informe uma nova chave da API ao alterar o ambiente." }, 422);
  }
  const expectedApiKeyPrefix = environment === "sandbox" ? "$aact_hmlg_" : "$aact_prod_";
  if (submittedApiKey && (!submittedApiKey.startsWith(expectedApiKeyPrefix) || submittedApiKey.length > MAX_API_KEY_LENGTH)) {
    return response({ error: "A chave da API informada é inválida." }, 422);
  }
  if (!existing && !submittedWebhookToken) {
    return response({ error: "Informe o token de autenticação do webhook para criar a integração." }, 422);
  }
  if (submittedWebhookToken && (
    submittedWebhookToken.length < MIN_WEBHOOK_TOKEN_LENGTH
    || submittedWebhookToken.length > MAX_WEBHOOK_TOKEN_LENGTH
    || /\s/.test(rawWebhookToken)
  )) {
    return response({ error: "O token de autenticação do webhook é inválido." }, 422);
  }

  let apiKeyEncrypted = existing?.apiKeyEncrypted;
  if (submittedApiKey) {
    try {
      apiKeyEncrypted = encryptSecret(submittedApiKey);
    } catch {
      return response({ error: "A chave de criptografia da aplicação não está configurada corretamente." }, 500);
    }
  }
  if (!apiKeyEncrypted) return response({ error: "Não foi possível preservar a chave da API atual." }, 422);

  const webhookTokenHash = submittedWebhookToken
    ? hashOpaqueToken(submittedWebhookToken)
    : existing?.webhookTokenHash;
  if (!webhookTokenHash) return response({ error: "Não foi possível preservar o token do webhook atual." }, 422);

  await prisma.$transaction(async (transaction) => {
    await transaction.paymentIntegration.upsert({
      where: { provider: "ASAAS" },
      create: {
        provider: "ASAAS",
        isActive: !activeRecord,
        environment,
        apiKeyEncrypted,
        webhookTokenHash,
      },
      update: {
        environment,
        apiKeyEncrypted,
        webhookTokenHash,
      },
    });

    // A chave identifica o ambiente, mas não oferece um identificador local
    // confiável da conta. Refaça os mappings em toda rotação de chave.
    if (submittedApiKey) {
      await transaction.user.updateMany({
        where: { asaasCustomerId: { not: null } },
        data: { asaasCustomerId: null },
      });
    }
  });

  return response(await getAsaasIntegrationSummary());
}

export async function DELETE(request: Request) {
  const access = await requireAdmin(request);
  if ("error" in access) return access.error;

  const result = await prisma.$transaction(async (transaction) => {
    const pendingPayment = await transaction.payment.findFirst({
      where: { provider: "ASAAS", status: PaymentStatus.PENDING },
      select: { id: true },
    });
    if (pendingPayment) return { blocked: true } as const;

    const deleted = await transaction.paymentIntegration.findUnique({ where: { provider: "ASAAS" } });
    await transaction.paymentIntegration.deleteMany({ where: { provider: "ASAAS" } });
    if (deleted?.isActive) {
      const fallback = await transaction.paymentIntegration.findFirst({ orderBy: { createdAt: "asc" } });
      if (fallback) {
        await transaction.paymentIntegration.update({ where: { id: fallback.id }, data: { isActive: true } });
      }
    }
    return { blocked: false } as const;
  });

  if (result.blocked) {
    return response({ error: "Não é possível excluir a integração enquanto houver pagamentos Asaas pendentes." }, 409);
  }

  return response({ ok: true });
}
