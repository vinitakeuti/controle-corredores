import { NextResponse } from "next/server";
import { PaymentLinkStatus, UserRole } from "@prisma/client";
import { cancelAsaasAutomaticPixAuthorization } from "@/lib/asaas";
import { getCurrentUser } from "@/lib/auth";
import { planDisplayName } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

export async function PATCH(request: Request) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
    const user = await getCurrentUser();
    if (!user || user.role !== UserRole.STUDENT) return NextResponse.json({ error: "Apenas alunos podem escolher um plano" }, { status: 403, headers: noStoreHeaders() });
    const body = await request.json() as Record<string, unknown>;
    const planId = typeof body.planId === "string" ? body.planId : "";
    const [plan, subscription] = await Promise.all([
      prisma.plan.findFirst({ where: { id: planId, active: true, service: { active: true } }, include: { service: true } }),
      prisma.subscription.findUnique({ where: { userId: user.id } }),
    ]);
    if (!plan || !subscription) return NextResponse.json({ error: "Plano ou assinatura não encontrados." }, { status: 404, headers: noStoreHeaders() });
    const priceChanged = subscription.priceCents !== plan.priceCents;
    const shouldCancelPix = priceChanged && subscription.recurringEnabled && Boolean(subscription.asaasPixAuthorizationId);
    if (shouldCancelPix && subscription.asaasPixAuthorizationId) await cancelAsaasAutomaticPixAuthorization(subscription.asaasPixAuthorizationId);
    const planName = planDisplayName(plan);
    await prisma.$transaction(async (transaction) => {
      await transaction.subscription.update({ where: { id: subscription.id }, data: { planId: plan.id, planName, priceCents: plan.priceCents, ...(shouldCancelPix ? { asaasPixAuthorizationStatus: "CANCELLED", recurringEnabled: false, recurringMethod: null } : {}) } });
      await transaction.paymentLink.updateMany({ where: { userId: user.id, status: PaymentLinkStatus.OPEN }, data: { planId: plan.id, planName, amountCents: plan.priceCents } });
    });
    return NextResponse.json({ ok: true, planName, reauthorizationRequired: shouldCancelPix }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("student plan selection failed", error);
    return NextResponse.json({ error: "Não foi possível atualizar seu plano." }, { status: 502, headers: noStoreHeaders() });
  }
}
