import { NextResponse } from "next/server";
import { PaymentLinkStatus, UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { handlePaymentRequest } from "@/lib/payment-route";
import { prisma } from "@/lib/prisma";
import { noStoreHeaders } from "@/lib/security";
import { hashOpaqueToken } from "@/lib/tokens";

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== UserRole.STUDENT) {
    return NextResponse.json({ error: "Faça login para continuar" }, { status: 401, headers: noStoreHeaders() });
  }

  const { token } = await context.params;
  const link = await prisma.paymentLink.findUnique({
    where: { tokenHash: hashOpaqueToken(token) },
    select: { id: true, userId: true, amountCents: true, status: true },
  });
  if (!link || link.status !== PaymentLinkStatus.OPEN || link.userId !== user.id) {
    return NextResponse.json({ error: "Link de pagamento inválido ou indisponível" }, { status: 404, headers: noStoreHeaders() });
  }

  return handlePaymentRequest({
    request,
    userId: user.id,
    paymentLinkId: link.id,
    amountCents: link.amountCents,
  });
}
