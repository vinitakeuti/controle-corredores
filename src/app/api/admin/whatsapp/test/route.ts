import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";
import { connectionState, EvolutionError } from "@/lib/whatsapp/evolution";
import { getEvolutionConfig } from "@/lib/whatsapp/settings";

export const dynamic = "force-dynamic";

const stateLabels: Record<string, string> = { open: "conectado", close: "desconectado", connecting: "conectando" };

// Testa a conexão com o que foi digitado (antes de salvar) ou com o que já está salvo.
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  const user = await getCurrentUser();
  if (user?.role !== UserRole.ADMIN) return NextResponse.json({ error: "Sem permissão" }, { status: 403, headers: noStoreHeaders() });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const saved = await getEvolutionConfig();
  const config = {
    baseUrl: typeof body.baseUrl === "string" && body.baseUrl.trim() ? body.baseUrl.trim().replace(/\/+$/, "") : saved?.baseUrl ?? "",
    apiKey: typeof body.apiKey === "string" && body.apiKey.trim() ? body.apiKey.trim() : saved?.apiKey ?? "",
    instance: typeof body.instance === "string" && body.instance.trim() ? body.instance.trim() : saved?.instance ?? "",
  };
  if (!config.baseUrl || !config.apiKey || !config.instance) return NextResponse.json({ error: "Preencha a URL, a API key e o nome da instância." }, { status: 400, headers: noStoreHeaders() });
  try {
    const state = await connectionState(config);
    return NextResponse.json({ state, label: stateLabels[state] ?? state }, { headers: noStoreHeaders() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof EvolutionError ? error.message : "Não foi possível testar a conexão." }, { status: 400, headers: noStoreHeaders() });
  }
}
