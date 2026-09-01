import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { DEFAULT_ALLOWED_METHODS, parseAllowedMethods, parseAmountCents } from "@/lib/billing";
import { getActivePlans, parsePlanPeriod, planDisplayName } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== UserRole.ADMIN) return NextResponse.json({ error: "Apenas administradores podem consultar planos" }, { status: 403, headers: noStoreHeaders() });
  return NextResponse.json({ plans: await getActivePlans() }, { headers: noStoreHeaders() });
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
    const user = await getCurrentUser();
    if (!user || user.role !== UserRole.ADMIN) return NextResponse.json({ error: "Apenas administradores podem criar planos" }, { status: 403, headers: noStoreHeaders() });
    const body = await request.json() as Record<string, unknown>;
    const serviceId = typeof body.serviceId === "string" ? body.serviceId : "";
    const serviceName = typeof body.serviceName === "string" ? body.serviceName.trim().replace(/\s+/g, " ") : "";
    const period = parsePlanPeriod(body.period);
    const priceCents = parseAmountCents(body.priceCents);
    const allowedMethods = body.allowedMethods === undefined ? [...DEFAULT_ALLOWED_METHODS] : parseAllowedMethods(body.allowedMethods);
    const automaticPixEnabled = body.automaticPixEnabled === undefined ? true : body.automaticPixEnabled === true;
    if ((!serviceId && (serviceName.length < 2 || serviceName.length > 80)) || !period || !priceCents || !allowedMethods) return NextResponse.json({ error: "Informe serviço, período, valor e pelo menos um método de pagamento." }, { status: 400, headers: noStoreHeaders() });

    const service = serviceId
      ? await prisma.service.findUnique({ where: { id: serviceId } })
      : await prisma.service.upsert({ where: { name: serviceName }, update: { active: true }, create: { name: serviceName } });
    if (!service) return NextResponse.json({ error: "Serviço não encontrado." }, { status: 404, headers: noStoreHeaders() });
    const plan = await prisma.plan.create({ data: { serviceId: service.id, period, priceCents, allowedMethods, automaticPixEnabled }, include: { service: true } });
    return NextResponse.json({ plan: { ...plan, label: planDisplayName(plan) } }, { headers: noStoreHeaders() });
  } catch (error) {
    const message = error instanceof Error && /Unique constraint/.test(error.message) ? "Esse serviço já possui um plano para esse período." : "Não foi possível criar o plano.";
    return NextResponse.json({ error: message }, { status: 400, headers: noStoreHeaders() });
  }
}
