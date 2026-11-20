import { NextResponse } from "next/server";
import { canAccessFeature } from "@/lib/access-control";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseSalesCardInput, salesCardStatus } from "@/lib/sales-cards";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

async function staff() {
  const user = await getCurrentUser();
  return user && canAccessFeature(user, "sales") ? user : null;
}

// Situação do cartão para a tela de exibição (atualiza sozinha durante o evento).
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await staff()) return NextResponse.json({ error: "Sem permissão." }, { status: 403, headers: noStoreHeaders() });
  const { id } = await context.params;
  const card = await prisma.salesCard.findUnique({ where: { id }, select: { expiresAt: true, closedAt: true, plans: { where: { active: true, service: { active: true } }, select: { id: true } }, _count: { select: { students: true } } } });
  if (!card) return NextResponse.json({ error: "Cartão não encontrado." }, { status: 404, headers: noStoreHeaders() });
  // Sem nenhum plano ativo o cadastro público também fecha.
  return NextResponse.json({ status: card.plans.length ? salesCardStatus(card) : "closed", expiresAt: card.expiresAt.toISOString(), signups: card._count.students }, { headers: noStoreHeaders() });
}

// Edita nome, validade e planos, ou encerra na hora ({ close: true }).
// Prorrogar a validade de um cartão vencido ou encerrado o reabre.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  const user = await staff();
  if (!user) return NextResponse.json({ error: "Sem permissão para editar cartões de venda." }, { status: 403, headers: noStoreHeaders() });
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers: noStoreHeaders() });
    const input = body as Record<string, unknown>;
    const card = await prisma.salesCard.findUnique({ where: { id }, select: { id: true, expiresAt: true } });
    if (!card) return NextResponse.json({ error: "Cartão não encontrado." }, { status: 404, headers: noStoreHeaders() });

    if (input.close === true) {
      const now = new Date();
      if (card.expiresAt > now) await prisma.salesCard.update({ where: { id }, data: { expiresAt: now, closedAt: now } });
      console.info("sales card closed", { cardId: id, closedById: user.id });
      return NextResponse.json({ status: "closed" }, { headers: noStoreHeaders() });
    }

    const parsed = await parseSalesCardInput(input, true);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: noStoreHeaders() });
    const { name, expiresAt, planIds } = parsed.data;
    const updated = await prisma.salesCard.update({
      where: { id },
      data: { ...(name ? { name } : {}), ...(expiresAt ? { expiresAt, closedAt: null } : {}), ...(planIds ? { plans: { set: planIds.map((planId) => ({ id: planId })) } } : {}) },
      select: { expiresAt: true, closedAt: true },
    });
    return NextResponse.json({ status: salesCardStatus(updated) }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("sales card update failed", error);
    return NextResponse.json({ error: "Não foi possível atualizar o cartão." }, { status: 500, headers: noStoreHeaders() });
  }
}
