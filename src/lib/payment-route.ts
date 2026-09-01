import { NextResponse } from "next/server";
import { checkPaymentRateLimit } from "@/lib/rate-limit";
import {
  AppmaxPaymentMethod,
  createPayment,
  paymentErrorResponse,
} from "@/lib/payment-service";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

const MAX_PAYMENT_BODY_LENGTH = 16_384;
const METHODS = new Set<AppmaxPaymentMethod>(["PIX", "BOLETO", "CARD"]);

type PaymentRouteContext = {
  request: Request;
  userId: string;
  paymentLinkId?: string;
  amountCents?: number;
};

export async function handlePaymentRequest(context: PaymentRouteContext) {
  try {
    if (!isSameOrigin(context.request)) {
      return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
    }
    const contentType = context.request.headers.get("content-type")?.split(";")[0].trim();
    if (contentType !== "application/json") {
      return NextResponse.json({ error: "Formato inválido" }, { status: 415, headers: noStoreHeaders() });
    }
    if (Number(context.request.headers.get("content-length") ?? 0) > MAX_PAYMENT_BODY_LENGTH) {
      return NextResponse.json({ error: "Requisição muito grande" }, { status: 413, headers: noStoreHeaders() });
    }

    const limit = checkPaymentRateLimit(context.userId, context.request);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Muitas tentativas de pagamento. Aguarde alguns minutos." },
        { status: 429, headers: { ...noStoreHeaders(), "Retry-After": String(limit.retryAfterSeconds) } },
      );
    }

    const rawBody = await context.request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_PAYMENT_BODY_LENGTH) {
      return NextResponse.json({ error: "Requisição muito grande" }, { status: 413, headers: noStoreHeaders() });
    }
    let body: Record<string, unknown>;
    try {
      const parsed = JSON.parse(rawBody) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid body");
      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400, headers: noStoreHeaders() });
    }
    const method = typeof body.method === "string" ? body.method.toUpperCase() as AppmaxPaymentMethod : null;
    const requestKey = typeof body.requestKey === "string" ? body.requestKey.trim() : "";
    const customerIp = typeof body.customerIp === "string" ? body.customerIp.trim() : "";
    const installmentCount = typeof body.installmentCount === "number" ? body.installmentCount : undefined;
    const expectedProvider = body.expectedProvider === "APPMAX" || body.expectedProvider === "ASAAS"
      ? body.expectedProvider
      : undefined;
    if (!method || !METHODS.has(method)) {
      return NextResponse.json({ error: "Método de pagamento inválido" }, { status: 400, headers: noStoreHeaders() });
    }

    const result = await createPayment({
      userId: context.userId,
      paymentLinkId: context.paymentLinkId,
      amountCents: context.amountCents,
      method,
      expectedProvider,
      requestKey,
      customerIp,
      cardToken: typeof body.cardToken === "string" ? body.cardToken.trim() : undefined,
      holderName: typeof body.holderName === "string" ? body.holderName.trim() : undefined,
      holderDocumentNumber: typeof body.holderDocumentNumber === "string"
        ? body.holderDocumentNumber.replace(/\D/g, "")
        : undefined,
      automaticPix: body.automaticPix === true,
      installmentCount,
    });
    return NextResponse.json(result, { headers: noStoreHeaders() });
  } catch (error) {
    const mapped = paymentErrorResponse(error);
    if (mapped.status >= 500) console.error("payment request failed", { status: mapped.status });
    return NextResponse.json({ error: mapped.message }, { status: mapped.status, headers: noStoreHeaders() });
  }
}
