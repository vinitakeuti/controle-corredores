import { NextResponse } from "next/server";
import { createSession, defaultPathForRole, verifyCredentials } from "@/lib/auth";
import { checkLoginRateLimit, clearLoginFailures, loginRateLimitKeys, registerLoginFailure } from "@/lib/rate-limit";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
      return NextResponse.json({ error: "Formato inválido" }, { status: 415, headers: noStoreHeaders() });
    }
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 16_384) return NextResponse.json({ error: "Requisição muito grande" }, { status: 413, headers: noStoreHeaders() });

    const body = await request.json();
    const email = typeof body.email === "string" ? body.email : "";
    const password = typeof body.password === "string" ? body.password : "";
    const keys = loginRateLimitKeys(email, request);
    const limit = checkLoginRateLimit(keys);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Muitas tentativas. Tente novamente mais tarde." }, { status: 429, headers: { ...noStoreHeaders(), "Retry-After": String(limit.retryAfterSeconds) } });
    }

    if (email.length > 254 || password.length > 128) {
      registerLoginFailure(keys);
      return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401, headers: noStoreHeaders() });
    }

    const user = await verifyCredentials(email, password);

    if (!user) {
      registerLoginFailure(keys);
      return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401, headers: noStoreHeaders() });
    }

    clearLoginFailures(keys);
    await createSession(user.id, request);
    return NextResponse.json({ redirectTo: defaultPathForRole(user.role) }, { headers: noStoreHeaders() });
  } catch {
    return NextResponse.json({ error: "Não foi possível entrar" }, { status: 400, headers: noStoreHeaders() });
  }
}
