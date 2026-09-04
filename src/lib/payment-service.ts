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
import {
  AsaasError,
  createAsaasAutomaticPixAuthorization,
  createAsaasPayment,
  ensureAsaasCustomer,
  findAsaasPaymentByExternalReference,
  getAsaasPayment,
  getAsaasPixQrCode,
} from "@/lib/asaas";
import { getActivePaymentProvider } from "@/lib/integration-directory";
import { sendPaymentNotification } from "@/lib/email";
import { periodMonths, subscriptionChargeCents, subscriptionCycleMonths } from "@/lib/plan-billing";
import { prisma } from "@/lib/prisma";

export type AppmaxPaymentMethod = "PIX" | "BOLETO" | "CARD";

export type CreatePaymentInput = {
  userId: string;
  paymentLinkId?: string;
  amountCents?: number;
  method: AppmaxPaymentMethod;
  expectedProvider?: "APPMAX" | "ASAAS";
  requestKey: string;
  customerIp: string;
  cardToken?: string;
  holderName?: string;
  holderDocumentNumber?: string;
  automaticPix?: boolean;
  installmentCount?: number;
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
    provider: payment.provider,
    status: payment.status,
    providerStatus: payment.providerStatus,
    recurringRequested: payment.recurringRequested,
    expiresAt: payment.expiresAt,
    checkoutUrl: payment.checkoutUrl,
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

function userFacingProviderError(error: unknown, method: AppmaxPaymentMethod, automaticPix = false) {
  if (error instanceof PaymentServiceError) return error;
  if (error instanceof AsaasError) {
    const detail = error.providerMessage?.replace(/\s+/g, " ").trim().slice(0, 180);
    if (error.status === 401 || error.status === 403 || error.status === 503) {
      if (method === "PIX" && automaticPix && error.status === 403) {
        return new PaymentServiceError("O Pix Automático não está habilitado para esta conta ou chave do Asaas.", 503);
      }
      return new PaymentServiceError("O gateway de pagamento ainda não está configurado corretamente.", 503);
    }
    if (error.status === 400 || error.status === 422) {
      return new PaymentServiceError(`O Asaas recusou os dados da cobrança.${detail ? ` ${detail}` : " Confira o cadastro e tente novamente."}`, 422);
    }
    return new PaymentServiceError("O Asaas não conseguiu processar este pagamento agora.", 502);
  }
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

  const activeProvider = await getActivePaymentProvider();
  if (activeProvider !== "APPMAX" && activeProvider !== "ASAAS") {
    throw new PaymentServiceError("O gateway de pagamento ainda não foi configurado.", 503);
  }
  if (input.expectedProvider && input.expectedProvider !== activeProvider) {
    throw new PaymentServiceError("O provedor de pagamento mudou. Recarregue a página e tente novamente.", 409);
  }
  if (input.automaticPix && (activeProvider !== "ASAAS" || input.method !== "PIX")) {
    throw new PaymentServiceError("Pix Automático está disponível apenas para pagamentos Pix pelo Asaas.");
  }

  const prismaMethod = paymentMethod(input.method);
  const previous = await prisma.payment.findUnique({ where: { requestKey: input.requestKey } });
  if (previous) {
    if (previous.userId !== input.userId || previous.method !== prismaMethod || previous.provider !== activeProvider) {
      throw new PaymentServiceError("Esta tentativa de pagamento não é válida.", 409);
    }
    if (previous.status === PaymentStatus.FAILED) {
      throw new PaymentServiceError(previous.lastError ?? "A tentativa anterior não foi autorizada.", 409);
    }
    const hasInstructions = previous.method === PaymentMethod.PIX
      ? Boolean(previous.pixCopyPaste)
      : previous.method === PaymentMethod.BOLETO
        ? Boolean(previous.boletoUrl || previous.boletoDigitableLine)
        : previous.provider === "ASAAS"
          ? Boolean(previous.checkoutUrl)
          : true;
    const instructionsCurrent = previous.provider !== "ASAAS"
      || previous.method !== PaymentMethod.PIX
      || !previous.expiresAt
      || previous.expiresAt > new Date();
    if (previous.status !== PaymentStatus.PENDING || (hasInstructions && instructionsCurrent)) {
      return publicPayment(previous);
    }
  }

  const account = await prisma.user.findUnique({
    where: { id: input.userId },
    include: { subscription: true },
  });
  if (!account || account.role !== UserRole.STUDENT || !account.active || !account.subscription) {
    throw new PaymentServiceError("A assinatura deste aluno não está disponível.", 404);
  }
  if (!account.subscription.planId) {
    throw new PaymentServiceError("Escolha um plano antes de gerar o pagamento.", 409);
  }
  if (!account.subscription.allowedMethods.includes(prismaMethod) && !(input.automaticPix && account.subscription.automaticPixEnabled)) {
    throw new PaymentServiceError("Este método de pagamento não está disponível para esta assinatura.", 403);
  }
  if (!account.phone || !account.cpf) {
    throw new PaymentServiceError("Complete o telefone e o CPF antes de gerar o pagamento.", 422);
  }

  const expectedAmountCents = subscriptionChargeCents(account.subscription.priceCents, account.subscription.billingPeriod, account.subscription.manualMonthlyBilling);
  const amountCents = input.amountCents ?? expectedAmountCents;
  if (!Number.isInteger(amountCents) || amountCents < 100 || amountCents > 10_000_000) {
    throw new PaymentServiceError("O valor da cobrança é inválido.");
  }
  if (amountCents !== expectedAmountCents) {
    throw new PaymentServiceError("O valor desta cobrança não corresponde ao plano selecionado.", 409);
  }
  const installmentCount = input.installmentCount ?? 1;
  const maxInstallments = account.subscription.manualMonthlyBilling ? 1 : periodMonths[account.subscription.billingPeriod];
  if (!Number.isInteger(installmentCount) || installmentCount < 1 || installmentCount > maxInstallments) {
    throw new PaymentServiceError(`Escolha entre 1 e ${maxInstallments} parcela${maxInstallments === 1 ? "" : "s"}.`);
  }
  if (input.method !== "CARD" && installmentCount !== 1) {
    throw new PaymentServiceError("Parcelamento está disponível apenas no cartão.");
  }
  if (input.automaticPix && installmentCount !== 1) {
    throw new PaymentServiceError("Pix Automático não pode ser parcelado.");
  }
  if (input.automaticPix && !account.subscription.automaticPixEnabled) {
    throw new PaymentServiceError("Pix Automático não está disponível para este plano.", 409);
  }
  if (previous && (
    previous.amountCents !== amountCents
    || previous.installmentCount !== installmentCount
    || previous.subscriptionId !== account.subscription.id
    || previous.paymentLinkId !== (input.paymentLinkId ?? null)
  )) {
    throw new PaymentServiceError("Esta tentativa de pagamento não corresponde à cobrança solicitada.", 409);
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

  let reusablePayment: Payment | null = null;
  if (input.method !== "CARD" || activeProvider === "ASAAS") {
    const reusable = await prisma.payment.findFirst({
      where: {
        userId: account.id,
        subscriptionId: account.subscription.id,
        provider: activeProvider,
        method: prismaMethod,
        amountCents,
        installmentCount,
        status: PaymentStatus.PENDING,
        ...(activeProvider === "ASAAS" && input.method === "PIX"
          ? input.automaticPix ? { providerOrderId: { startsWith: "pix-automatic:" } } : { NOT: { providerOrderId: { startsWith: "pix-automatic:" } } }
          : {}),
        ...(activeProvider === "APPMAX" ? { expiresAt: { gt: new Date() } } : {}),
        paymentLinkId: input.paymentLinkId ?? null,
      },
      orderBy: { createdAt: "desc" },
    });
    const hasInstructions = input.method === "PIX"
      ? Boolean(reusable?.pixCopyPaste)
      : input.method === "BOLETO"
        ? Boolean(reusable?.boletoUrl || reusable?.boletoDigitableLine)
        : Boolean(reusable?.checkoutUrl);
    const instructionsCurrent = activeProvider !== "ASAAS"
      || input.method !== "PIX"
      || !reusable?.expiresAt
      || reusable.expiresAt > new Date();
    if (reusable && hasInstructions && instructionsCurrent) return publicPayment(reusable);
    if (activeProvider === "ASAAS" && reusable) reusablePayment = reusable;
  }

  const checkoutConfig = activeProvider === "APPMAX" ? await getAppmaxCheckoutConfig() : null;
  if (activeProvider === "APPMAX") {
    if (installmentCount > 1) {
      throw new PaymentServiceError("O parcelamento no cartão está disponível apenas pelo checkout Asaas.", 409);
    }
    if (!checkoutConfig?.enabled) {
      throw new PaymentServiceError("O gateway de pagamento ainda não foi configurado.", 503);
    }
    if (!isIP(input.customerIp)) throw new PaymentServiceError("Não foi possível validar a conexão do dispositivo.");
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
  }

  const recurringRequested = account.subscription.manualMonthlyBilling
    ? false
    : activeProvider === "ASAAS"
      ? Boolean(input.automaticPix)
      : Boolean(checkoutConfig?.recurrenceEnabled && input.method !== "BOLETO");
  const payment = previous ?? reusablePayment ?? await prisma.payment.create({
    data: {
      userId: account.id,
      subscriptionId: account.subscription.id,
      paymentLinkId: input.paymentLinkId,
      requestKey: input.requestKey,
      amountCents,
      installmentCount,
      status: PaymentStatus.PENDING,
      method: prismaMethod,
      dueAt: account.subscription.nextBillingAt ?? new Date(),
      recurringRequested,
      provider: activeProvider,
    },
  });

  try {
    if (activeProvider === "ASAAS") {
      let customerId = account.asaasCustomerId;
      if (!customerId) {
        const customer = await ensureAsaasCustomer({
          userId: account.id,
          name: account.name,
          email: account.email,
          phone: account.phone,
          cpf: account.cpf,
        });
        await prisma.user.updateMany({
          where: { id: account.id, asaasCustomerId: null },
          data: { asaasCustomerId: customer.id },
        });
        const mapped = await prisma.user.findUnique({
          where: { id: account.id },
          select: { asaasCustomerId: true },
        });
        customerId = mapped?.asaasCustomerId ?? customer.id;
      }

      if (input.method === "PIX" && input.automaticPix) {
        if (account.subscription.asaasPixAuthorizationId && account.subscription.recurringEnabled) {
          throw new PaymentServiceError("O Pix Automático já está ativo para esta assinatura. As próximas mensalidades serão debitadas na data programada.", 409);
        }

        if (payment.providerOrderId?.startsWith("pix-automatic:")) {
          return publicPayment(payment);
        }

        const authorization = await createAsaasAutomaticPixAuthorization({
          customerId,
          contractId: payment.id,
          amountCents,
          description: account.subscription.planName,
          startDate: account.subscription.nextBillingAt && account.subscription.nextBillingAt > new Date()
            ? account.subscription.nextBillingAt
            : new Date(),
          billingPeriod: account.subscription.billingPeriod,
        });
        const updated = await prisma.$transaction(async (transaction) => {
          await transaction.subscription.update({
            where: { id: account.subscription!.id },
            data: {
              asaasPixAuthorizationId: authorization.id,
              asaasPixAuthorizationStatus: authorization.status,
              recurringEnabled: false,
              recurringMethod: PaymentMethod.PIX,
            },
          });
          return transaction.payment.update({
            where: { id: payment.id },
            data: {
              providerOrderId: `pix-automatic:${authorization.id}`,
              providerStatus: authorization.status,
              pixCopyPaste: authorization.copyPaste,
              pixQrCode: authorization.encodedImage ? normalizeQrCode(authorization.encodedImage) : null,
              expiresAt: parseProviderExpiration(authorization.expirationDate, 24 * 60 * 60 * 1000),
            },
          });
        });
        return publicPayment(updated);
      }

      const billingType = input.method === "PIX" ? "PIX" : input.method === "BOLETO" ? "BOLETO" : "CREDIT_CARD";
      let charge: Awaited<ReturnType<typeof createAsaasPayment>> | null = null;
      if (payment.providerOrderId) {
        const snapshot = await getAsaasPayment(payment.providerOrderId);
        charge = { id: snapshot.id, status: snapshot.status, invoiceUrl: snapshot.invoiceUrl, dueDate: snapshot.dueDate };
      } else {
        if (previous || reusablePayment) {
          charge = await findAsaasPaymentByExternalReference({
            externalReference: payment.id,
            customerId,
            billingType,
            amountCents,
            installmentCount,
          });
        }
        if (!charge) {
          try {
            charge = await createAsaasPayment({
              customerId,
              billingType,
              amountCents,
              description: account.subscription.planName,
              externalReference: payment.id,
              installmentCount,
            });
          } catch (error) {
            if (error instanceof AsaasError && error.status >= 500) {
              charge = await findAsaasPaymentByExternalReference({
                externalReference: payment.id,
                customerId,
                billingType,
                amountCents,
                installmentCount,
              }).catch(() => null);
            }
            if (!charge) throw error;
          }
        }
      }

      if (input.method === "CARD" && !charge.invoiceUrl) {
        throw new AsaasError("O Asaas não retornou a Fatura do cartão.", 502);
      }

      const baseData = {
        providerOrderId: charge.id,
        providerPaymentId: charge.id,
        providerStatus: charge.status,
        checkoutUrl: input.method === "CARD" ? charge.invoiceUrl : null,
      };
      await prisma.payment.update({ where: { id: payment.id }, data: baseData });
      if (input.method === "CARD") {
        const updated = await prisma.payment.update({
          where: { id: payment.id },
          data: { ...baseData, expiresAt: null },
        });
        return publicPayment(updated);
      }

      if (input.method === "BOLETO") {
        if (!charge.invoiceUrl) throw new AsaasError("O Asaas não retornou o boleto.", 502);
        const updated = await prisma.payment.update({
          where: { id: payment.id },
          data: {
            ...baseData,
            boletoUrl: charge.invoiceUrl,
            expiresAt: parseProviderExpiration(charge.dueDate, 3 * 24 * 60 * 60 * 1000),
          },
        });
        return publicPayment(updated);
      }

      const pix = await getAsaasPixQrCode(charge.id);
      const updated = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          ...baseData,
          pixCopyPaste: pix.copyPaste,
          pixQrCode: pix.encodedImage ? normalizeQrCode(pix.encodedImage) : null,
          expiresAt: parseProviderExpiration(pix.expirationDate, 24 * 60 * 60 * 1000),
        },
      });
      return publicPayment(updated);
    }

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
    const mapped = userFacingProviderError(error, input.method, input.automaticPix);
    const latest = activeProvider === "ASAAS"
      ? await prisma.payment.findUnique({ where: { id: payment.id }, select: { providerOrderId: true } }).catch(() => null)
      : null;
    const keepPending = activeProvider === "ASAAS" && (Boolean(latest?.providerOrderId) || mapped.status >= 500);
    const failedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: keepPending ? PaymentStatus.PENDING : PaymentStatus.FAILED,
        lastError: mapped.message.slice(0, 240),
      },
    }).catch(() => undefined);
    if (failedPayment && !keepPending) await sendPaymentNotification(failedPayment.id, "failed").catch(() => undefined);
    throw mapped;
  }
}

