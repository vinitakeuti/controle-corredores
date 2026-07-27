import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { synchronizeAppmaxOrder } from "@/lib/payment-service";
import { prisma } from "@/lib/prisma";
import { noStoreHeaders } from "@/lib/security";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401, headers: noStoreHeaders() });

  const { id } = await context.params;
  const payment = await prisma.payment.findUnique({
    where: { id },
    select: { id: true, userId: true, status: true, providerOrderId: true, updatedAt: true },
  });
  if (!payment || payment.userId !== user.id) {
    return NextResponse.json({ error: "Pagamento não encontrado" }, { status: 404, headers: noStoreHeaders() });
  }

  const maySynchronize = payment.updatedAt <= new Date(Date.now() - 5_000);
  if (payment.status === "PENDING" && payment.providerOrderId && maySynchronize) {
    try {
      const synchronized = await synchronizeAppmaxOrder(payment.providerOrderId);
      return NextResponse.json({ status: synchronized?.status ?? payment.status }, { headers: noStoreHeaders() });
    } catch {
      // A consulta é um complemento do webhook. Em falhas temporárias,
      // devolvemos o último estado local sem invalidar a tela do aluno.
    }
  }
  return NextResponse.json({ status: payment.status }, { headers: noStoreHeaders() });
}
