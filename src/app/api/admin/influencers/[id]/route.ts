import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { canAccessFeature } from "@/lib/access-control";
import { getCurrentUser } from "@/lib/auth";
import { parseInfluencerInput } from "@/lib/influencers";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

// Edita tipo, cupom, comissão, desconto e situação. Vendas já feitas mantêm a comissão da época.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  const staff = await getCurrentUser();
  if (!staff || !canAccessFeature(staff, "marketing")) return NextResponse.json({ error: "Sem permissão para o programa Experts & Creators." }, { status: 403, headers: noStoreHeaders() });
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers: noStoreHeaders() });
    const parsed = parseInfluencerInput(body as Record<string, unknown>, true);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: noStoreHeaders() });
    const current = await prisma.influencer.findUnique({ where: { id }, select: { id: true, couponCode: true } });
    if (!current) return NextResponse.json({ error: "Influenciador não encontrado." }, { status: 404, headers: noStoreHeaders() });
    if (parsed.data.couponCode && parsed.data.couponCode !== current.couponCode && await prisma.influencer.findUnique({ where: { couponCode: parsed.data.couponCode }, select: { id: true } })) {
      return NextResponse.json({ error: "Este cupom já é de outro influenciador." }, { status: 409, headers: noStoreHeaders() });
    }
    await prisma.influencer.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "Este cupom já é de outro influenciador." }, { status: 409, headers: noStoreHeaders() });
    console.error("influencer update failed", error);
    return NextResponse.json({ error: "Não foi possível salvar." }, { status: 500, headers: noStoreHeaders() });
  }
}
