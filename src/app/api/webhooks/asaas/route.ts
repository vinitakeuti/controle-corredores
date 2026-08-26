import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processAsaasGatewayEvent } from "@/lib/asaas-webhook";
import { prisma } from "@/lib/prisma";
import { noStoreHeaders } from "@/lib/security";
import { hashOpaqueToken } from "@/lib/tokens";

const MAX_WEBHOOK_BODY_LENGTH = 128_000;

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+(?:\.\d{1,2})?$/.test(value)) return Number(value);
  return null;
}

function dateValue(value: unknown) {
  const raw = stringValue(value);
  if (!raw) return null;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)
    ? `${raw.replace(" ", "T")}-03:00`
    : raw;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function secureEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStoreHeaders() });
}

export async function POST(request: Request) {
  const integration = await prisma.paymentIntegration.findUnique({
    where: { provider: "ASAAS" },
    select: { webhookTokenHash: true },
  });
  const suppliedToken = request.headers.get("asaas-access-token");
  if (!integration?.webhookTokenHash) return response({ error: "Webhook não configurado" }, 503);
  if (!suppliedToken || suppliedToken.length > 255) return response({ error: "Não autorizado" }, 401);

  let suppliedHash: string;
  try {
    suppliedHash = hashOpaqueToken(suppliedToken);
  } catch {
    return response({ error: "Webhook não configurado" }, 503);
  }
  if (!secureEquals(suppliedHash, integration.webhookTokenHash)) {
    return response({ error: "Não autorizado" }, 401);
  }
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return response({ error: "Formato inválido" }, 415);
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_WEBHOOK_BODY_LENGTH) {
    return response({ error: "Payload muito grande" }, 413);
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BODY_LENGTH) {
    return response({ error: "Payload muito grande" }, 413);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return response({ error: "JSON inválido" }, 400);
  }
  if (!isObject(payload)) {
    return response({ error: "Evento inválido" }, 400);
  }

  const eventId = stringValue(payload.id);
  const eventName = stringValue(payload.event);
  const payment = isObject(payload.payment) ? payload.payment : null;
  const authorization = isObject(payload.authorization) ? payload.authorization : null;
  const paymentInstruction = isObject(payload.paymentInstruction) ? payload.paymentInstruction : null;
  let eventType: "payment" | "pix_automatic_authorization" | "pix_automatic_instruction" | "pix_automatic_eligibility";
  let providerOrderId: string | null = null;
  let providerSubscriptionId: string | null = null;
  let providerCustomerId: string | null = null;
  let amountCents: number | null = null;

  if (payment) {
    eventType = "payment";
    providerOrderId = stringValue(payment.id);
    providerCustomerId = stringValue(payment.customer);
    const value = numberValue(payment.value);
    amountCents = value === null ? null : Math.round(value * 100);
  } else if (authorization && eventName?.startsWith("PIX_AUTOMATIC_RECURRING_AUTHORIZATION_")) {
    eventType = "pix_automatic_authorization";
    providerSubscriptionId = stringValue(authorization.id);
    providerCustomerId = stringValue(authorization.customerId);
    const value = numberValue(authorization.value);
    amountCents = value === null ? null : Math.round(value * 100);
  } else if (paymentInstruction && eventName?.startsWith("PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_")) {
    eventType = "pix_automatic_instruction";
    providerOrderId = stringValue(paymentInstruction.paymentId) ?? stringValue(paymentInstruction.payment);
    const instructionAuthorization = isObject(paymentInstruction.authorization) ? paymentInstruction.authorization : null;
    providerSubscriptionId = instructionAuthorization ? stringValue(instructionAuthorization.id) : null;
  } else if (eventName === "PIX_AUTOMATIC_RECURRING_ELIGIBILITY_UPDATED") {
    eventType = "pix_automatic_eligibility";
  } else {
    return response({ error: "Evento inválido" }, 400);
  }

  if (
    !eventId
    || eventId.length > 200
    || !eventName
    || eventName.length > 100
    || (providerOrderId?.length ?? 0) > 200
    || (providerSubscriptionId?.length ?? 0) > 200
    || (providerCustomerId?.length ?? 0) > 200
    || (eventType === "payment" && !providerOrderId)
    || (eventType === "pix_automatic_authorization" && !providerSubscriptionId)
    || (eventType === "pix_automatic_instruction" && (!providerOrderId || !providerSubscriptionId))
  ) {
    return response({ error: "Evento inválido" }, 400);
  }

  const event = await prisma.gatewayEvent.upsert({
    where: { eventKey: `asaas:${eventId}` },
    update: {},
    create: {
      provider: "ASAAS",
      eventKey: `asaas:${eventId}`,
      eventName,
      eventType,
      providerOrderId,
      providerSubscriptionId,
      providerCustomerId,
      amountCents,
      occurredAt: dateValue(payload.dateCreated),
    },
  });

  try {
    await processAsaasGatewayEvent(event.id);
  } catch {
    // O Asaas repetirá a entrega quando não receber HTTP 200. O evento já
    // ficou persistido como FAILED e será reprocessado na próxima tentativa.
    return response({ error: "Falha temporária ao processar o evento" }, 503);
  }
  return response({ received: true });
}
