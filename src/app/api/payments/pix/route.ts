import { NextResponse } from "next/server";
import { PaymentMethod, PaymentStatus, UserRole } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const user = await requireUser();
  if (user.role !== UserRole.STUDENT) return NextResponse.json({ error: "Apenas alunos podem gerar pagamentos" }, { status: 403 });

  const record = await prisma.user.findUnique({ where: { id: user.id }, include: { subscription: true } });
  if (!record?.subscription) return NextResponse.json({ error: "Sua assinatura ainda não foi configurada" }, { status: 400 });

  const dueAt = record.subscription.nextBillingAt ?? new Date();
  const pixCopyPaste = `PABULA*PIX*${record.id}*${record.subscription.priceCents}*${Date.now()}`;
  const payment = await prisma.payment.create({
    data: {
      userId: user.id,
      subscriptionId: record.subscription.id,
      amountCents: record.subscription.priceCents,
      method: PaymentMethod.PIX,
      status: PaymentStatus.PENDING,
      dueAt,
      pixCopyPaste,
    },
  });

  return NextResponse.json({ paymentId: payment.id, pixCopyPaste });
}
