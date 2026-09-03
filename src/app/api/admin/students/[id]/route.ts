import { NextResponse } from "next/server";
import { PaymentLinkStatus, UserRole } from "@prisma/client";
import { cancelAsaasAutomaticPixAuthorization } from "@/lib/asaas";
import { parseAmountCents } from "@/lib/billing";
import { planTotalCents } from "@/lib/plan-billing";
import { planDisplayName } from "@/lib/plans";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

async function staffUser(request: Request) {
  if (!isSameOrigin(request)) return null;
  const user = await getCurrentUser();
  return user && (user.role === UserRole.ADMIN || user.role === UserRole.OPERATOR) ? user : null;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const staff = await staffUser(request);
    if (!staff) return NextResponse.json({ error: "Sem permissão para editar a condição comercial" }, { status: 403, headers: noStoreHeaders() });
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return NextResponse.json({ error: "Formato inválido" }, { status: 415, headers: noStoreHeaders() });
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const student = await prisma.user.findUnique({ where: { id }, include: { subscription: { include: { plan: true } } } });
    if (!student || student.role !== UserRole.STUDENT || !student.subscription) return NextResponse.json({ error: "Aluno não encontrado" }, { status: 404, headers: noStoreHeaders() });

    const planId = typeof body.planId === "string" ? body.planId : student.subscription.planId;
    const plan = planId ? await prisma.plan.findFirst({ where: { id: planId, active: true, service: { active: true } }, include: { service: true } }) : null;
    if (!plan) return NextResponse.json({ error: "Selecione um plano ativo para este aluno" }, { status: 400, headers: noStoreHeaders() });
    const priceCents = body.priceCents === undefined ? (student.subscription.planId === plan.id ? student.subscription.priceCents : plan.priceCents) : parseAmountCents(body.priceCents);
    const allowedMethods = plan.allowedMethods;
    if (!priceCents) return NextResponse.json({ error: "Informe um valor entre R$ 1,00 e R$ 100.000,00" }, { status: 400, headers: noStoreHeaders() });

    const methodsChanged = allowedMethods.length !== student.subscription.allowedMethods.length
      || allowedMethods.some((method) => !student.subscription!.allowedMethods.includes(method));
    const priceChanged = priceCents !== student.subscription.priceCents;
    const planChanged = plan.id !== student.subscription.planId;
    const periodChanged = plan.period !== student.subscription.billingPeriod;
    const automaticPixChanged = plan.automaticPixEnabled !== student.subscription.automaticPixEnabled;
    const hasCustomPrice = priceCents !== plan.priceCents;
    const cancelAutomaticPix = Boolean(
      student.subscription.asaasPixAuthorizationId
      && student.subscription.recurringEnabled
      && (priceChanged || planChanged || periodChanged || automaticPixChanged || (student.subscription.allowedMethods.includes("PIX") && !allowedMethods.includes("PIX"))),
    );
    if (cancelAutomaticPix && student.subscription.asaasPixAuthorizationId) {
      await cancelAsaasAutomaticPixAuthorization(student.subscription.asaasPixAuthorizationId);
    }

    const subscription = await prisma.subscription.update({
      where: { id: student.subscription.id },
      data: {
        priceCents,
        hasCustomPrice,
        planId: plan.id,
        planName: planDisplayName(plan),
        billingPeriod: plan.period,
        allowedMethods,
        automaticPixEnabled: plan.automaticPixEnabled,
        ...(cancelAutomaticPix ? {
          asaasPixAuthorizationStatus: "CANCELLED",
          recurringEnabled: false,
          recurringMethod: null,
        } : {}),
      },
    });
    await prisma.paymentLink.updateMany({
      where: { userId: student.id, status: PaymentLinkStatus.OPEN },
      data: { planId: plan.id, planName: planDisplayName(plan), amountCents: planTotalCents(priceCents, plan.period), allowedMethods },
    });
    return NextResponse.json({ subscription, reauthorizationRequired: cancelAutomaticPix, changed: priceChanged || planChanged || methodsChanged }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("student billing update failed", error);
    return NextResponse.json({ error: "Não foi possível atualizar a cobrança do aluno" }, { status: 502, headers: noStoreHeaders() });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await staffUser(request);
    if (!admin || admin.role !== UserRole.ADMIN) return NextResponse.json({ error: "Apenas administradores podem excluir alunos" }, { status: 403, headers: noStoreHeaders() });
    const { id } = await context.params;
    const student = await prisma.user.findUnique({ where: { id }, include: { subscription: true } });
    if (!student || student.role !== UserRole.STUDENT) return NextResponse.json({ error: "Aluno não encontrado" }, { status: 404, headers: noStoreHeaders() });
    if (student.subscription?.asaasPixAuthorizationId && student.subscription.recurringEnabled) {
      await cancelAsaasAutomaticPixAuthorization(student.subscription.asaasPixAuthorizationId);
    }
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
