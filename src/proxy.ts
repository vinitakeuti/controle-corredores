import { NextResponse, type NextRequest } from "next/server";
import { isStudentPortalEnabled, portalForHost, portalUrl } from "@/lib/portal";

function isStudentPage(pathname: string) {
  return pathname === "/aluno" || pathname.startsWith("/aluno/") || pathname === "/pagamento" || pathname.startsWith("/pagamento/");
}

function isStudentApi(pathname: string) {
  return /^\/api\/(student|payments|checkout)(\/|$)/.test(pathname);
}

function isManagementPage(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isManagementApi(pathname: string) {
  return /^\/api\/(admin|cron|webhooks|demandas)(\/|$)/.test(pathname);
}

function unavailableApi() {
  return NextResponse.json({ error: "Esta rota não está disponível neste portal." }, { status: 404 });
}

export function proxy(request: NextRequest) {
  if (!isStudentPortalEnabled()) return NextResponse.next();

  const portal = portalForHost(request.headers.get("host"));
  const { pathname, search } = request.nextUrl;
  const destination = `${pathname}${search}`;

  if (portal === "MANAGEMENT") {
    if (isStudentApi(pathname)) return unavailableApi();
    if (isStudentPage(pathname)) return NextResponse.redirect(portalUrl("STUDENT", destination));
  }

  if (portal === "STUDENT") {
    if (isManagementApi(pathname)) return unavailableApi();
    if (isManagementPage(pathname)) return NextResponse.redirect(portalUrl("MANAGEMENT", destination));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|assets/).*)"],
};
