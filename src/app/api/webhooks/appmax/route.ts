import { createHash, timingSafeEqual } from "node:crypto";
import { after, NextResponse } from "next/server";
import { getAppmaxCheckoutConfig, getAppmaxWebhookToken } from "@/lib/appmax";
import { processAppmaxGatewayEvent } from "@/lib/appmax-webhook";
import { prisma } from "@/lib/prisma";
import { noStoreHeaders } from "@/lib/security";

const MAX_WEBHOOK_BODY_LENGTH = 128_000;

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nested(value: unknown, ...path: string[]) {
  let current: unknown = value;
  for (const key of path) {
    if (!isObject(current)) return undefined;
    current = current[key];
  }
  return current;
}

function stringValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function numberValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  }
  return null;
}

function dateValue(...values: unknown[]) {
  const value = stringValue(...values);
  if (!value) return null;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(" ", "T")}-03:00`
    : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function secureEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export async function POST(request: Request) {
  const configuredToken = getAppmaxWebhookToken();
  const suppliedToken = new URL(request.url).searchParams.get("token") ?? request.headers.get("x-appmax-webhook-token");
  if (!configuredToken) {
    return NextResponse.json({ error: "Webhook não configurado" }, { status: 503, headers: noStoreHeaders() });
  }
  if (!suppliedToken || !secureEquals(suppliedToken, configuredToken)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: noStoreHeaders() });
  }
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return NextResponse.json({ error: "Formato inválido" }, { status: 415, headers: noStoreHeaders() });
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_WEBHOOK_BODY_LENGTH) {
    return NextResponse.json({ error: "Payload muito grande" }, { status: 413, headers: noStoreHeaders() });
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BODY_LENGTH) {
    return NextResponse.json({ error: "Payload muito grande" }, { status: 413, headers: noStoreHeaders() });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400, headers: noStoreHeaders() });
  }
  if (!isObject(payload) || !isObject(payload.data)) {
    return NextResponse.json({ error: "Evento inválido" }, { status: 400, headers: noStoreHeaders() });
  }

  const expectedAppId = (await getAppmaxCheckoutConfig()).appId;
  const receivedAppId = stringValue(payload.app_id);
  if (expectedAppId && receivedAppId !== expectedAppId) {
    return NextResponse.json({ error: "Aplicativo inválido" }, { status: 401, headers: noStoreHeaders() });
  }

  const eventName = stringValue(payload.event);
  const eventType = stringValue(payload.event_type);
  if (!eventName || !eventType || eventName.length > 100 || eventType.length > 40) {
    return NextResponse.json({ error: "Evento inválido" }, { status: 400, headers: noStoreHeaders() });
  }

  const providerOrderId = stringValue(payload.data.order_id, nested(payload.data, "order", "id"));
  const providerSubscriptionId = stringValue(payload.data.subscription_id, nested(payload.data, "subscription", "id"));
  const providerCustomerId = stringValue(payload.data.customer_id, nested(payload.data, "customer", "id"));
  const amountCents = numberValue(payload.data.total, nested(payload.data, "order", "total_paid"));
  const occurredAt = dateValue(
    payload.data.updated_at,
    payload.data.paid_at,
    payload.data.created_at,
    nested(payload.data, "payment", "paid_at"),
  );
  const eventKey = createHash("sha256").update(rawBody).digest("hex");

  const event = await prisma.gatewayEvent.upsert({
    where: { eventKey },
    update: {},
    create: {
      eventKey,
      eventName,
      eventType,
      providerOrderId,
      providerSubscriptionId,
      providerCustomerId,
      amountCents,
      occurredAt,
    },
  });

  after(() => processAppmaxGatewayEvent(event.id));
  return NextResponse.json({ received: true }, { status: 202, headers: noStoreHeaders() });
}
