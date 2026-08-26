import { getStoredAppmaxIntegration } from "@/lib/appmax-integration";
import { getActivePaymentProvider } from "@/lib/integration-directory";

type JsonObject = Record<string, unknown>;

type AppmaxTokenCache = {
  accessToken: string;
  expiresAt: number;
  integrationId: string;
};

const globalForAppmax = globalThis as typeof globalThis & {
  appmaxTokenCache?: AppmaxTokenCache;
};

const SANDBOX_AUTH_URL = "https://auth.sandboxappmax.com.br";
const SANDBOX_API_URL = "https://api.sandboxappmax.com.br";
const PRODUCTION_AUTH_URL = "https://auth.appmax.com.br";
const PRODUCTION_API_URL = "https://api.appmax.com.br";
const REQUEST_TIMEOUT_MS = 8_000;

export class AppmaxError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly providerMessage?: string,
  ) {
    super(message);
    this.name = "AppmaxError";
  }
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function atPath(value: unknown, path: string[]) {
  let current: unknown = value;
  for (const key of path) {
    if (!isObject(current)) return undefined;
    current = current[key];
  }
  return current;
}

function firstString(value: unknown, paths: string[][]) {
  for (const path of paths) {
    const candidate = atPath(value, path);
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    if (typeof candidate === "number" && Number.isFinite(candidate)) return String(candidate);
  }
  return null;
}

function firstNumber(value: unknown, paths: string[][]) {
  for (const path of paths) {
    const candidate = atPath(value, path);
    if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
    if (typeof candidate === "string" && /^\d+$/.test(candidate)) return Number(candidate);
  }
  return null;
}

function providerErrorMessage(payload: unknown) {
  return firstString(payload, [
    ["error", "message"],
    ["message"],
    ["errors", "message"],
  ]) ?? "A Appmax recusou a requisição.";
}

function urls(environment: "sandbox" | "production") {
  return environment === "production"
    ? { auth: PRODUCTION_AUTH_URL, api: PRODUCTION_API_URL }
    : { auth: SANDBOX_AUTH_URL, api: SANDBOX_API_URL };
}

async function integration(requireActive = true) {
  try {
    const stored = await getStoredAppmaxIntegration();
    if (!stored) throw new AppmaxError("Credenciais da Appmax não configuradas.", 503);
    if (requireActive && !stored.isActive) {
      throw new AppmaxError("A Appmax não está selecionada como gateway ativo.", 503);
    }
    return stored;
  } catch (error) {
    if (error instanceof AppmaxError) throw error;
    throw new AppmaxError("Não foi possível ler a configuração da Appmax.", 503);
  }
}

export async function getAppmaxCheckoutConfig() {
  const activeProvider = await getActivePaymentProvider();
  if (activeProvider !== "APPMAX") {
    return {
      enabled: false,
      activeProvider,
      environment: "sandbox",
      externalId: null,
      appId: null,
      softDescriptor: "PACELAB",
      recurrenceEnabled: false,
    } as const;
  }

  const stored = await getStoredAppmaxIntegration();
  return {
    enabled: Boolean(stored?.isActive),
    activeProvider,
    environment: stored?.environment ?? "sandbox",
    externalId: stored?.externalId ?? null,
    appId: stored?.appId ?? null,
    softDescriptor: stored?.softDescriptor ?? "PACELAB",
    recurrenceEnabled: stored?.recurrenceEnabled ?? false,
  } as const;
}

export function getAppmaxWebhookToken() {
  return process.env.APPMAX_WEBHOOK_TOKEN?.trim() || null;
}

export function clearAppmaxTokenCache() {
  globalForAppmax.appmaxTokenCache = undefined;
}

async function readResponse(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AppmaxError("A Appmax retornou uma resposta inválida.", response.status || 502);
  }
}

