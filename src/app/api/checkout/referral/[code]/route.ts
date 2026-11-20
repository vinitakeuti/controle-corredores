import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { createSession } from "@/lib/auth";
import { findActiveInfluencerByCoupon } from "@/lib/influencers";
import { getPublicPlans } from "@/lib/plans";
import { checkSignupRateLimit } from "@/lib/rate-limit";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";
import { createSelfSignupStudent, validateSelfSignup } from "@/lib/self-signup";

// Cadastro pelo link de indicação de um Expert/Creator: o cupom vem do link e
// fica gravado como a indicação do aluno (uma só, mesmo que ele digite o cupom depois).
export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  const limit = checkSignupRateLimit(request);
  if (!limit.allowed) return NextResponse.json({ error: "Muitos cadastros seguidos desta rede. Tente de novo em alguns minutos." }, { status: 429, headers: { ...noStoreHeaders(), "Retry-After": String(limit.retryAfterSeconds) } });
  try {
    const { code } = await context.params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers: noStoreHeaders() });
    const input = body as Record<string, unknown>;
    const influencer = await findActiveInfluencerByCoupon(code);
    if (!influencer) return NextResponse.json({ error: "Este link de indicação não está mais ativo." }, { status: 410, headers: noStoreHeaders() });
    const plan = (await getPublicPlans()).find((item) => item.id === input.planId);
    if (!plan) return NextResponse.json({ error: "Escolha um dos planos disponíveis." }, { status: 400, headers: noStoreHeaders() });
    const signup = await validateSelfSignup(input);
    if (!signup.ok) return NextResponse.json({ error: signup.error }, { status: signup.status, headers: noStoreHeaders() });
    const student = await createSelfSignupStudent({ data: signup.data, password: signup.password, plan, saleOwnerId: null, influencerId: influencer.id });
    await createSession(student.id, request);
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "Já existe uma conta com estes dados. Entre com sua senha na área do aluno." }, { status: 409, headers: noStoreHeaders() });
    console.error("referral signup failed", error);
    return NextResponse.json({ error: "Não foi possível concluir o cadastro." }, { status: 400, headers: noStoreHeaders() });
  }
}
