import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { cancelAsaasAutomaticPixAuthorization } from "@/lib/asaas";
import { getCurrentUser } from "@/lib/auth";
import { parseAmountCents } from "@/lib/billing";
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
    if (!priceCents || !period) return NextResponse.json({ error: "Informe período e valor válidos." }, { status: 400, headers: noStoreHeaders() });
    const priceChanged = priceCents !== current.priceCents;
    const subscriptions = priceChanged ? await prisma.subscription.findMany({ where: { planId: id, hasCustomPrice: false }, select: { id: true, userId: true, asaasPixAuthorizationId: true, recurringEnabled: true } }) : [];
    const authorizations = subscriptions.flatMap((subscription) => subscription.recurringEnabled && subscription.asaasPixAuthorizationId ? [subscription.asaasPixAuthorizationId] : []);
    await Promise.all(authorizations.map((authorizationId) => cancelAsaasAutomaticPixAuthorization(authorizationId)));
    const plan = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.plan.update({ where: { id }, data: { priceCents, period, active }, include: { service: true } });
      if (subscriptions.length) {
        await transaction.subscription.updateMany({ where: { id: { in: subscriptions.map((subscription) => subscription.id) } }, data: { priceCents, ...(authorizations.length ? { asaasPixAuthorizationStatus: "CANCELLED", recurringEnabled: false, recurringMethod: null } : {}) } });
        await transaction.paymentLink.updateMany({ where: { userId: { in: subscriptions.map((subscription) => subscription.userId) }, planId: id, status: "OPEN" }, data: { amountCents: priceCents } });
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
