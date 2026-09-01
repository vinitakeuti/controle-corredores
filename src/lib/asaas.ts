import { getStoredAsaasIntegration } from "@/lib/asaas-integration";
import { PlanPeriod } from "@prisma/client";
import { asaasFrequencyForPeriod } from "@/lib/plan-billing";

type JsonObject = Record<string, unknown>;

const REQUEST_TIMEOUT_MS = 6_000;
const USER_AGENT = "PaceLab/1.0 (Next.js; payments)";

export class AsaasError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly providerMessage?: string,
  ) {
    super(message);
    this.name = "AsaasError";
  }
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function providerError(payload: unknown) {
  if (!isObject(payload) || !Array.isArray(payload.errors)) return null;
  for (const item of payload.errors) {
    if (isObject(item)) {
      const description = stringValue(item.description);
      if (description) return description;
    }
  }
  return null;
}

async function integration(requireActive: boolean) {
  try {
    const stored = await getStoredAsaasIntegration();
    if (!stored) throw new AsaasError("Credenciais do Asaas não configuradas.", 503);
    if (requireActive && !stored.isActive) throw new AsaasError("O Asaas não está selecionado como gateway ativo.", 503);
    return stored;
  } catch (error) {
    if (error instanceof AsaasError) throw error;
    throw new AsaasError("Não foi possível ler a configuração do Asaas.", 503);
  }
}

function baseUrl(environment: "sandbox" | "production") {
  return environment === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";
}

async function readResponse(response: Response) {
  const raw = await response.text();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new AsaasError("O Asaas retornou uma resposta inválida.", response.ok ? 502 : (response.status || 502));
  }
}

