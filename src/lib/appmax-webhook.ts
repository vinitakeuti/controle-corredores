import {
  GatewayEventStatus,
  PaymentMethod,
  PaymentStatus,
  SubscriptionStatus,
} from "@prisma/client";
import { synchronizeAppmaxOrder } from "@/lib/payment-service";
import { subscriptionChargeCents, subscriptionCycleMonths } from "@/lib/plan-billing";
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

export async function processAppmaxGatewayEvent(eventId: string) {
  const event = await prisma.gatewayEvent.findUnique({ where: { id: eventId } });
  if (!event || event.status === GatewayEventStatus.PROCESSED || event.status === GatewayEventStatus.IGNORED) return;

  try {
    if (event.eventType === "order" && event.providerOrderId) {
      const payment = await synchronizeAppmaxOrder(event.providerOrderId, event.eventName);
      await prisma.gatewayEvent.update({
        where: { id: event.id },
        data: {
          status: payment ? GatewayEventStatus.PROCESSED : GatewayEventStatus.IGNORED,
          processedAt: new Date(),
          error: null,
        },
      });
      return;
    }

    if (event.eventType !== "subscription") {
      await prisma.gatewayEvent.update({
        where: { id: event.id },
        data: { status: GatewayEventStatus.IGNORED, processedAt: new Date(), error: null },
      });
      return;
    }

    const subscription = await prisma.subscription.findFirst({
      where: {
        OR: [
          ...(event.providerSubscriptionId ? [{ providerSubscriptionId: event.providerSubscriptionId }] : []),
          ...(event.providerCustomerId ? [{ providerCustomerId: event.providerCustomerId }] : []),
        ],
      },
      include: {
        payments: {
          where: { recurringRequested: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    if (!subscription) {
      await prisma.gatewayEvent.update({
        where: { id: event.id },
        data: { status: GatewayEventStatus.IGNORED, processedAt: new Date(), error: null },
      });
      return;
    }

    const occurredAt = event.occurredAt ?? new Date();
    if (event.eventName === "subscription_created") {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          providerSubscriptionId: event.providerSubscriptionId ?? subscription.providerSubscriptionId,
          providerCustomerId: event.providerCustomerId ?? subscription.providerCustomerId,
          recurringEnabled: true,
          recurringMethod: subscription.recurringMethod ?? subscription.payments[0]?.method,
        },
      });
    } else if (event.eventName === "subscription_charge_success") {
      const expectedAmountCents = subscriptionChargeCents(subscription.priceCents, subscription.billingPeriod, subscription.manualMonthlyBilling);
      const amountCents = event.amountCents ?? expectedAmountCents;
      if (amountCents !== expectedAmountCents) {
        throw new Error("Recurring charge amount does not match the subscription");
      }
      const method = subscription.recurringMethod ?? subscription.payments[0]?.method ?? PaymentMethod.CARD;
      await prisma.$transaction(async (transaction) => {
        await transaction.payment.upsert({
          where: { requestKey: `appmax:${event.eventKey}` },
          update: {},
          create: {
            userId: subscription.userId,
            subscriptionId: subscription.id,
            requestKey: `appmax:${event.eventKey}`,
            amountCents,
            method,
            status: PaymentStatus.PAID,
            dueAt: occurredAt,
            paidAt: occurredAt,
            recurringRequested: true,
            providerPaymentId: event.eventKey,
            providerStatus: event.eventName,
          },
        });
        await transaction.subscription.update({
          where: { id: subscription.id },
          data: {
            status: SubscriptionStatus.ACTIVE,
            nextBillingAt: addMonths(occurredAt, subscriptionCycleMonths(subscription.billingPeriod, subscription.manualMonthlyBilling)),
            recurringEnabled: true,
            recurringMethod: method,
            providerSubscriptionId: event.providerSubscriptionId ?? subscription.providerSubscriptionId,
          },
        });
      });
    } else if (event.eventName === "subscription_charge_failed" || event.eventName === "subscription_delayed") {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: SubscriptionStatus.PAST_DUE,
          nextBillingAt: occurredAt,
          recurringEnabled: true,
        },
      });
    } else if (event.eventName === "subscription_cancelation") {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: SubscriptionStatus.CANCELED,
          recurringEnabled: false,
        },
      });
    } else {
      await prisma.gatewayEvent.update({
        where: { id: event.id },
        data: { status: GatewayEventStatus.IGNORED, processedAt: new Date(), error: null },
      });
      return;
    }

    await prisma.gatewayEvent.update({
      where: { id: event.id },
      data: { status: GatewayEventStatus.PROCESSED, processedAt: new Date(), error: null },
    });
  } catch (error) {
    await prisma.gatewayEvent.update({
      where: { id: event.id },
      data: {
        status: GatewayEventStatus.FAILED,
        error: error instanceof Error ? error.message.slice(0, 240) : "Webhook processing failed",
      },
    }).catch(() => undefined);
    console.error("Appmax webhook processing failed", { eventId: event.id, eventName: event.eventName });
  }
}
