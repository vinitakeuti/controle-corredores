import { NextResponse } from "next/server";
import { canAccessFeature } from "@/lib/access-control";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseSalesCardInput, salesCardUrl } from "@/lib/sales-cards";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";
import { createOpaqueToken } from "@/lib/tokens";

// Cria um cartão de venda (QR de evento). Mesma permissão da tela de Vendas.
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  const user = await getCurrentUser();
  if (!user || !canAccessFeature(user, "sales")) return NextResponse.json({ error: "Sem permissão para criar cartões de venda." }, { status: 403, headers: noStoreHeaders() });
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers: noStoreHeaders() });
    const parsed = await parseSalesCardInput(body as Record<string, unknown>, false);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: noStoreHeaders() });
    const { name, expiresAt, planIds } = parsed.data;
    const card = await prisma.salesCard.create({ data: { name: name!, expiresAt: expiresAt!, code: createOpaqueToken(16), createdById: user.id, plans: { connect: planIds!.map((id) => ({ id })) } } });
    console.info("sales card created", { cardId: card.id, createdById: user.id, plans: planIds!.length, expiresAt: card.expiresAt.toISOString() });
    return NextResponse.json({ card: { id: card.id, url: salesCardUrl(card.code) } }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("sales card creation failed", error);
    return NextResponse.json({ error: "Não foi possível criar o cartão." }, { status: 500, headers: noStoreHeaders() });
  }
}