function normalizedProviderStatus(value: string) {
  return value.trim().toLowerCase();
}

export async function synchronizeAppmaxOrder(orderId: string, eventName?: string) {
  const snapshot = await getAppmaxOrder(orderId);
  const payment = await prisma.payment.findFirst({
    where: { provider: "APPMAX", providerOrderId: snapshot.id },
  });
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
  let notification: "paid" | "failed" | null = null;
  const updated = await prisma.$transaction(async (transaction) => {
    const current = await transaction.payment.findUniqueOrThrow({ where: { id: payment.id } });
    let nextStatus = current.status;
    if (current.status === PaymentStatus.REFUNDED) nextStatus = PaymentStatus.REFUNDED;
    else if (refunded) nextStatus = PaymentStatus.REFUNDED;
    else if (paid) nextStatus = PaymentStatus.PAID;
    else if (expired) nextStatus = PaymentStatus.EXPIRED;
    else if (failed) nextStatus = PaymentStatus.FAILED;
    else if (current.status === PaymentStatus.PENDING) nextStatus = PaymentStatus.PENDING;

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

    const becamePaid = current.status !== PaymentStatus.PAID && nextStatus === PaymentStatus.PAID;
    if (becamePaid) notification = "paid";
    else if (current.status !== PaymentStatus.FAILED && nextStatus === PaymentStatus.FAILED) notification = "failed";
    if (current.subscriptionId && becamePaid) {
      const subscription = await transaction.subscription.findUnique({ where: { id: current.subscriptionId }, select: { billingPeriod: true, manualMonthlyBilling: true } });
      await transaction.subscription.update({
        where: { id: current.subscriptionId },
        data: {
          status: SubscriptionStatus.ACTIVE,
          nextBillingAt: addMonths(paidAt, subscriptionCycleMonths(subscription?.billingPeriod ?? "MONTHLY", subscription?.manualMonthlyBilling)),
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
  if (notification) await sendPaymentNotification(updated.id, notification).catch(() => undefined);
  return updated;
}

export async function synchronizeAsaasPayment(paymentId: string, eventName?: string) {
  const snapshot = await getAsaasPayment(paymentId);
  const payment = await prisma.payment.findFirst({
    where: { provider: "ASAAS", providerOrderId: snapshot.id },
  });
  if (!payment) return null;

  const providerStatus = snapshot.status.trim().toUpperCase();
  const normalizedEvent = eventName?.trim().toUpperCase() ?? "";
  const paid = providerStatus === "RECEIVED"
    || (payment.method === PaymentMethod.CARD && providerStatus === "CONFIRMED");
  // O snapshot consultado na API é a fonte de verdade. Um evento atrasado de
  // chargeback não pode sobrescrever uma cobrança que já foi revertida.
  const refunded = providerStatus === "REFUNDED" || providerStatus.startsWith("CHARGEBACK");
  // Uma cobrança vencida ainda pode ser paga no Asaas. Só encerramos a
  // tentativa quando a cobrança foi efetivamente removida.
  const expired = providerStatus === "DELETED" || normalizedEvent === "PAYMENT_DELETED";
  // Uma captura recusada pode ser tentada novamente na mesma fatura. Só
  // encerramos localmente quando o próprio snapshot remoto é terminal.
  const failed = providerStatus === "REPROVED_BY_RISK_ANALYSIS";

  const expectedBillingType = payment.method === PaymentMethod.CARD ? "CREDIT_CARD" : "PIX";
  if (snapshot.billingType !== expectedBillingType) {
    throw new PaymentServiceError("O método confirmado pelo Asaas não corresponde à cobrança local.", 409);
  }
  const minimumInstallmentCents = Math.floor(payment.amountCents / payment.installmentCount);
  const maximumInstallmentCents = Math.ceil(payment.amountCents / payment.installmentCount);
  const validPaidAmount = payment.installmentCount === 1
    ? snapshot.valueCents === payment.amountCents
    : snapshot.valueCents !== null && snapshot.valueCents >= minimumInstallmentCents && snapshot.valueCents <= maximumInstallmentCents;
  if (paid && !validPaidAmount) {
    throw new PaymentServiceError("O valor confirmado pelo Asaas não corresponde à cobrança local.", 409);
  }

  const paidAt = safeDate(snapshot.clientPaymentDate)
    ?? safeDate(snapshot.paymentDate)
    ?? safeDate(snapshot.confirmedDate)
    ?? new Date();
  let notification: "paid" | "failed" | null = null;
  const updated = await prisma.$transaction(async (transaction) => {
    const current = await transaction.payment.findUniqueOrThrow({ where: { id: payment.id } });
    let nextStatus = current.status;
    if (refunded) nextStatus = PaymentStatus.REFUNDED;
    else if (paid) nextStatus = PaymentStatus.PAID;
    else if (current.status === PaymentStatus.PAID) nextStatus = PaymentStatus.PAID;
    else if (current.status === PaymentStatus.REFUNDED) nextStatus = PaymentStatus.REFUNDED;
    else if (expired) nextStatus = PaymentStatus.EXPIRED;
    else if (failed) nextStatus = PaymentStatus.FAILED;
    else if (current.status === PaymentStatus.PENDING) nextStatus = PaymentStatus.PENDING;

    const updated = await transaction.payment.update({
      where: { id: current.id },
      data: {
        status: nextStatus,
        providerStatus: snapshot.status,
        providerPaymentId: snapshot.id,
        paidAt: nextStatus === PaymentStatus.PAID ? (current.paidAt ?? paidAt) : current.paidAt,
        expiresAt: expired ? (current.expiresAt ?? new Date()) : current.expiresAt,
        lastError: failed ? "Pagamento não autorizado pelo Asaas." : null,
      },
    });

    const becamePaid = current.status !== PaymentStatus.PAID && nextStatus === PaymentStatus.PAID;
    if (becamePaid) notification = "paid";
    else if (current.status !== PaymentStatus.FAILED && nextStatus === PaymentStatus.FAILED) notification = "failed";
    if (current.subscriptionId && becamePaid) {
      const subscription = await transaction.subscription.findUnique({ where: { id: current.subscriptionId }, select: { billingPeriod: true, manualMonthlyBilling: true } });
      await transaction.subscription.update({
        where: { id: current.subscriptionId },
        data: {
          status: SubscriptionStatus.ACTIVE,
          nextBillingAt: addMonths(paidAt, subscriptionCycleMonths(subscription?.billingPeriod ?? "MONTHLY", subscription?.manualMonthlyBilling)),
          recurringEnabled: current.recurringRequested,
          recurringMethod: current.recurringRequested ? current.method : null,
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
  if (notification) await sendPaymentNotification(updated.id, notification).catch(() => undefined);
  return updated;
}

export function paymentErrorResponse(error: unknown) {
  if (error instanceof PaymentServiceError) {
    return { message: error.message, status: error.status };
  }
  return { message: "Não foi possível processar o pagamento.", status: 500 };
}
