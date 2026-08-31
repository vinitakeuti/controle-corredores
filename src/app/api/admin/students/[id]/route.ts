import { NextResponse } from "next/server";
import { PaymentLinkStatus, UserRole } from "@prisma/client";
import { cancelAsaasAutomaticPixAuthorization } from "@/lib/asaas";
import { parseAllowedMethods, parseAmountCents } from "@/lib/billing";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

async function adminUser(request: Request) {
  if (!isSameOrigin(request)) return null;
  const admin = await getCurrentUser();
  return admin?.role === UserRole.ADMIN ? admin : null;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await adminUser(request);
    if (!admin) return NextResponse.json({ error: "Apenas administradores podem editar cobranças" }, { status: 403, headers: noStoreHeaders() });
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return NextResponse.json({ error: "Formato inválido" }, { status: 415, headers: noStoreHeaders() });
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const student = await prisma.user.findUnique({ where: { id }, include: { subscription: { include: { plan: true } } } });
    if (!student || student.role !== UserRole.STUDENT || !student.subscription) return NextResponse.json({ error: "Aluno não encontrado" }, { status: 404, headers: noStoreHeaders() });

    const priceCents = body.priceCents === undefined ? student.subscription.priceCents : parseAmountCents(body.priceCents);
    const allowedMethods = body.allowedMethods === undefined ? student.subscription.allowedMethods : parseAllowedMethods(body.allowedMethods);
    if (!priceCents) return NextResponse.json({ error: "Informe um valor entre R$ 1,00 e R$ 100.000,00" }, { status: 400, headers: noStoreHeaders() });
    if (!allowedMethods) return NextResponse.json({ error: "Selecione ao menos um método de pagamento" }, { status: 400, headers: noStoreHeaders() });

    const methodsChanged = allowedMethods.length !== student.subscription.allowedMethods.length
      || allowedMethods.some((method) => !student.subscription!.allowedMethods.includes(method));
    const priceChanged = priceCents !== student.subscription.priceCents;
    const hasCustomPrice = student.subscription.plan ? priceCents !== student.subscription.plan.priceCents : body.priceCents === undefined ? student.subscription.hasCustomPrice : true;
    const cancelAutomaticPix = Boolean(
      student.subscription.asaasPixAuthorizationId
      && student.subscription.recurringEnabled
      && (priceChanged || (student.subscription.allowedMethods.includes("PIX") && !allowedMethods.includes("PIX"))),
    );
    if (cancelAutomaticPix && student.subscription.asaasPixAuthorizationId) {
      await cancelAsaasAutomaticPixAuthorization(student.subscription.asaasPixAuthorizationId);
    }

    const subscription = await prisma.subscription.update({
      where: { id: student.subscription.id },
      data: {
        priceCents,
        hasCustomPrice,
        allowedMethods,
        ...(cancelAutomaticPix ? {
          asaasPixAuthorizationStatus: "CANCELLED",
          recurringEnabled: false,
          recurringMethod: null,
        } : {}),
      },
    });
    await prisma.paymentLink.updateMany({
      where: { userId: student.id, status: PaymentLinkStatus.OPEN },
      data: { amountCents: priceCents, allowedMethods },
    });
    return NextResponse.json({ subscription, reauthorizationRequired: cancelAutomaticPix, changed: priceChanged || methodsChanged }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("student billing update failed", error);
    return NextResponse.json({ error: "Não foi possível atualizar a cobrança do aluno" }, { status: 502, headers: noStoreHeaders() });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await adminUser(request);
    if (!admin) return NextResponse.json({ error: "Apenas administradores podem excluir alunos" }, { status: 403, headers: noStoreHeaders() });
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
