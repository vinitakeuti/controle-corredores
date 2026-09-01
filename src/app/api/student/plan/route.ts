import { NextResponse } from "next/server";
import { PaymentLinkStatus, PaymentMethod, SubscriptionStatus, UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { planTotalCents } from "@/lib/plan-billing";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

export async function PATCH(request: Request) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
    const user = await getCurrentUser();
    if (!user || user.role !== UserRole.STUDENT) return NextResponse.json({ error: "Apenas alunos podem escolher um plano" }, { status: 403, headers: noStoreHeaders() });
    const body = await request.json() as { planId?: unknown; planIds?: unknown };
    const rawIds = Array.isArray(body.planIds) ? body.planIds : body.planId ? [body.planId] : [];
    const planIds = [...new Set(rawIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0))];
    if (!planIds.length) return NextResponse.json({ error: "Selecione ao menos um plano." }, { status: 400, headers: noStoreHeaders() });
    const plans = await prisma.plan.findMany({ where: { id: { in: planIds }, active: true, service: { active: true } }, include: { service: true } });
    if (plans.length !== planIds.length) return NextResponse.json({ error: "Um dos planos selecionados não está mais disponível." }, { status: 409, headers: noStoreHeaders() });
    if (new Set(plans.map((plan) => plan.serviceId)).size !== plans.length) return NextResponse.json({ error: "Escolha apenas um plano por serviço." }, { status: 400, headers: noStoreHeaders() });

    const subscriptions = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.subscription.findMany({ where: { userId: user.id }, include: { plan: true } });
      const available = [...existing];
      const selected = [];
      for (const plan of plans) {
        let subscription = available.find((item) => item.plan?.serviceId === plan.serviceId)
          ?? available.find((item) => !item.planId && item.status === SubscriptionStatus.INCOMPLETE);
        const planName = `${plan.service.name} · ${plan.period === "MONTHLY" ? "Mensal" : plan.period === "QUARTERLY" ? "Trimestral" : plan.period === "SEMIANNUAL" ? "Semestral" : "Anual"}`;
        if (subscription) {
          const id = subscription.id;
          subscription = await transaction.subscription.update({ where: { id }, data: { planId: plan.id, planName, priceCents: plan.priceCents, billingPeriod: plan.period, allowedMethods: plan.allowedMethods, automaticPixEnabled: plan.automaticPixEnabled, hasCustomPrice: false }, include: { plan: true } });
          available.splice(available.findIndex((item) => item.id === id), 1);
        } else {
          subscription = await transaction.subscription.create({ data: { userId: user.id, planId: plan.id, planName, priceCents: plan.priceCents, billingPeriod: plan.period, allowedMethods: plan.allowedMethods, automaticPixEnabled: plan.automaticPixEnabled }, include: { plan: true } });
        }
        selected.push(subscription);
      }
      return selected;
    });
    const allowedMethods = subscriptions.reduce<PaymentMethod[]>((methods, subscription, index) => index === 0 ? subscription.allowedMethods : methods.filter((method) => subscription.allowedMethods.includes(method)), []);
    const amountCents = subscriptions.reduce((total, subscription) => total + planTotalCents(subscription.priceCents, subscription.billingPeriod), 0);
    await prisma.paymentLink.updateMany({ where: { userId: user.id, status: PaymentLinkStatus.OPEN }, data: { amountCents, allowedMethods } });
    return NextResponse.json({ subscriptions, allowedMethods, reauthorizationRequired: false }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("student plan selection failed", error);
    return NextResponse.json({ error: "Não foi possível atualizar seu plano." }, { status: 502, headers: noStoreHeaders() });
  }
}
