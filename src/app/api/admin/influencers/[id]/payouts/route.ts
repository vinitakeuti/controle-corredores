import { NextResponse } from "next/server";
import { InfluencerPayoutStatus, InfluencerSaleStatus } from "@prisma/client";
import { canAccessFeature } from "@/lib/access-control";
import { getCurrentUser } from "@/lib/auth";
import { currentMonthKey, monthBounds, parseMonthKey } from "@/lib/influencers";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

// Repasse de um mês fechado: aprovar (congela o valor), marcar como pago ou desfazer a aprovação.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  const staff = await getCurrentUser();
  if (!staff || !canAccessFeature(staff, "marketing")) return NextResponse.json({ error: "Sem permissão para o programa Experts & Creators." }, { status: 403, headers: noStoreHeaders() });
  const { id } = await context.params;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const month = parseMonthKey(body.month);
  const action = body.action;
  if (!month || (action !== "approve" && action !== "pay" && action !== "reopen")) return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers: noStoreHeaders() });
  const influencer = await prisma.influencer.findUnique({ where: { id }, select: { id: true } });
  if (!influencer) return NextResponse.json({ error: "Influenciador não encontrado." }, { status: 404, headers: noStoreHeaders() });
  const payout = await prisma.influencerPayout.findUnique({ where: { influencerId_month: { influencerId: id, month } } });
  const now = new Date();

  if (action === "approve") {
    if (month >= currentMonthKey()) return NextResponse.json({ error: "Só dá para aprovar meses já encerrados." }, { status: 409, headers: noStoreHeaders() });
    if (payout) return NextResponse.json({ error: "Este mês já foi aprovado." }, { status: 409, headers: noStoreHeaders() });
    const { from, to } = monthBounds(month);
    const totals = await prisma.influencerSale.aggregate({ where: { influencerId: id, status: InfluencerSaleStatus.CONFIRMED, occurredAt: { gte: from, lt: to } }, _count: { _all: true }, _sum: { commissionCents: true } });
    if (!totals._count._all) return NextResponse.json({ error: "Não há vendas neste mês." }, { status: 409, headers: noStoreHeaders() });
    if (!totals._sum.commissionCents) return NextResponse.json({ error: "As vendas deste mês não têm comissão a repassar." }, { status: 409, headers: noStoreHeaders() });
    await prisma.influencerPayout.create({ data: { influencerId: id, month, status: InfluencerPayoutStatus.APPROVED, amountCents: totals._sum.commissionCents ?? 0, salesCount: totals._count._all, approvedAt: now, approvedById: staff.id } });
    return NextResponse.json({ status: "APPROVED" }, { headers: noStoreHeaders() });
  }
  if (action === "pay") {
    if (!payout || payout.status !== InfluencerPayoutStatus.APPROVED) return NextResponse.json({ error: "Aprove o mês antes de marcar como pago." }, { status: 409, headers: noStoreHeaders() });
    await prisma.influencerPayout.update({ where: { id: payout.id }, data: { status: InfluencerPayoutStatus.PAID, paidAt: now, paidById: staff.id } });
    return NextResponse.json({ status: "PAID" }, { headers: noStoreHeaders() });
  }
  if (!payout || payout.status !== InfluencerPayoutStatus.APPROVED) return NextResponse.json({ error: "Só dá para desfazer um mês aprovado e ainda não pago." }, { status: 409, headers: noStoreHeaders() });
  await prisma.influencerPayout.delete({ where: { id: payout.id } });
  return NextResponse.json({ status: null }, { headers: noStoreHeaders() });
}