async function asaasRequest(path: string, init: RequestInit = {}, requireActive = true) {
  const stored = await integration(requireActive);
  let response: Response;
  try {
    response = await fetch(`${baseUrl(stored.environment)}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        access_token: stored.apiKey,
        ...init.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new AsaasError("O Asaas não respondeu a tempo.", 502);
  }

  const payload = await readResponse(response);
  if (!response.ok) {
    throw new AsaasError("O Asaas recusou a operação.", response.status, providerError(payload) ?? undefined);
  }
  return payload;
}

function dataItems(payload: unknown) {
  if (!isObject(payload) || !Array.isArray(payload.data)) return [];
  return payload.data.filter(isObject);
}

function normalizedDigits(value: string) {
  return value.replace(/\D/g, "");
}

async function findAsaasCustomer(userId: string, cpf: string) {
  const search = new URLSearchParams({
    externalReference: userId,
    cpfCnpj: normalizedDigits(cpf),
    limit: "2",
  });
  const matches = dataItems(await asaasRequest(`/customers?${search.toString()}`));
  if (matches.length > 1) {
    throw new AsaasError("Há mais de um cliente Asaas para este aluno.", 409);
  }
  const customer = matches[0];
  const id = stringValue(customer?.id);
  const remoteCpf = stringValue(customer?.cpfCnpj);
  if (id && remoteCpf && normalizedDigits(remoteCpf) !== normalizedDigits(cpf)) {
    throw new AsaasError("O CPF do cliente Asaas não corresponde ao aluno.", 409);
  }
  return id ? { id } : null;
}

export async function ensureAsaasCustomer(input: {
  userId: string;
  name: string;
  email: string;
  cpf: string;
  phone: string;
}) {
  const existing = await findAsaasCustomer(input.userId, input.cpf);
  if (existing) return existing;

  let created: unknown;
  try {
    created = await asaasRequest("/customers", {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        cpfCnpj: normalizedDigits(input.cpf),
        email: input.email,
        mobilePhone: normalizedDigits(input.phone),
        externalReference: input.userId,
        notificationDisabled: true,
      }),
    });
  } catch (error) {
    if (error instanceof AsaasError && error.status >= 500) {
      const recovered = await findAsaasCustomer(input.userId, input.cpf).catch(() => null);
      if (recovered) return recovered;
    }
    throw error;
  }
  const id = isObject(created) ? stringValue(created.id) : null;
  if (!id) throw new AsaasError("O Asaas não retornou o identificador do cliente.", 502);
  return { id };
}

export type AsaasBillingType = "PIX" | "CREDIT_CARD" | "BOLETO";

function todayInMaceio() {
  return dateInMaceio(new Date());
}

function dateInMaceio(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Maceio",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export type AsaasAutomaticPixAuthorization = {
  id: string;
  status: string;
  copyPaste: string;
  encodedImage: string | null;
  expirationDate: string | null;
  conciliationIdentifier: string | null;
};

export async function createAsaasAutomaticPixAuthorization(input: {
  customerId: string;
  contractId: string;
  amountCents: number;
  description: string;
  startDate: Date;
  billingPeriod: PlanPeriod;
}) : Promise<AsaasAutomaticPixAuthorization> {
  const payload = await asaasRequest("/pix/automatic/authorizations", {
    method: "POST",
    body: JSON.stringify({
      customerId: input.customerId,
      contractId: input.contractId.slice(0, 35),
      frequency: asaasFrequencyForPeriod[input.billingPeriod],
      startDate: dateInMaceio(input.startDate),
      value: input.amountCents / 100,
      description: input.description.slice(0, 35),
      immediateQrCode: {},
      paymentCreationMode: "SUBSCRIPTION",
      retryPolicy: "ALLOW_THREE_IN_SEVEN_DAYS",
    }),
  });
  if (!isObject(payload)) throw new AsaasError("O Asaas não retornou a autorização de Pix Automático.", 502);
  const id = stringValue(payload.id);
  const immediateQrCode = isObject(payload.immediateQrCode) ? payload.immediateQrCode : null;
  const copyPaste = immediateQrCode ? stringValue(immediateQrCode.payload) : null;
  if (!id || !immediateQrCode || !copyPaste) {
    throw new AsaasError("O Asaas não retornou o QR Code do Pix Automático.", 502);
  }
  return {
    id,
    status: stringValue(payload.status) ?? "CREATED",
    copyPaste,
    encodedImage: stringValue(immediateQrCode.encodedImage),
    expirationDate: stringValue(immediateQrCode.expirationDate),
    conciliationIdentifier: stringValue(immediateQrCode.conciliationIdentifier),
  };
}

export async function cancelAsaasAutomaticPixAuthorization(authorizationId: string) {
  try {
    await asaasRequest(`/pix/automatic/authorizations/${encodeURIComponent(authorizationId)}`, {
      method: "DELETE",
    });
  } catch (error) {
    if (error instanceof AsaasError && error.status === 404) return;
    throw error;
  }
}

export async function createAsaasPayment(input: {
  customerId: string;
  billingType: AsaasBillingType;
  amountCents: number;
  description: string;
  externalReference: string;
  installmentCount?: number;
}) {
  const installment = input.installmentCount && input.installmentCount > 1
    ? { installmentCount: input.installmentCount, totalValue: input.amountCents / 100 }
    : { value: input.amountCents / 100 };
  const payload = await asaasRequest("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: input.customerId,
      billingType: input.billingType,
      ...installment,
      dueDate: todayInMaceio(),
      description: input.description.slice(0, 500),
      externalReference: input.externalReference,
    }),
  });
  if (!isObject(payload)) throw new AsaasError("O Asaas não retornou a cobrança.", 502);
  const id = stringValue(payload.id);
  if (!id) throw new AsaasError("O Asaas não retornou o identificador da cobrança.", 502);
  return {
    id,
    status: stringValue(payload.status) ?? "PENDING",
    invoiceUrl: stringValue(payload.invoiceUrl),
    dueDate: stringValue(payload.dueDate),
  };
}

export async function findAsaasPaymentByExternalReference(input: {
  externalReference: string;
  customerId: string;
  billingType: AsaasBillingType;
  amountCents: number;
  installmentCount?: number;
}) {
  const search = new URLSearchParams({ externalReference: input.externalReference, limit: "20" });
  const matches = dataItems(await asaasRequest(`/payments?${search.toString()}`));
  const installmentCount = input.installmentCount ?? 1;
  if (installmentCount === 1 && matches.length > 1) {
    throw new AsaasError("Há mais de uma cobrança Asaas para esta tentativa.", 409);
  }
  const payment = installmentCount > 1
    ? matches.find((candidate) => numberValue(candidate?.installmentNumber) === 1) ?? matches[0]
    : matches[0];
  const id = stringValue(payment?.id);
  if (!id) return null;
  const remoteValue = numberValue(payment?.value);
  const minimumInstallmentCents = Math.floor(input.amountCents / installmentCount);
  const maximumInstallmentCents = Math.ceil(input.amountCents / installmentCount);
  const valid = stringValue(payment?.externalReference) === input.externalReference
    && stringValue(payment?.customer) === input.customerId
    && stringValue(payment?.billingType) === input.billingType
    && remoteValue !== null
    && (installmentCount === 1
      ? Math.round(remoteValue * 100) === input.amountCents
      : Math.round(remoteValue * 100) >= minimumInstallmentCents && Math.round(remoteValue * 100) <= maximumInstallmentCents);
  if (!valid) {
    throw new AsaasError("A cobrança recuperada não corresponde à tentativa local.", 409);
  }
  return {
    id,
    status: stringValue(payment?.status) ?? "PENDING",
    invoiceUrl: stringValue(payment?.invoiceUrl),
    dueDate: stringValue(payment?.dueDate),
  };
}

export async function getAsaasPixQrCode(paymentId: string) {
  const payload = await asaasRequest(`/payments/${encodeURIComponent(paymentId)}/pixQrCode`);
  if (!isObject(payload)) throw new AsaasError("O Asaas não retornou os dados do Pix.", 502);
  const copyPaste = stringValue(payload.payload);
  if (!copyPaste) throw new AsaasError("O Asaas não retornou o código Pix.", 502);
  return {
    copyPaste,
    encodedImage: stringValue(payload.encodedImage),
    expirationDate: stringValue(payload.expirationDate),
  };
}

export type AsaasPaymentSnapshot = {
  id: string;
  status: string;
  valueCents: number | null;
  billingType: string | null;
  invoiceUrl: string | null;
  dueDate: string | null;
  paymentDate: string | null;
  confirmedDate: string | null;
  clientPaymentDate: string | null;
};

export async function getAsaasPayment(paymentId: string): Promise<AsaasPaymentSnapshot> {
  const payload = await asaasRequest(`/payments/${encodeURIComponent(paymentId)}`, {}, false);
  if (!isObject(payload)) throw new AsaasError("O Asaas não retornou a cobrança.", 502);
  const id = stringValue(payload.id);
  const status = stringValue(payload.status);
  if (!id || !status) throw new AsaasError("O Asaas retornou uma cobrança inválida.", 502);
  const value = numberValue(payload.value);
  return {
    id,
    status,
    valueCents: value === null ? null : Math.round(value * 100),
    billingType: stringValue(payload.billingType),
    invoiceUrl: stringValue(payload.invoiceUrl),
    dueDate: stringValue(payload.dueDate),
    paymentDate: stringValue(payload.paymentDate),
    confirmedDate: stringValue(payload.confirmedDate),
    clientPaymentDate: stringValue(payload.clientPaymentDate),
  };
}