async function getAccessToken(force = false, configuredIntegration?: Awaited<ReturnType<typeof getStoredAppmaxIntegration>>) {
  const currentIntegration = configuredIntegration ?? await integration();
  const now = Date.now();
  if (!force && globalForAppmax.appmaxTokenCache?.integrationId === currentIntegration.id && globalForAppmax.appmaxTokenCache.expiresAt > now + 30_000) {
    return globalForAppmax.appmaxTokenCache.accessToken;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: currentIntegration.clientId,
    client_secret: currentIntegration.clientSecret,
  });

  let response: Response;
  try {
    response = await fetch(`${urls(currentIntegration.environment).auth}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new AppmaxError("Não foi possível autenticar na Appmax.", 502);
  }

  const payload = await readResponse(response);
  if (!response.ok) {
    throw new AppmaxError("A autenticação da Appmax falhou.", response.status, providerErrorMessage(payload));
  }

  const accessToken = firstString(payload, [["access_token"]]);
  const expiresIn = firstNumber(payload, [["expires_in"]]) ?? 3600;
  if (!accessToken) throw new AppmaxError("A Appmax não retornou um token válido.", 502);

  globalForAppmax.appmaxTokenCache = {
    accessToken,
    expiresAt: now + Math.max(60, expiresIn) * 1000,
    integrationId: currentIntegration.id,
  };
  return accessToken;
}

async function appmaxRequest(
  path: string,
  init: RequestInit = {},
  retryUnauthorized = true,
  requireActive = true,
) {
  const currentIntegration = await integration(requireActive);
  const accessToken = await getAccessToken(false, currentIntegration);
  let response: Response;
  try {
    response = await fetch(`${urls(currentIntegration.environment).api}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...init.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new AppmaxError("A Appmax não respondeu a tempo.", 502);
  }

  if (response.status === 401 && retryUnauthorized) {
    clearAppmaxTokenCache();
    await getAccessToken(true, currentIntegration);
    return appmaxRequest(path, init, false, requireActive);
  }

  const payload = await readResponse(response);
  if (!response.ok) {
    throw new AppmaxError("A Appmax recusou a operação.", response.status, providerErrorMessage(payload));
  }
  return payload;
}

function jsonBody(value: unknown) {
  return JSON.stringify(value);
}

export type AppmaxCustomerInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  documentNumber: string;
  ip: string;
  product: {
    sku: string;
    name: string;
    unitValue: number;
  };
};

export async function createAppmaxCustomer(input: AppmaxCustomerInput) {
  const payload = await appmaxRequest("/v1/customers", {
    method: "POST",
    body: jsonBody({
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      phone: input.phone,
      document_number: input.documentNumber,
      ip: input.ip,
      products: [{
        sku: input.product.sku,
        name: input.product.name,
        quantity: 1,
        unit_value: input.product.unitValue,
        type: "digital",
      }],
    }),
  });
  const id = firstString(payload, [["data", "customer", "id"]]);
  if (!id) throw new AppmaxError("A Appmax não retornou o identificador do cliente.", 502);
  return { id };
}

export async function createAppmaxOrder(input: {
  customerId: string;
  amountCents: number;
  sku: string;
  productName: string;
}) {
  const payload = await appmaxRequest("/v1/orders", {
    method: "POST",
    body: jsonBody({
      customer_id: Number(input.customerId),
      discount_value: 0,
      shipping_value: 0,
      products: [{
        sku: input.sku,
        name: input.productName,
        quantity: 1,
        unit_value: input.amountCents,
        type: "digital",
      }],
    }),
  });
  const id = firstString(payload, [["data", "order", "id"]]);
  if (!id) throw new AppmaxError("A Appmax não retornou o identificador do pedido.", 502);
  return {
    id,
    status: firstString(payload, [["data", "order", "status"]]) ?? "pendente",
  };
}

function subscriptionPayload(recurrenceEnabled: boolean) {
  return recurrenceEnabled
    ? { subscription: { interval: "month", interval_count: 1 } }
    : {};
}

