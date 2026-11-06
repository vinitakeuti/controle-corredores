import { NextResponse } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";
import { toWhatsappNumber } from "@/lib/whatsapp/phone";

export const dynamic = "force-dynamic";

// O WhatsApp de cada colaborador: é por ele que o assistente reconhece quem é da equipe e o cargo.
export async function PUT(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  const user = await getCurrentUser();
  if (user?.role !== UserRole.ADMIN) return NextResponse.json({ error: "Sem permissão" }, { status: 403, headers: noStoreHeaders() });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const userId = typeof body.userId === "string" ? body.userId : "";
  const raw = typeof body.whatsapp === "string" ? body.whatsapp.trim() : "";
  const whatsapp = raw ? toWhatsappNumber(raw) : null;
  if (raw && !whatsapp) return NextResponse.json({ error: "Número inválido. Use DDD e número." }, { status: 400, headers: noStoreHeaders() });
  const target = await prisma.user.findFirst({ where: { id: userId, role: { in: [UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR] } }, select: { id: true } });
  if (!target) return NextResponse.json({ error: "Colaborador não encontrado." }, { status: 404, headers: noStoreHeaders() });
  try {
    await prisma.user.update({ where: { id: target.id }, data: { assistantWhatsapp: whatsapp } });
    return NextResponse.json({ whatsapp }, { headers: noStoreHeaders() });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "Este número já está com outro colaborador." }, { status: 409, headers: noStoreHeaders() });
    throw error;
  }
}
