import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { managementAppUrl } from "@/lib/portal";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";
import { EvolutionError, setWebhook } from "@/lib/whatsapp/evolution";
import { getEvolutionConfig, rotateWebhookToken } from "@/lib/whatsapp/settings";

export const dynamic = "force-dynamic";

// Gera um token novo e cadastra o webhook na instância (evento MESSAGES_UPSERT).
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  const user = await getCurrentUser();
  if (user?.role !== UserRole.ADMIN) return NextResponse.json({ error: "Sem permissão" }, { status: 403, headers: noStoreHeaders() });
  const config = await getEvolutionConfig();
  if (!config) return NextResponse.json({ error: "Salve a URL, a API key e a instância antes de conectar o webhook." }, { status: 400, headers: noStoreHeaders() });
  const token = await rotateWebhookToken();
  const url = `${managementAppUrl()}/api/webhooks/evolution/${token}`;
  try {
    await setWebhook(config, url);
    return NextResponse.json({ ok: true, url: url.replace(token, `${token.slice(0, 4)}…`) }, { headers: noStoreHeaders() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof EvolutionError ? error.message : "Não foi possível cadastrar o webhook." }, { status: 400, headers: noStoreHeaders() });
  }
}
