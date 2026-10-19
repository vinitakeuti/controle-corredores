import { NextResponse } from "next/server";
import { PaymentLinkStatus, PaymentMethod, SubscriptionStatus, UserRole } from "@prisma/client";
import { cancelAsaasAutomaticPixAuthorization } from "@/lib/asaas";
import { parseAmountCents } from "@/lib/billing";
import { subscriptionChargeCents } from "@/lib/plan-billing";
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
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers: noStoreHeaders() });
    const input = body as Record<string, unknown>;
    const student = await prisma.user.findUnique({ where: { id }, include: { subscription: { include: { plan: true } } } });
    if (!student || student.role !== UserRole.STUDENT) return NextResponse.json({ error: "Aluno não encontrado" }, { status: 404, headers: noStoreHeaders() });

    if (input.action === "set-active") {
      if (staff.role !== UserRole.ADMIN) return NextResponse.json({ error: "Apenas administradores podem inativar ou reativar alunos." }, { status: 403, headers: noStoreHeaders() });
      const nextActive = input.active;
      if (typeof nextActive !== "boolean") return NextResponse.json({ error: "Situação do aluno inválida." }, { status: 400, headers: noStoreHeaders() });
      if (student.active === nextActive) return NextResponse.json({ active: student.active, unchanged: true }, { headers: noStoreHeaders() });

      if (!nextActive && student.subscription?.asaasPixAuthorizationId && !["CANCELLED", "EXPIRED", "REFUSED"].includes(student.subscription.asaasPixAuthorizationStatus ?? "")) {
        await cancelAsaasAutomaticPixAuthorization(student.subscription.asaasPixAuthorizationId);
      }

      const now = new Date();
      await prisma.$transaction(async (transaction) => {
        await transaction.user.update({ where: { id: student.id }, data: { active: nextActive, leftAt: nextActive ? null : now } });
        await transaction.session.deleteMany({ where: { userId: student.id } });
        if (!nextActive) {
          await transaction.paymentLink.updateMany({ where: { userId: student.id, status: PaymentLinkStatus.OPEN }, data: { status: PaymentLinkStatus.REVOKED } });
          if (student.subscription) {
            await transaction.subscription.update({
              where: { id: student.subscription.id },
              data: {
                status: SubscriptionStatus.CANCELED,
                nextBillingAt: null,
                recurringEnabled: false,
                recurringMethod: null,
                automaticPixEnabled: false,
                asaasPixAuthorizationStatus: student.subscription.asaasPixAuthorizationId ? "CANCELLED" : student.subscription.asaasPixAuthorizationStatus,
              },
            });
          }
        } else if (student.subscription?.status === SubscriptionStatus.CANCELED) {
          await transaction.subscription.update({
            where: { id: student.subscription.id },
            data: {
              status: student.subscription.isCourtesy ? SubscriptionStatus.ACTIVE : SubscriptionStatus.INCOMPLETE,
              nextBillingAt: null,
              recurringEnabled: false,
              recurringMethod: null,
              automaticPixEnabled: !student.subscription.isCourtesy && !student.subscription.manualMonthlyBilling && Boolean(student.subscription.plan?.automaticPixEnabled),
              asaasPixAuthorizationStatus: student.subscription.asaasPixAuthorizationId ? "CANCELLED" : student.subscription.asaasPixAuthorizationStatus,
            },
          });
        }
      });
      return NextResponse.json({ active: nextActive }, { headers: noStoreHeaders() });
    }

    if (!student.active) return NextResponse.json({ error: "Reative o aluno antes de editar a condição comercial." }, { status: 409, headers: noStoreHeaders() });
    if (!student.subscription) return NextResponse.json({ error: "Este aluno ainda não possui uma condição comercial." }, { status: 409, headers: noStoreHeaders() });
    if (input.isCourtesy !== undefined && staff.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Apenas administradores podem conceder ou remover cortesias." }, { status: 403, headers: noStoreHeaders() });
    }

    const planId = typeof input.planId === "string" ? input.planId : student.subscription.planId;
    const plan = planId ? await prisma.plan.findFirst({ where: { id: planId, active: true, service: { active: true } }, include: { service: true } }) : null;
    if (!plan) return NextResponse.json({ error: "Selecione um plano ativo para este aluno" }, { status: 400, headers: noStoreHeaders() });
    const priceCents = input.priceCents === undefined ? (student.subscription.planId === plan.id ? student.subscription.priceCents : plan.priceCents) : parseAmountCents(input.priceCents);
    const isCourtesy = input.isCourtesy === undefined ? student.subscription.isCourtesy : input.isCourtesy === true;
    const manualMonthlyBilling = input.manualMonthlyBilling === undefined ? student.subscription.manualMonthlyBilling : input.manualMonthlyBilling === true;
    // Esta condição é uma exceção individual: ela sempre gera uma cobrança
    // avulsa em Pix, uma vez por mês, independentemente da duração do plano.
    if (manualMonthlyBilling && !plan.allowedMethods.includes(PaymentMethod.PIX)) {
      return NextResponse.json({ error: "Este plano não permite Pix, necessário para a cobrança mensal manual." }, { status: 400, headers: noStoreHeaders() });
    }
    const allowedMethods = manualMonthlyBilling ? [PaymentMethod.PIX] : plan.allowedMethods;
    if (!priceCents) return NextResponse.json({ error: "Informe um valor entre R$ 1,00 e R$ 100.000,00" }, { status: 400, headers: noStoreHeaders() });

    const methodsChanged = allowedMethods.length !== student.subscription.allowedMethods.length
      || allowedMethods.some((method) => !student.subscription!.allowedMethods.includes(method));
    const priceChanged = priceCents !== student.subscription.priceCents;
    const planChanged = plan.id !== student.subscription.planId;
    const periodChanged = plan.period !== student.subscription.billingPeriod;
    const automaticPixEnabled = plan.automaticPixEnabled && !manualMonthlyBilling;
    const automaticPixChanged = automaticPixEnabled !== student.subscription.automaticPixEnabled;
    const manualBillingChanged = manualMonthlyBilling !== student.subscription.manualMonthlyBilling;
    const courtesyChanged = isCourtesy !== student.subscription.isCourtesy;
    const hasCustomPrice = priceCents !== plan.priceCents;
    const cancelAutomaticPix = Boolean(
      student.subscription.asaasPixAuthorizationId
      && student.subscription.recurringEnabled
      && (priceChanged || planChanged || periodChanged || automaticPixChanged || manualBillingChanged || courtesyChanged || (student.subscription.allowedMethods.includes("PIX") && !allowedMethods.includes("PIX"))),
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
        isCourtesy,
        manualMonthlyBilling,
        allowedMethods,
        automaticPixEnabled: isCourtesy ? false : automaticPixEnabled,
        ...(isCourtesy ? {
          status: SubscriptionStatus.ACTIVE,
          nextBillingAt: null,
          asaasPixAuthorizationStatus: "CANCELLED",
          recurringEnabled: false,
          recurringMethod: null,
        } : student.subscription.isCourtesy ? {
          status: SubscriptionStatus.INCOMPLETE,
          nextBillingAt: new Date(),
          ...(cancelAutomaticPix ? { asaasPixAuthorizationStatus: "CANCELLED", recurringEnabled: false, recurringMethod: null } : {}),
        } : cancelAutomaticPix ? {
          asaasPixAuthorizationStatus: "CANCELLED",
          recurringEnabled: false,
          recurringMethod: null,
        } : {}),
      },
    });
    await prisma.paymentLink.updateMany({
      where: { userId: student.id, status: PaymentLinkStatus.OPEN },
      data: isCourtesy
        ? { status: PaymentLinkStatus.REVOKED }
        : { planId: plan.id, planName: planDisplayName(plan), amountCents: subscriptionChargeCents(priceCents, plan.period, manualMonthlyBilling), allowedMethods },
    });
    return NextResponse.json({ subscription, reauthorizationRequired: cancelAutomaticPix, changed: priceChanged || planChanged || methodsChanged || manualBillingChanged || courtesyChanged }, { headers: noStoreHeaders() });
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
