import { isIP } from "node:net";
import {
  Payment,
  PaymentMethod,
  PaymentStatus,
  SubscriptionStatus,
  UserRole,
} from "@prisma/client";
import {
  AppmaxError,
  createAppmaxBoleto,
  createAppmaxCard,
  createAppmaxCustomer,
  createAppmaxOrder,
  createAppmaxPix,
  getAppmaxCheckoutConfig,
  getAppmaxOrder,
} from "@/lib/appmax";
import { prisma } from "@/lib/prisma";

export type AppmaxPaymentMethod = "PIX" | "BOLETO" | "CARD";

export type CreatePaymentInput = {
  userId: string;
  paymentLinkId?: string;
  amountCents?: number;
  method: AppmaxPaymentMethod;
  requestKey: string;
  customerIp: string;
  cardToken?: string;
  holderName?: string;
  holderDocumentNumber?: string;
};

export class PaymentServiceError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "PaymentServiceError";
  }
}

function safeDate(value: string | null | undefined) {
  if (!value) return null;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(" ", "T")}-03:00`
    : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addMonths(date: Date, count = 1) {
  const result = new Date(date);
  const originalDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + count);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, lastDay));
  return result;
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const firstName = parts.shift() || "Aluno";
  return {
    firstName,
    lastName: parts.join(" ") || firstName,
  };
}

function normalizeQrCode(value: string | null) {
  if (!value) return null;
  return value.startsWith("data:image/") ? value : `data:image/png;base64,${value}`;
}

function parseProviderExpiration(value: string | null, fallbackMilliseconds: number) {
  return safeDate(value) ?? new Date(Date.now() + fallbackMilliseconds);
}

function paymentMethod(method: AppmaxPaymentMethod) {
  if (method === "CARD") return PaymentMethod.CARD;
  if (method === "BOLETO") return PaymentMethod.BOLETO;
  return PaymentMethod.PIX;
}

function publicPayment(payment: Payment) {
  return {
    paymentId: payment.id,
    status: payment.status,
    providerStatus: payment.providerStatus,
    recurringRequested: payment.recurringRequested,
    expiresAt: payment.expiresAt,
    pix: payment.method === PaymentMethod.PIX ? {
      copyPaste: payment.pixCopyPaste,
      qrCode: payment.pixQrCode,
    } : null,
    boleto: payment.method === PaymentMethod.BOLETO ? {
      url: payment.boletoUrl,
      digitableLine: payment.boletoDigitableLine,
      dueDate: payment.expiresAt,
    } : null,
  };
}

function userFacingProviderError(error: unknown, method: AppmaxPaymentMethod) {
  if (error instanceof PaymentServiceError) return error;
  if (!(error instanceof AppmaxError)) {
    return new PaymentServiceError("Não foi possível processar o pagamento. Tente novamente.", 502);
  }
  if (error.status === 401 || error.status === 403 || error.status === 503) {
    return new PaymentServiceError("O gateway de pagamento ainda não está configurado corretamente.", 503);
  }
  if (error.status === 422) {
    return new PaymentServiceError("A Appmax recusou os dados informados. Confira o cadastro e tente novamente.", 422);
  }
  if (method === "CARD" && error.status === 400) {
    return new PaymentServiceError("O cartão não foi autorizado. Confira os dados ou tente outro cartão.", 400);
  }
  return new PaymentServiceError("A Appmax não conseguiu processar este pagamento agora.", 502);
}

function validRequestKey(value: string) {
  return /^[A-Za-z0-9:_-]{16,100}$/.test(value);
}

export async function createPayment(input: CreatePaymentInput) {
  if (!validRequestKey(input.requestKey)) throw new PaymentServiceError("Identificador da tentativa inválido.");
  if (!isIP(input.customerIp)) throw new PaymentServiceError("Não foi possível validar a conexão do dispositivo.");

  const prismaMethod = paymentMethod(input.method);
  const previous = await prisma.payment.findUnique({ where: { requestKey: input.requestKey } });
  if (previous) {
    if (previous.userId !== input.userId || previous.method !== prismaMethod) {
      throw new PaymentServiceError("Esta tentativa de pagamento não é válida.", 409);
    }
    if (previous.status === PaymentStatus.FAILED) {
      throw new PaymentServiceError(previous.lastError ?? "A tentativa anterior não foi autorizada.", 409);
    }
    return publicPayment(previous);
  }

  const account = await prisma.user.findUnique({
    where: { id: input.userId },
    include: { subscription: true },
  });
  if (!account || account.role !== UserRole.STUDENT || !account.active || !account.subscription) {
    throw new PaymentServiceError("A assinatura deste aluno não está disponível.", 404);
  }
  if (!account.phone || !account.cpf) {
    throw new PaymentServiceError("Complete o telefone e o CPF antes de gerar o pagamento.", 422);
  }

  const amountCents = input.amountCents ?? account.subscription.priceCents;
  if (!Number.isInteger(amountCents) || amountCents < 100 || amountCents > 10_000_000) {
    throw new PaymentServiceError("O valor da cobrança é inválido.");
  }

  if (input.paymentLinkId) {
    const link = await prisma.paymentLink.findUnique({
      where: { id: input.paymentLinkId },
      select: { userId: true, amountCents: true, status: true },
    });
    if (!link || link.userId !== account.id || link.amountCents !== amountCents || link.status !== "OPEN") {
      throw new PaymentServiceError("O link de pagamento não está mais disponível.", 409);
    }
  }

  if (input.method !== "CARD") {
    const reusable = await prisma.payment.findFirst({
      where: {
        userId: account.id,
        subscriptionId: account.subscription.id,
        method: prismaMethod,
        status: PaymentStatus.PENDING,
        expiresAt: { gt: new Date() },
        ...(input.paymentLinkId ? { paymentLinkId: input.paymentLinkId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    const hasInstructions = input.method === "PIX"
      ? Boolean(reusable?.pixCopyPaste)
      : Boolean(reusable?.boletoUrl || reusable?.boletoDigitableLine);
    if (reusable && hasInstructions) return publicPayment(reusable);
  }

  const checkoutConfig = await getAppmaxCheckoutConfig();
  if (!checkoutConfig.enabled) {
    throw new PaymentServiceError("O gateway de pagamento ainda não foi configurado.", 503);
  }
  if (input.method === "CARD") {
    if (!checkoutConfig.externalId) throw new PaymentServiceError("A tokenização de cartão ainda não foi configurada.", 503);
    if (!input.cardToken || input.cardToken.length < 16 || input.cardToken.length > 200) {
      throw new PaymentServiceError("O token do cartão é inválido.");
    }
    if (!input.holderName || input.holderName.trim().length < 2 || input.holderName.length > 120) {
      throw new PaymentServiceError("Informe o nome do titular do cartão.");
    }
    if (!input.holderDocumentNumber || !/^\d{11,14}$/.test(input.holderDocumentNumber)) {
      throw new PaymentServiceError("Informe o documento do titular do cartão.");
    }
  }

  const recurringRequested = checkoutConfig.recurrenceEnabled && input.method !== "BOLETO";
  const payment = await prisma.payment.create({
    data: {
      userId: account.id,
      subscriptionId: account.subscription.id,
      paymentLinkId: input.paymentLinkId,
      requestKey: input.requestKey,
      amountCents,
      status: PaymentStatus.PENDING,
      method: prismaMethod,
      dueAt: account.subscription.nextBillingAt ?? new Date(),
      recurringRequested,
    },
  });

  try {
    const product = {
      sku: "PACELAB-MENSAL",
      name: account.subscription.planName,
      unitValue: amountCents,
    };
    const { firstName, lastName } = splitName(account.name);
    const customer = await createAppmaxCustomer({
      firstName,
      lastName,
      email: account.email,
      phone: account.phone,
      documentNumber: account.cpf,
      ip: input.customerIp,
      product,
    });
    await prisma.subscription.update({
      where: { id: account.subscription.id },
      data: { providerCustomerId: customer.id },
    });

    const order = await createAppmaxOrder({
      customerId: customer.id,
      amountCents,
      sku: product.sku,
      productName: product.name,
    });
    await prisma.payment.update({
      where: { id: payment.id },
      data: { providerOrderId: order.id, providerStatus: order.status },
    });

    if (input.method === "PIX") {
      const pix = await createAppmaxPix({ orderId: order.id, documentNumber: account.cpf });
      if (!pix.emv) throw new AppmaxError("A Appmax não retornou o código Pix.", 502);
      const updated = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          providerPaymentId: pix.paymentId,
          providerStatus: pix.status,
          pixCopyPaste: pix.emv,
          pixQrCode: normalizeQrCode(pix.qrCode),
          expiresAt: parseProviderExpiration(pix.expiresAt, 30 * 60 * 1000),
        },
      });
      if (pix.subscriptionId) {
        await prisma.subscription.update({
          where: { id: account.subscription.id },
          data: {
            providerSubscriptionId: pix.subscriptionId,
            recurringEnabled: recurringRequested,
            recurringMethod: recurringRequested ? PaymentMethod.PIX : null,
          },
        });
      }
      return publicPayment(updated);
    }

    if (input.method === "BOLETO") {
      const boleto = await createAppmaxBoleto({ orderId: order.id, documentNumber: account.cpf });
      if (!boleto.url && !boleto.digitableLine) throw new AppmaxError("A Appmax não retornou o boleto.", 502);
      const updated = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          providerPaymentId: boleto.paymentId,
          providerStatus: boleto.status,
          boletoUrl: boleto.url,
          boletoDigitableLine: boleto.digitableLine,
          expiresAt: parseProviderExpiration(boleto.dueDate, 3 * 24 * 60 * 60 * 1000),
        },
      });
      return publicPayment(updated);
    }

    const card = await createAppmaxCard({
      orderId: order.id,
      customerId: customer.id,
      cardToken: input.cardToken!,
      holderDocumentNumber: input.holderDocumentNumber!,
      holderName: input.holderName!.trim(),
    });
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerPaymentId: card.paymentId,
        providerStatus: card.status,
      },
    });
    if (card.subscriptionId) {
      await prisma.subscription.update({
        where: { id: account.subscription.id },
        data: {
          providerSubscriptionId: card.subscriptionId,
          recurringEnabled: recurringRequested,
          recurringMethod: recurringRequested ? PaymentMethod.CARD : null,
        },
      });
    }

    const synchronized = await synchronizeAppmaxOrder(order.id);
    return publicPayment(synchronized ?? await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }));
  } catch (error) {
    const mapped = userFacingProviderError(error, input.method);
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.FAILED,
        lastError: mapped.message.slice(0, 240),
      },
    }).catch(() => undefined);
    throw mapped;
  }
}

function normalizedProviderStatus(value: string) {
  return value.trim().toLowerCase();
}

export async function synchronizeAppmaxOrder(orderId: string, eventName?: string) {
  const snapshot = await getAppmaxOrder(orderId);
  const payment = await prisma.payment.findUnique({ where: { providerOrderId: snapshot.id } });
  if (!payment) return null;

  const providerStatus = normalizedProviderStatus(snapshot.status);
  const paidStatuses = new Set(["aprovado", "integrado", "pendente_integracao"]);
  const failedStatuses = new Set(["cancelado", "recusado_por_risco"]);
  const paid = paidStatuses.has(providerStatus);
  const refunded = providerStatus === "estornado";
  const expired = failedStatuses.has(providerStatus)
    && (eventName === "order_pix_expired" || eventName === "order_billet_overdue");
  const failed = failedStatuses.has(providerStatus) && !expired;

  if (paid && snapshot.totalPaid !== null && snapshot.totalPaid !== payment.amountCents) {
    throw new PaymentServiceError("O valor confirmado pela Appmax não corresponde à cobrança local.", 409);
  }

  const paidAt = safeDate(snapshot.paidAt) ?? new Date();
  return prisma.$transaction(async (transaction) => {
    const current = await transaction.payment.findUniqueOrThrow({ where: { id: payment.id } });
    let nextStatus = current.status;
    if (paid) nextStatus = PaymentStatus.PAID;
    else if (refunded) nextStatus = PaymentStatus.REFUNDED;
    else if (expired) nextStatus = PaymentStatus.EXPIRED;
    else if (failed) nextStatus = PaymentStatus.FAILED;
    else nextStatus = PaymentStatus.PENDING;

    const updated = await transaction.payment.update({
      where: { id: current.id },
      data: {
        status: nextStatus,
        providerStatus: snapshot.status,
        providerPaymentId: snapshot.paymentId ?? current.providerPaymentId,
        paidAt: paid ? (current.paidAt ?? paidAt) : current.paidAt,
        expiresAt: expired ? (current.expiresAt ?? new Date()) : current.expiresAt,
        lastError: failed ? "Pagamento não autorizado pela Appmax." : null,
      },
    });

    if (current.subscriptionId && paid && current.status !== PaymentStatus.PAID) {
      await transaction.subscription.update({
        where: { id: current.subscriptionId },
        data: {
          status: SubscriptionStatus.ACTIVE,
          nextBillingAt: addMonths(paidAt),
          providerCustomerId: snapshot.customerId ?? undefined,
          recurringEnabled: current.recurringRequested,
          recurringMethod: current.recurringRequested ? current.method : undefined,
        },
      });
      if (current.paymentLinkId) {
        await transaction.paymentLink.update({
          where: { id: current.paymentLinkId },
          data: { status: "COMPLETED", completedAt: paidAt },
        });
      }
    } else if (current.subscriptionId && (refunded || failed || expired)) {
      const subscription = await transaction.subscription.findUnique({ where: { id: current.subscriptionId } });
      const shouldMarkPastDue = subscription?.status === SubscriptionStatus.ACTIVE
        && (refunded || Boolean(subscription.nextBillingAt && subscription.nextBillingAt <= new Date()));
      if (shouldMarkPastDue) {
        await transaction.subscription.update({
          where: { id: current.subscriptionId },
          data: { status: SubscriptionStatus.PAST_DUE },
        });
      }
    }
    return updated;
  });
}

export function paymentErrorResponse(error: unknown) {
  if (error instanceof PaymentServiceError) {
    return { message: error.message, status: error.status };
  }
  return { message: "Não foi possível processar o pagamento.", status: 500 };
}
