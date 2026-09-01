import { NextResponse } from "next/server";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";
import { portalUrl } from "@/lib/portal";
import { createOpaqueToken, hashOpaqueToken } from "@/lib/tokens";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  const admin = await getCurrentUser();
  if (!admin || !isStaffRole(admin.role)) return NextResponse.json({ error: "Apenas administradores e operadores podem gerar links" }, { status: 403, headers: noStoreHeaders() });

  const rawToken = createOpaqueToken();
  await prisma.paymentLink.create({ data: { tokenHash: hashOpaqueToken(rawToken), createdById: admin.id } });
  const paymentUrl = portalUrl("STUDENT", `/pagamento/${rawToken}`);
  return NextResponse.json({ paymentUrl }, { headers: noStoreHeaders() });
}
