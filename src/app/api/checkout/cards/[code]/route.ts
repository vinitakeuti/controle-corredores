import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { createSession } from "@/lib/auth";
import { resolveSignupCoupon } from "@/lib/influencers";
import { checkSignupRateLimit } from "@/lib/rate-limit";
import { findSalesCardByCode, salesCardStatus } from "@/lib/sales-cards";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";
import { createSelfSignupStudent, validateSelfSignup } from "@/lib/self-signup";

// Cadastro pelo QR de evento: a pessoa escolhe um dos planos do cartão,
// cria a conta e já entra para pagar (ou fica ativa, se for cortesia).
export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  const limit = checkSignupRateLimit(request);
  if (!limit.allowed) return NextResponse.json({ error: "Muitos cadastros seguidos desta rede. Tente de novo em alguns minutos." }, { status: 429, headers: { ...noStoreHeaders(), "Retry-After": String(limit.retryAfterSeconds) } });
  try {
    const { code } = await context.params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers: noStoreHeaders() });
    const input = body as Record<string, unknown>;

    const card = await findSalesCardByCode(code);
    if (!card) return NextResponse.json({ error: "QR Code inválido." }, { status: 404, headers: noStoreHeaders() });
    if (salesCardStatus(card) !== "active") return NextResponse.json({ error: "Este QR Code expirou. Fale com a equipe da Pace Lab." }, { status: 410, headers: noStoreHeaders() });
    const plan = card.plans.find((item) => item.id === input.planId);
    if (!plan) return NextResponse.json({ error: "Escolha um dos planos disponíveis." }, { status: 400, headers: noStoreHeaders() });

    const signup = await validateSelfSignup(input);
    if (!signup.ok) return NextResponse.json({ error: signup.error }, { status: signup.status, headers: noStoreHeaders() });
    const coupon = await resolveSignupCoupon(input.couponCode);
    if (!coupon.ok) return NextResponse.json({ error: coupon.error }, { status: 400, headers: noStoreHeaders() });

    const student = await createSelfSignupStudent({ data: signup.data, password: signup.password, plan, saleOwnerId: card.createdById, salesCardId: card.id, influencerId: coupon.influencerId });
    await createSession(student.id, request);
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "Já existe uma conta com estes dados. Entre com sua senha na área do aluno." }, { status: 409, headers: noStoreHeaders() });
    console.error("sales card signup failed", error);
    return NextResponse.json({ error: "Não foi possível concluir o cadastro." }, { status: 400, headers: noStoreHeaders() });
  }
}
