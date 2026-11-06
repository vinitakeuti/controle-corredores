import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";
import { EvolutionError } from "@/lib/whatsapp/evolution";
import { canUseWhatsAppInbox, loadWhatsAppView, sendHumanReply } from "@/lib/whatsapp/inbox";

export const dynamic = "force-dynamic";

// A equipe responde pela gestão; a mensagem sai pelo WhatsApp da Pace Lab.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  const user = await getCurrentUser();
  if (!user || !canUseWhatsAppInbox(user)) return NextResponse.json({ error: "Sem permissão" }, { status: 403, headers: noStoreHeaders() });
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 4000) : "";
  if (!text) return NextResponse.json({ error: "Escreva a mensagem." }, { status: 400, headers: noStoreHeaders() });
  try {
    await sendHumanReply(id, text, { id: user.id, name: user.name });
    return NextResponse.json({ view: await loadWhatsAppView(id) }, { headers: noStoreHeaders() });
  } catch (error) {
    const message = error instanceof EvolutionError || error instanceof Error ? error.message : "Não foi possível enviar.";
    return NextResponse.json({ error: message }, { status: 400, headers: noStoreHeaders() });
  }
}
