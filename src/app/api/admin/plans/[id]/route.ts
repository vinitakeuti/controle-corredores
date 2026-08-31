import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { parseAmountCents } from "@/lib/billing";
import { parsePlanPeriod } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
    const user = await getCurrentUser();
    if (!user || user.role !== UserRole.ADMIN) return NextResponse.json({ error: "Apenas administradores podem editar planos" }, { status: 403, headers: noStoreHeaders() });
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const current = await prisma.plan.findUnique({ where: { id } });
    if (!current) return NextResponse.json({ error: "Plano não encontrado." }, { status: 404, headers: noStoreHeaders() });
    const priceCents = body.priceCents === undefined ? current.priceCents : parseAmountCents(body.priceCents);
    const period = body.period === undefined ? current.period : parsePlanPeriod(body.period);
    const active = body.active === undefined ? current.active : body.active === true;
    if (!priceCents || !period) return NextResponse.json({ error: "Informe período e valor válidos." }, { status: 400, headers: noStoreHeaders() });
    const plan = await prisma.plan.update({ where: { id }, data: { priceCents, period, active }, include: { service: true } });
    return NextResponse.json({ plan }, { headers: noStoreHeaders() });
  } catch (error) {
    const message = error instanceof Error && /Unique constraint/.test(error.message) ? "Esse serviço já possui um plano para esse período." : "Não foi possível atualizar o plano.";
    return NextResponse.json({ error: message }, { status: 400, headers: noStoreHeaders() });
  }
}
