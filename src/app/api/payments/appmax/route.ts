import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { handlePaymentRequest } from "@/lib/payment-route";
import { noStoreHeaders } from "@/lib/security";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401, headers: noStoreHeaders() });
  if (user.role !== UserRole.STUDENT) {
    return NextResponse.json({ error: "Apenas alunos podem gerar pagamentos" }, { status: 403, headers: noStoreHeaders() });
  }
  return handlePaymentRequest({ request, userId: user.id });
}
