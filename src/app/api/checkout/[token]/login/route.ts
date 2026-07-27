import { NextResponse } from "next/server";
import { PaymentLinkStatus, UserRole } from "@prisma/client";
import { createSession, verifyCredentials } from "@/lib/auth";
import { checkLoginRateLimit, clearLoginFailures, loginRateLimitKeys, registerLoginFailure } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";
import { hashOpaqueToken } from "@/lib/tokens";

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
    const { token } = await context.params;
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const keys = loginRateLimitKeys(email, request);
    const limit = checkLoginRateLimit(keys);
    if (!limit.allowed) return NextResponse.json({ error: "Muitas tentativas. Tente novamente mais tarde." }, { status: 429, headers: { ...noStoreHeaders(), "Retry-After": String(limit.retryAfterSeconds) } });

    const link = await prisma.paymentLink.findUnique({ where: { tokenHash: hashOpaqueToken(token) }, select: { status: true, userId: true } });
    if (!link || link.status !== PaymentLinkStatus.OPEN || !link.userId) return NextResponse.json({ error: "Link de pagamento inválido ou indisponível" }, { status: 404, headers: noStoreHeaders() });
    if (email.length > 254 || password.length > 128) {
      registerLoginFailure(keys);
      return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401, headers: noStoreHeaders() });
    }

    const user = await verifyCredentials(email, password);
    if (!user || user.id !== link.userId || user.role !== UserRole.STUDENT) {
      registerLoginFailure(keys);
      return NextResponse.json({ error: "E-mail ou senha inválidos" }, { status: 401, headers: noStoreHeaders() });
    }

    clearLoginFailures(keys);
    await createSession(user.id, request);
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
  } catch {
    return NextResponse.json({ error: "Não foi possível entrar" }, { status: 400, headers: noStoreHeaders() });
  }
}
