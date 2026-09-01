import { NextResponse } from "next/server";
import { PaymentLinkStatus, UserRole } from "@prisma/client";
import { cancelAsaasAutomaticPixAuthorization } from "@/lib/asaas";
import { getCurrentUser } from "@/lib/auth";
import { parseAllowedMethods, parseAmountCents } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

async function adminUser(request: Request) {
  if (!isSameOrigin(request)) return null;
  const admin = await getCurrentUser();
  return admin?.role === UserRole.ADMIN ? admin : null;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!await adminUser(request)) return NextResponse.json({ error: "Apenas administradores podem editar cobranças" }, { status: 403, headers: noStoreHeaders() });
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const student = await prisma.user.findUnique({ where: { id }, include: { subscriptions: { include: { plan: true } } } });
    const subscriptionId = typeof body.subscriptionId === "string" ? body.subscriptionId : student?.subscriptions[0]?.id;
    const subscription = student?.subscriptions.find((item) => item.id === subscriptionId);
    if (!student || student.role !== UserRole.STUDENT || !subscription) return NextResponse.json({ error: "Produto do aluno não encontrado" }, { status: 404, headers: noStoreHeaders() });
    const priceCents = body.priceCents === undefined ? subscription.priceCents : parseAmountCents(body.priceCents);
    const allowedMethods = body.allowedMethods === undefined ? subscription.allowedMethods : parseAllowedMethods(body.allowedMethods);
    if (!priceCents || !allowedMethods) return NextResponse.json({ error: "Informe valor e ao menos um método de pagamento válidos" }, { status: 400, headers: noStoreHeaders() });
    const priceChanged = priceCents !== subscription.priceCents;
    const cancelAutomaticPix = Boolean(subscription.asaasPixAuthorizationId && subscription.recurringEnabled && (priceChanged || (subscription.allowedMethods.includes("PIX") && !allowedMethods.includes("PIX"))));
    if (cancelAutomaticPix && subscription.asaasPixAuthorizationId) await cancelAsaasAutomaticPixAuthorization(subscription.asaasPixAuthorizationId);
    const updated = await prisma.subscription.update({ where: { id: subscription.id }, data: { priceCents, allowedMethods, hasCustomPrice: subscription.plan ? priceCents !== subscription.plan.priceCents : true, ...(cancelAutomaticPix ? { asaasPixAuthorizationStatus: "CANCELLED", recurringEnabled: false, recurringMethod: null } : {}) } });
    return NextResponse.json({ subscription: updated, reauthorizationRequired: cancelAutomaticPix, changed: true }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("student billing update failed", error);
    return NextResponse.json({ error: "Não foi possível atualizar a cobrança do aluno" }, { status: 502, headers: noStoreHeaders() });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!await adminUser(request)) return NextResponse.json({ error: "Apenas administradores podem excluir alunos" }, { status: 403, headers: noStoreHeaders() });
    const { id } = await context.params;
    const student = await prisma.user.findUnique({ where: { id }, include: { subscriptions: true } });
    if (!student || student.role !== UserRole.STUDENT) return NextResponse.json({ error: "Aluno não encontrado" }, { status: 404, headers: noStoreHeaders() });
    await Promise.all(student.subscriptions.filter((subscription) => subscription.asaasPixAuthorizationId && subscription.recurringEnabled).map((subscription) => cancelAsaasAutomaticPixAuthorization(subscription.asaasPixAuthorizationId!)));
    await prisma.$transaction(async (transaction) => {
      await transaction.paymentLink.updateMany({ where: { userId: id, status: PaymentLinkStatus.OPEN }, data: { status: PaymentLinkStatus.REVOKED } });
      await transaction.payment.deleteMany({ where: { userId: id } });
      await transaction.renewalReminder.deleteMany({ where: { userId: id } });
      await transaction.session.deleteMany({ where: { userId: id } });
      await transaction.user.delete({ where: { id } });
    });
    return NextResponse.json({ deleted: true }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("student deletion failed", error);
    return NextResponse.json({ error: "Não foi possível excluir o aluno" }, { status: 502, headers: noStoreHeaders() });
  }
}
