import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Faça login para continuar" }, { status: 401, headers: noStoreHeaders() });
  await prisma.user.update({ where: { id: user.id }, data: { tutorialSeenAt: new Date() } });
  return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
}
