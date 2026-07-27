import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders, publicUrl } from "@/lib/security";
import { createOpaqueToken, hashOpaqueToken } from "@/lib/tokens";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  const admin = await getCurrentUser();
  if (!admin || admin.role !== UserRole.ADMIN) return NextResponse.json({ error: "Apenas administradores podem gerar links" }, { status: 403, headers: noStoreHeaders() });

  const rawToken = createOpaqueToken();
  await prisma.paymentLink.create({ data: { tokenHash: hashOpaqueToken(rawToken), createdById: admin.id } });
  const paymentUrl = publicUrl(request, `/pagamento/${rawToken}`);
  return NextResponse.json({ paymentUrl }, { headers: noStoreHeaders() });
}
