import { GatewayEventStatus } from "@prisma/client";
import { synchronizeAsaasPayment } from "@/lib/payment-service";
import { prisma } from "@/lib/prisma";

export async function processAsaasGatewayEvent(eventId: string) {
  const event = await prisma.gatewayEvent.findUnique({ where: { id: eventId } });
  if (!event || event.provider !== "ASAAS") return;
  if (event.status === GatewayEventStatus.PROCESSED || event.status === GatewayEventStatus.IGNORED) return;

  try {
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
