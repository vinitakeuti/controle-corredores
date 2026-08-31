import { GatewayEventStatus, PaymentMethod, PaymentStatus, SubscriptionStatus } from "@prisma/client";
import { getAsaasPayment } from "@/lib/asaas";
import { synchronizeAsaasPayment } from "@/lib/payment-service";
import { sendPaymentNotification } from "@/lib/email";
import { prisma } from "@/lib/prisma";

function addMonths(date: Date, count = 1) {
  const result = new Date(date);
  const originalDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + count);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, lastDay));
  return result;
}

function dateValue(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function processAutomaticPixAuthorization(event: {
  providerSubscriptionId: string | null;
  eventName: string;
  occurredAt: Date | null;
}) {
  if (!event.providerSubscriptionId) return false;
  const subscription = await prisma.subscription.findUnique({
    where: { asaasPixAuthorizationId: event.providerSubscriptionId },
    select: { id: true, userId: true, nextBillingAt: true, status: true },
  });
  if (!subscription) return false;

  const status = event.eventName.replace("PIX_AUTOMATIC_RECURRING_AUTHORIZATION_", "");
  const activated = status === "ACTIVATED";
  const inactive = status === "CANCELLED" || status === "EXPIRED" || status === "REFUSED";
  const notification: { current: { paymentId: string; type: "paid" | "failed" } | null } = { current: null };
  await prisma.$transaction(async (transaction) => {
    if (activated) {
      const paidAt = event.occurredAt ?? new Date();
      await transaction.subscription.update({
        where: { id: subscription.id },
        data: {
          status: SubscriptionStatus.ACTIVE,
          nextBillingAt: addMonths(subscription.nextBillingAt && subscription.nextBillingAt > paidAt
            ? subscription.nextBillingAt
            : paidAt),
          asaasPixAuthorizationStatus: "ACTIVE",
          recurringEnabled: true,
          recurringMethod: PaymentMethod.PIX,
        },
      });
      const initialPayment = await transaction.payment.findFirst({
        where: {
          subscriptionId: subscription.id,
          provider: "ASAAS",
          providerOrderId: `pix-automatic:${event.providerSubscriptionId}`,
          status: PaymentStatus.PENDING,
        },
        select: { id: true, paymentLinkId: true },
      });
      if (initialPayment) {
        await transaction.payment.update({
          where: { id: initialPayment.id },
          data: { status: PaymentStatus.PAID, providerStatus: "PIX_AUTOMATIC_ACTIVE", paidAt },
        });
        if (initialPayment.paymentLinkId) {
          await transaction.paymentLink.update({
            where: { id: initialPayment.paymentLinkId },
            data: { status: "COMPLETED", completedAt: paidAt },
          });
        }
        notification.current = { paymentId: initialPayment.id, type: "paid" };
      }
      return;
    }

    await transaction.subscription.update({
      where: { id: subscription.id },
      data: {
        asaasPixAuthorizationStatus: status,
        recurringEnabled: false,
        recurringMethod: null,
      },
    });
    if (inactive) {
      const failedPayments = await transaction.payment.findMany({
        where: {
          subscriptionId: subscription.id,
          provider: "ASAAS",
          providerOrderId: `pix-automatic:${event.providerSubscriptionId}`,
          status: PaymentStatus.PENDING,
        },
        select: { id: true },
      });
      if (failedPayments[0]) notification.current = { paymentId: failedPayments[0].id, type: "failed" };
      await transaction.payment.updateMany({ where: { id: { in: failedPayments.map((payment) => payment.id) } }, data: { status: PaymentStatus.FAILED, providerStatus: `PIX_AUTOMATIC_${status}`, lastError: "A autorização do Pix Automático não foi concluída." } });
    }
  });
  if (notification.current) await sendPaymentNotification(notification.current.paymentId, notification.current.type).catch(() => undefined);
  return true;
}

async function processAutomaticPixInstruction(event: {
  providerOrderId: string | null;
  providerSubscriptionId: string | null;
  eventName: string;
}) {
  if (!event.providerOrderId || !event.providerSubscriptionId) return false;
  const subscription = await prisma.subscription.findUnique({
    where: { asaasPixAuthorizationId: event.providerSubscriptionId },
    select: { id: true, userId: true },
  });
  if (!subscription) return false;

  const instructionStatus = event.eventName.replace("PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_", "");
  const snapshot = await getAsaasPayment(event.providerOrderId);
  if (snapshot.billingType !== "PIX" || snapshot.valueCents === null) {
    throw new Error("A instrução de Pix Automático não corresponde a uma cobrança Pix válida.");
  }
  const payment = await prisma.payment.upsert({
    where: { provider_providerOrderId: { provider: "ASAAS", providerOrderId: snapshot.id } },
    update: {},
    create: {
      userId: subscription.userId,
      subscriptionId: subscription.id,
      amountCents: snapshot.valueCents,
      status: PaymentStatus.PENDING,
      method: PaymentMethod.PIX,
      dueAt: dateValue(snapshot.dueDate) ?? new Date(),
      recurringRequested: true,
      provider: "ASAAS",
      providerOrderId: snapshot.id,
      providerPaymentId: snapshot.id,
      providerStatus: `PIX_AUTOMATIC_${instructionStatus}`,
    },
  });
  if (instructionStatus === "REFUSED" || instructionStatus === "CANCELLED") {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.FAILED,
        providerStatus: `PIX_AUTOMATIC_${instructionStatus}`,
        lastError: "O débito automático Pix não foi concluído.",
      },
    });
    await sendPaymentNotification(payment.id, "failed").catch(() => undefined);
    return true;
  }
  await synchronizeAsaasPayment(snapshot.id, event.eventName);
  return true;
}

