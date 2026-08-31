import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders, publicUrl } from "@/lib/security";
import { createOpaqueToken, hashOpaqueToken } from "@/lib/tokens";
import { DEFAULT_ALLOWED_METHODS, DEFAULT_BILLING_PRICE_CENTS, parseAllowedMethods } from "@/lib/billing";
import { planDisplayName } from "@/lib/plans";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  const admin = await getCurrentUser();
  if (!admin || admin.role !== UserRole.ADMIN) return NextResponse.json({ error: "Apenas administradores podem gerar links" }, { status: 403, headers: noStoreHeaders() });

  let body: Record<string, unknown> = {};
  const rawBody = await request.text();
  if (rawBody.trim()) {
    try {
      const parsed = JSON.parse(rawBody) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400, headers: noStoreHeaders() });
    }
  }
  const allowedMethods = body.allowedMethods === undefined ? [...DEFAULT_ALLOWED_METHODS] : parseAllowedMethods(body.allowedMethods);
  const requestedPlanId = typeof body.planId === "string" ? body.planId : "";
  const plan = requestedPlanId ? await prisma.plan.findFirst({ where: { id: requestedPlanId, active: true, service: { active: true } }, include: { service: true } }) : null;
  if (requestedPlanId && !plan) return NextResponse.json({ error: "O plano escolhido não está disponível" }, { status: 400, headers: noStoreHeaders() });
  if (!allowedMethods) return NextResponse.json({ error: "Selecione ao menos um método de pagamento" }, { status: 400, headers: noStoreHeaders() });
  const rawToken = createOpaqueToken();
  await prisma.paymentLink.create({ data: { tokenHash: hashOpaqueToken(rawToken), createdById: admin.id, planId: plan?.id, planName: plan ? planDisplayName(plan) : undefined, amountCents: plan?.priceCents ?? DEFAULT_BILLING_PRICE_CENTS, allowedMethods } });
  const paymentUrl = publicUrl(request, `/pagamento/${rawToken}`);
  return NextResponse.json({ paymentUrl }, { headers: noStoreHeaders() });
}
