import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
    const user = await getCurrentUser();
    if (!user || user.role !== UserRole.ADMIN) return NextResponse.json({ error: "Apenas administradores podem excluir categorias" }, { status: 403, headers: noStoreHeaders() });
    const { id } = await context.params;
    const service = await prisma.service.findUnique({ where: { id }, include: { plans: { select: { id: true, subscriptions: { where: { status: { in: ["ACTIVE", "PAST_DUE", "INCOMPLETE"] } }, select: { id: true }, take: 1 }, paymentLinks: { where: { status: "OPEN" }, select: { id: true }, take: 1 } } } } });
    if (!service) return NextResponse.json({ error: "Categoria não encontrada." }, { status: 404, headers: noStoreHeaders() });
    if (service.plans.some((plan) => plan.subscriptions.length || plan.paymentLinks.length)) return NextResponse.json({ error: "Esta categoria possui planos ligados a alunos ou links abertos. Pause os planos para impedir novas escolhas, mas mantenha a categoria para preservar as cobranças atuais." }, { status: 409, headers: noStoreHeaders() });
    await prisma.$transaction(async (transaction) => {
      await transaction.plan.deleteMany({ where: { serviceId: service.id } });
      await transaction.service.delete({ where: { id: service.id } });
    });
    return NextResponse.json({ deleted: true }, { headers: noStoreHeaders() });
  } catch {
    return NextResponse.json({ error: "Não foi possível excluir a categoria." }, { status: 400, headers: noStoreHeaders() });
  }
}
