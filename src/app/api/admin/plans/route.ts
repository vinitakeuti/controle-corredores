import { NextResponse } from "next/server";
import { PaymentMethod, PlanPeriod, UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { DEFAULT_ALLOWED_METHODS, parseAllowedMethods, parseAmountCents } from "@/lib/billing";
import { getStaffPlans, parsePlanName, parsePlanPeriod, planDisplayName } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

class PlanConflict extends Error {}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== UserRole.ADMIN) return NextResponse.json({ error: "Apenas administradores podem consultar planos" }, { status: 403, headers: noStoreHeaders() });
  return NextResponse.json({ plans: await getStaffPlans() }, { headers: noStoreHeaders() });
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
    const user = await getCurrentUser();
    if (!user || user.role !== UserRole.ADMIN) return NextResponse.json({ error: "Apenas administradores podem criar planos" }, { status: 403, headers: noStoreHeaders() });
    const body = await request.json() as Record<string, unknown>;
    const serviceId = typeof body.serviceId === "string" ? body.serviceId : "";
    const serviceName = typeof body.serviceName === "string" ? body.serviceName.trim().replace(/\s+/g, " ") : "";
    // Cortesia é sempre oculta: um plano grátis visível poderia ser escolhido por qualquer aluno.
    const isCourtesy = body.isCourtesy === true;
    const isHidden = isCourtesy || body.isHidden === true;
    const name = isHidden ? parsePlanName(body.name) : null;
    const period = isCourtesy ? PlanPeriod.MONTHLY : parsePlanPeriod(body.period);
    const priceCents = isCourtesy ? 0 : parseAmountCents(body.priceCents);
    const allowedMethods = isCourtesy ? [PaymentMethod.PIX] : body.allowedMethods === undefined ? [...DEFAULT_ALLOWED_METHODS] : parseAllowedMethods(body.allowedMethods);
    const automaticPixEnabled = isCourtesy ? false : body.automaticPixEnabled === undefined ? true : body.automaticPixEnabled === true;
    const isFeatured = !isHidden && body.isFeatured === true;
    if (!serviceId && (serviceName.length < 2 || serviceName.length > 80)) return NextResponse.json({ error: "Informe o nome da categoria." }, { status: 400, headers: noStoreHeaders() });
    if (isHidden && !name) return NextResponse.json({ error: "Dê um nome ao plano oculto (de 2 a 60 caracteres) para a equipe reconhecê-lo." }, { status: 400, headers: noStoreHeaders() });
    if (!period || (!isCourtesy && !priceCents) || !allowedMethods) return NextResponse.json({ error: "Informe serviço, período, valor e pelo menos um método de pagamento." }, { status: 400, headers: noStoreHeaders() });

    const service = serviceId
      ? await prisma.service.findUnique({ where: { id: serviceId } })
      : await prisma.service.upsert({ where: { name: serviceName }, update: { active: true }, create: { name: serviceName } });
    if (!service) return NextResponse.json({ error: "Serviço não encontrado." }, { status: 404, headers: noStoreHeaders() });
    const plan = await prisma.$transaction(async (transaction) => {
      const duplicate = isHidden
        ? await transaction.plan.findFirst({ where: { serviceId: service.id, isHidden: true, name: { equals: name!, mode: "insensitive" }, period }, select: { id: true } })
        : await transaction.plan.findFirst({ where: { serviceId: service.id, isHidden: false, period }, select: { id: true } });
      if (duplicate) throw new PlanConflict(isHidden ? "Já existe um plano oculto com esse nome e período nesta categoria." : "Esse serviço já possui um plano para esse período.");
      if (isFeatured) await transaction.plan.updateMany({ where: { serviceId: service.id, isFeatured: true }, data: { isFeatured: false } });
      return transaction.plan.create({ data: { serviceId: service.id, period, priceCents: priceCents ?? 0, name, isHidden, isCourtesy, allowedMethods, automaticPixEnabled, isFeatured }, include: { service: true } });
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ plan: { ...plan, label: planDisplayName(plan) } }, { headers: noStoreHeaders() });
  } catch (error) {
    const message = error instanceof PlanConflict ? error.message : "Não foi possível criar o plano.";
    return NextResponse.json({ error: message }, { status: error instanceof PlanConflict ? 409 : 400, headers: noStoreHeaders() });
  }
}
