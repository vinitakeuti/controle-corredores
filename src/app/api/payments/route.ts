import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { handlePaymentRequest } from "@/lib/payment-route";
import { noStoreHeaders } from "@/lib/security";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== UserRole.STUDENT) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401, headers: noStoreHeaders() });
  }
  return handlePaymentRequest({ request, userId: user.id });
}
