import { timingSafeEqual } from "node:crypto";
import { after, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { noStoreHeaders } from "@/lib/security";
import { hashOpaqueToken } from "@/lib/tokens";
import { handleEvolutionEvent } from "@/lib/whatsapp/inbound";

export const dynamic = "force-dynamic";
const MAX_BODY = 1_000_000;

function sameHash(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Webhook da Evolution API. O token secreto vai no caminho; respondemos na hora e processamos
// a mensagem depois da resposta, para a Evolution não esperar a IA.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const settings = await prisma.whatsAppSettings.findUnique({ where: { id: "platform" }, select: { webhookTokenHash: true, enabled: true } });
  if (!settings?.webhookTokenHash) return NextResponse.json({ error: "Webhook não configurado" }, { status: 503, headers: noStoreHeaders() });
  if (!token || token.length > 200 || !sameHash(hashOpaqueToken(token), settings.webhookTokenHash)) return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: noStoreHeaders() });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) return NextResponse.json({ error: "Evento grande demais" }, { status: 413, headers: noStoreHeaders() });
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400, headers: noStoreHeaders() }); }
  if (settings.enabled) after(() => handleEvolutionEvent(payload).catch((error) => console.error("evolution webhook failed", error)));
  return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
}
