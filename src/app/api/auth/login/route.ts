import { NextResponse } from "next/server";
import { createSession, defaultPathForRole, isStaffRole, verifyCredentials } from "@/lib/auth";
import { isStudentPortalEnabled, portalForHost, portalUrlForRole } from "@/lib/portal";
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

    if (isStudentPortalEnabled()) {
      const portal = portalForHost(request.headers.get("host"));
      if (portal === "STUDENT" && isStaffRole(user.role)) {
        return NextResponse.json({ error: "Este acesso é exclusivo para alunos. Use o portal de gestão." }, { status: 403, headers: noStoreHeaders() });
      }
      if (portal === "MANAGEMENT" && !isStaffRole(user.role)) {
        return NextResponse.json({ error: "Este acesso é exclusivo para a equipe. Use o portal do aluno." }, { status: 403, headers: noStoreHeaders() });
      }
    }

    clearLoginFailures(keys);
    await createSession(user.id, request);
    return NextResponse.json({ redirectTo: portalUrlForRole(user.role, defaultPathForRole(user.role)) }, { headers: noStoreHeaders() });
  } catch {
    return NextResponse.json({ error: "Não foi possível entrar" }, { status: 400, headers: noStoreHeaders() });
  }
}
