import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";
import { EvolutionError, sendText } from "@/lib/whatsapp/evolution";
import { toWhatsappNumber } from "@/lib/whatsapp/phone";
import { getEvolutionConfig } from "@/lib/whatsapp/settings";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  const user = await getCurrentUser();
  if (user?.role !== UserRole.ADMIN) return NextResponse.json({ error: "Sem permissão" }, { status: 403, headers: noStoreHeaders() });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const to = toWhatsappNumber(typeof body.to === "string" ? body.to : "");
  if (!to) return NextResponse.json({ error: "Informe um número com DDD." }, { status: 400, headers: noStoreHeaders() });
  const config = await getEvolutionConfig();
  if (!config) return NextResponse.json({ error: "Salve a conexão com a Evolution primeiro." }, { status: 400, headers: noStoreHeaders() });
  try {
    await sendText(config, to, "Teste da gestão Pace Lab: o WhatsApp está conectado.");
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof EvolutionError ? error.message : "Não foi possível enviar." }, { status: 400, headers: noStoreHeaders() });
  }
}