export async function createAppmaxPix(input: { orderId: string; documentNumber: string }) {
  const checkoutConfig = await getAppmaxCheckoutConfig();
  const payload = await appmaxRequest("/v1/payments/pix", {
    method: "POST",
    body: jsonBody({
      order_id: Number(input.orderId),
      payment_data: {
        pix: { document_number: input.documentNumber },
        ...subscriptionPayload(checkoutConfig.recurrenceEnabled),
      },
    }),
  });
  return {
    status: firstString(payload, [["data", "order", "status"]]) ?? "pendente",
    paymentId: firstString(payload, [["data", "payment", "id"]]),
    subscriptionId: firstString(payload, [["data", "subscription", "id"]]),
    qrCode: firstString(payload, [
      ["data", "payment", "pix_qrcode"],
      ["data", "pix", "qr_code"],
      ["data", "pix", "pix_qrcode"],
    ]),
    emv: firstString(payload, [
      ["data", "payment", "pix_emv"],
      ["data", "pix", "emv_code"],
      ["data", "pix", "pix_emv"],
    ]),
    expiresAt: firstString(payload, [
      ["data", "payment", "pix_expiration_date"],
      ["data", "pix", "expires_at"],
      ["data", "pix", "pix_expiration_date"],
    ]),
  };
}

export async function createAppmaxBoleto(input: { orderId: string; documentNumber: string }) {
  const payload = await appmaxRequest("/v1/payments/boleto", {
    method: "POST",
    body: jsonBody({
      order_id: Number(input.orderId),
      payment_data: { boleto: { document_number: input.documentNumber } },
    }),
  });
  return {
    status: firstString(payload, [["data", "order", "status"]]) ?? "pendente",
    paymentId: firstString(payload, [["data", "payment", "id"]]),
    url: firstString(payload, [
      ["data", "payment", "boleto_url"],
      ["data", "boleto", "pdf_url"],
      ["data", "boleto", "boleto_url"],
    ]),
    digitableLine: firstString(payload, [
      ["data", "payment", "boleto_digitable_line"],
      ["data", "boleto", "digitable_line"],
      ["data", "boleto", "boleto_digitable_line"],
    ]),
    dueDate: firstString(payload, [
      ["data", "payment", "boleto_overdue_date"],
      ["data", "boleto", "due_date"],
      ["data", "boleto", "boleto_overdue_date"],
    ]),
  };
}

export async function createAppmaxCard(input: {
  orderId: string;
  customerId: string;
  cardToken: string;
  holderDocumentNumber: string;
  holderName: string;
}) {
  const checkoutConfig = await getAppmaxCheckoutConfig();
  const configuredDescriptor = checkoutConfig.softDescriptor.replace(/[^A-Za-z0-9]/g, "").slice(0, 13);
  const payload = await appmaxRequest("/v1/payments/credit-card", {
    method: "POST",
    body: jsonBody({
      order_id: Number(input.orderId),
      customer_id: Number(input.customerId),
      payment_data: {
        credit_card: {
          token: input.cardToken,
          holder_document_number: input.holderDocumentNumber,
          holder_name: input.holderName,
          installments: 1,
          soft_descriptor: configuredDescriptor || "PACELAB",
        },
        ...subscriptionPayload(checkoutConfig.recurrenceEnabled),
      },
    }),
  });
  return {
    status: firstString(payload, [["data", "order", "status"]]) ?? "pendente",
    paymentId: firstString(payload, [["data", "payment", "id"]]),
    subscriptionId: firstString(payload, [["data", "subscription", "id"]]),
    paidAt: firstString(payload, [["data", "payment", "paid_at"]]),
  };
}

export type AppmaxOrderSnapshot = {
  id: string;
  status: string;
  totalPaid: number | null;
  paidAt: string | null;
  refundedAt: string | null;
  customerId: string | null;
  paymentId: string | null;
};

export async function getAppmaxOrder(orderId: string): Promise<AppmaxOrderSnapshot> {
  const payload = await appmaxRequest(`/v1/orders/${encodeURIComponent(orderId)}`, {}, true, false);
  const id = firstString(payload, [["data", "order", "id"]]);
  if (!id) throw new AppmaxError("A Appmax não retornou o pedido consultado.", 502);
  return {
    id,
    status: firstString(payload, [["data", "order", "status"]]) ?? "pendente",
    totalPaid: firstNumber(payload, [["data", "order", "total_paid"]]),
    paidAt: firstString(payload, [["data", "payment", "paid_at"], ["data", "order", "paid_at"]]),
    refundedAt: firstString(payload, [["data", "refund", "refunded_at"], ["data", "order", "refund_at"]]),
    customerId: firstString(payload, [["data", "customer", "id"]]),
    paymentId: firstString(payload, [["data", "payment", "id"]]),
  };
}