export async function processAsaasGatewayEvent(eventId: string) {
  const event = await prisma.gatewayEvent.findUnique({ where: { id: eventId } });
  if (!event || event.provider !== "ASAAS") return;
  if (event.status === GatewayEventStatus.PROCESSED || event.status === GatewayEventStatus.IGNORED) return;

  try {
    if (event.eventType === "pix_automatic_authorization") {
      const processed = await processAutomaticPixAuthorization(event);
      await prisma.gatewayEvent.update({
        where: { id: event.id },
        data: { status: processed ? GatewayEventStatus.PROCESSED : GatewayEventStatus.IGNORED, processedAt: new Date(), error: null },
      });
      return;
    }

    if (event.eventType === "pix_automatic_instruction") {
      const processed = await processAutomaticPixInstruction(event);
      await prisma.gatewayEvent.update({
        where: { id: event.id },
        data: { status: processed ? GatewayEventStatus.PROCESSED : GatewayEventStatus.IGNORED, processedAt: new Date(), error: null },
      });
      return;
    }

    if (event.eventType !== "payment" || !event.providerOrderId) {
      await prisma.gatewayEvent.update({
        where: { id: event.id },
        data: { status: GatewayEventStatus.IGNORED, processedAt: new Date(), error: null },
      });
      return;
    }

    const localPayment = await prisma.payment.findFirst({
      where: { provider: "ASAAS", providerOrderId: event.providerOrderId },
      select: { id: true },
    });
    if (!localPayment) {
      await prisma.gatewayEvent.update({
        where: { id: event.id },
        data: { status: GatewayEventStatus.IGNORED, processedAt: new Date(), error: null },
      });
      return;
    }

    const payment = await synchronizeAsaasPayment(event.providerOrderId, event.eventName);
    await prisma.gatewayEvent.update({
      where: { id: event.id },
      data: {
        status: payment ? GatewayEventStatus.PROCESSED : GatewayEventStatus.IGNORED,
        processedAt: new Date(),
        error: null,
      },
    });
  } catch (error) {
    await prisma.gatewayEvent.update({
      where: { id: event.id },
      data: {
        status: GatewayEventStatus.FAILED,
        error: error instanceof Error ? error.message.slice(0, 240) : "Webhook processing failed",
      },
    }).catch(() => undefined);
    console.error("Asaas webhook processing failed", { eventId: event.id, eventName: event.eventName });
    throw error;
  }
}
