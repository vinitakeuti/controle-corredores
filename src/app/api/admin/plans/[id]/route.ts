import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { cancelAsaasAutomaticPixAuthorization } from "@/lib/asaas";
import { getCurrentUser } from "@/lib/auth";
import { parseAllowedMethods, parseAmountCents } from "@/lib/billing";
import { planTotalCents } from "@/lib/plan-billing";
import { parsePlanPeriod } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
    const user = await getCurrentUser();
    if (!user || user.role !== UserRole.ADMIN) return NextResponse.json({ error: "Apenas administradores podem editar planos" }, { status: 403, headers: noStoreHeaders() });
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const current = await prisma.plan.findUnique({ where: { id } });
    if (!current) return NextResponse.json({ error: "Plano não encontrado." }, { status: 404, headers: noStoreHeaders() });
    const priceCents = body.priceCents === undefined ? current.priceCents : parseAmountCents(body.priceCents);
    const period = body.period === undefined ? current.period : parsePlanPeriod(body.period);
    const active = body.active === undefined ? current.active : body.active === true;
    const allowedMethods = body.allowedMethods === undefined ? current.allowedMethods : parseAllowedMethods(body.allowedMethods);
    const automaticPixEnabled = body.automaticPixEnabled === undefined ? current.automaticPixEnabled : body.automaticPixEnabled === true;
    if (!priceCents || !period || !allowedMethods) return NextResponse.json({ error: "Informe período, valor e pelo menos um método de pagamento." }, { status: 400, headers: noStoreHeaders() });
    const priceChanged = priceCents !== current.priceCents;
    const periodChanged = period !== current.period;
    const methodsChanged = allowedMethods.length !== current.allowedMethods.length || allowedMethods.some((method) => !current.allowedMethods.includes(method));
    const nextAutomaticPixEnabled = automaticPixEnabled;
    const automaticPixChanged = nextAutomaticPixEnabled !== current.automaticPixEnabled;
    const subscriptions = priceChanged || periodChanged || methodsChanged || automaticPixChanged ? await prisma.subscription.findMany({ where: { planId: id }, select: { id: true, userId: true, priceCents: true, hasCustomPrice: true, asaasPixAuthorizationId: true, recurringEnabled: true } }) : [];
    const standardSubscriptions = subscriptions.filter((subscription) => !subscription.hasCustomPrice);
    const pixTermsChanged = priceChanged || periodChanged || automaticPixChanged;
    const authorizations = pixTermsChanged ? subscriptions.flatMap((subscription) => subscription.recurringEnabled && subscription.asaasPixAuthorizationId ? [subscription.asaasPixAuthorizationId] : []) : [];
    await Promise.all(authorizations.map((authorizationId) => cancelAsaasAutomaticPixAuthorization(authorizationId)));
    const plan = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.plan.update({ where: { id }, data: { priceCents, period, active, allowedMethods, automaticPixEnabled: nextAutomaticPixEnabled }, include: { service: true } });
      if (subscriptions.length) {
        await transaction.subscription.updateMany({ where: { id: { in: subscriptions.map((subscription) => subscription.id) } }, data: { billingPeriod: period, allowedMethods, automaticPixEnabled: nextAutomaticPixEnabled, ...(authorizations.length ? { asaasPixAuthorizationStatus: "CANCELLED", recurringEnabled: false, recurringMethod: null } : {}) } });
        if (standardSubscriptions.length) {
          await transaction.subscription.updateMany({ where: { id: { in: standardSubscriptions.map((subscription) => subscription.id) } }, data: { priceCents } });
        }
        await transaction.paymentLink.updateMany({ where: { userId: { in: subscriptions.map((subscription) => subscription.userId) }, planId: id, status: "OPEN" }, data: { amountCents: planTotalCents(priceCents, period), allowedMethods } });
        await Promise.all(subscriptions.filter((subscription) => subscription.hasCustomPrice).map((subscription) => transaction.paymentLink.updateMany({
          where: { userId: subscription.userId, planId: id, status: "OPEN" },
          data: { amountCents: planTotalCents(subscription.priceCents, period), allowedMethods },
        })));
      }
      return updated;
    });
    return NextResponse.json({ plan, updatedStudents: subscriptions.length, reauthorizationRequired: authorizations.length }, { headers: noStoreHeaders() });
  } catch (error) {
    const message = error instanceof Error && /Unique constraint/.test(error.message) ? "Esse serviço já possui um plano para esse período." : "Não foi possível atualizar o plano.";
    return NextResponse.json({ error: message }, { status: 400, headers: noStoreHeaders() });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
    const user = await getCurrentUser();
    if (!user || user.role !== UserRole.ADMIN) return NextResponse.json({ error: "Apenas administradores podem excluir planos" }, { status: 403, headers: noStoreHeaders() });
    const { id } = await context.params;
    const plan = await prisma.plan.findUnique({ where: { id }, select: { id: true, subscriptions: { where: { status: { in: ["ACTIVE", "PAST_DUE", "INCOMPLETE"] } }, select: { id: true }, take: 1 }, paymentLinks: { where: { status: "OPEN" }, select: { id: true }, take: 1 } } });
    if (!plan) return NextResponse.json({ error: "Plano não encontrado." }, { status: 404, headers: noStoreHeaders() });
    if (plan.subscriptions.length || plan.paymentLinks.length) return NextResponse.json({ error: "Este plano está vinculado a alunos ou links abertos. Pause-o para impedir novas escolhas e mantenha as cobranças atuais seguras." }, { status: 409, headers: noStoreHeaders() });
    await prisma.plan.delete({ where: { id } });
    return NextResponse.json({ deleted: true }, { headers: noStoreHeaders() });
  } catch {
    return NextResponse.json({ error: "Não foi possível excluir o plano." }, { status: 400, headers: noStoreHeaders() });
  }
}
