import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { cancelAsaasAutomaticPixAuthorization } from "@/lib/asaas";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

export async function PATCH(request: Request, context: { params: Promise<{ id: string; subscriptionId: string }> }) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
    const user = await getCurrentUser();
    if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.OPERATOR)) return NextResponse.json({ error: "Sem permissão para alterar a cobrança" }, { status: 403, headers: noStoreHeaders() });
    const { id, subscriptionId } = await context.params;
    const body = await request.json() as { nextBillingAt?: unknown };
    const nextBillingAt = typeof body.nextBillingAt === "string" ? new Date(`${body.nextBillingAt}T12:00:00`) : null;
    if (!nextBillingAt || Number.isNaN(nextBillingAt.getTime())) return NextResponse.json({ error: "Informe uma data válida" }, { status: 400, headers: noStoreHeaders() });
    const subscription = await prisma.subscription.findFirst({ where: { id: subscriptionId, userId: id } });
    if (!subscription) return NextResponse.json({ error: "Produto do aluno não encontrado" }, { status: 404, headers: noStoreHeaders() });
    const needsNewPixAuthorization = Boolean(subscription.asaasPixAuthorizationId && subscription.recurringEnabled && subscription.nextBillingAt?.toISOString().slice(0, 10) !== nextBillingAt.toISOString().slice(0, 10));
    if (needsNewPixAuthorization && subscription.asaasPixAuthorizationId) await cancelAsaasAutomaticPixAuthorization(subscription.asaasPixAuthorizationId);
    const updated = await prisma.subscription.update({ where: { id: subscription.id }, data: { nextBillingAt, ...(needsNewPixAuthorization ? { asaasPixAuthorizationStatus: "CANCELLED", recurringEnabled: false, recurringMethod: null } : {}) } });
    return NextResponse.json({ subscription: updated, reauthorizationRequired: needsNewPixAuthorization }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("subscription date update failed", error);
    return NextResponse.json({ error: "Não foi possível atualizar a data de cobrança" }, { status: 502, headers: noStoreHeaders() });
  }
}
