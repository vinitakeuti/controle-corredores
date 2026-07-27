import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  await destroySession();
  const requestUrl = new URL(request.url);
  const host = request.headers.get("host") || requestUrl.host;
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || requestUrl.protocol.replace(":", "");
  const url = new URL("/login", `${protocol}://${host}`);
  return NextResponse.redirect(url, { status: 303, headers: noStoreHeaders() });
}
