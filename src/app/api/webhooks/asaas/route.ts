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
  if (!isObject(payload) || !isObject(payload.payment)) {
    return response({ error: "Evento inválido" }, 400);
  }

  const eventId = stringValue(payload.id);
  const eventName = stringValue(payload.event);
  const providerOrderId = stringValue(payload.payment.id);
  const providerCustomerId = stringValue(payload.payment.customer);
  if (
    !eventId
    || eventId.length > 200
    || !eventName
    || eventName.length > 100
    || !providerOrderId
    || providerOrderId.length > 200
    || (providerCustomerId?.length ?? 0) > 200
  ) {
    return response({ error: "Evento inválido" }, 400);
  }

  const value = numberValue(payload.payment.value);
  const event = await prisma.gatewayEvent.upsert({
    where: { eventKey: `asaas:${eventId}` },
    update: {},
    create: {
      provider: "ASAAS",
      eventKey: `asaas:${eventId}`,
      eventName,
      eventType: "payment",
      providerOrderId,
      providerCustomerId,
      amountCents: value === null ? null : Math.round(value * 100),
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
