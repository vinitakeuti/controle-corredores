import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { OpenRouterError, verifyKey } from "@/lib/ai/openrouter";
import { getAiApiKey } from "@/lib/ai/settings";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

export const dynamic = "force-dynamic";

// Testa a chave digitada (antes de salvar) ou a que já está salva.
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  const user = await getCurrentUser();
  if (user?.role !== UserRole.ADMIN) return NextResponse.json({ error: "Sem permissão" }, { status: 403, headers: noStoreHeaders() });
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const typed = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const apiKey = typed || await getAiApiKey();
    if (!apiKey) return NextResponse.json({ error: "Digite ou salve uma chave do OpenRouter para testar." }, { status: 400, headers: noStoreHeaders() });
    const info = await verifyKey(apiKey);
    return NextResponse.json({ ok: true, info }, { headers: noStoreHeaders() });
  } catch (error) {
    const message = error instanceof OpenRouterError ? error.message : "Não foi possível testar a chave agora.";
    return NextResponse.json({ error: message }, { status: 400, headers: noStoreHeaders() });
  }
}
