import { NextResponse } from "next/server";
import { AiChannel, UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { cleanTitle } from "@/lib/ai/conversations";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";
import { canUseWhatsAppInbox, loadWhatsAppView } from "@/lib/whatsapp/inbox";
import { getWhatsAppRecord } from "@/lib/whatsapp/settings";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user || !canUseWhatsAppInbox(user)) return NextResponse.json({ error: "Sem permissão" }, { status: 403, headers: noStoreHeaders() });
  const view = await loadWhatsAppView((await params).id);
  if (!view) return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404, headers: noStoreHeaders() });
  return NextResponse.json({ view }, { headers: noStoreHeaders() });
}

// pause: a IA para por algumas horas · resume: volta a responder · resolve: tira o "precisa de atendimento" · rename
export async function PATCH(request: Request, { params }: Params) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  const user = await getCurrentUser();
  if (!user || !canUseWhatsAppInbox(user)) return NextResponse.json({ error: "Sem permissão" }, { status: 403, headers: noStoreHeaders() });
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const settings = await getWhatsAppRecord();
  const hours = settings?.pauseHours ?? 12;
  // Grupo interno da equipe: só administradores marcam, porque libera dados internos no grupo.
  if (body.action === "internal" || body.action === "external") {
    if (user.role !== UserRole.ADMIN) return NextResponse.json({ error: "Só administradores definem grupos internos." }, { status: 403, headers: noStoreHeaders() });
    const conversation = await prisma.aiConversation.findFirst({ where: { id, channel: AiChannel.WHATSAPP, isGroup: true }, select: { externalId: true } });
    if (!conversation?.externalId) return NextResponse.json({ error: "Grupo não encontrado." }, { status: 404, headers: noStoreHeaders() });
    const groupJid = conversation.externalId.replace(/#equipe$/, "");
    const current = new Set(settings?.internalGroups ?? []);
    if (body.action === "internal") current.add(groupJid); else current.delete(groupJid);
    await prisma.whatsAppSettings.update({ where: { id: "platform" }, data: { internalGroups: [...current] } });
    return NextResponse.json({ view: await loadWhatsAppView(id) }, { headers: noStoreHeaders() });
  }
  const data = body.action === "pause" ? { aiPausedUntil: new Date(Date.now() + hours * 3_600_000) }
    : body.action === "resume" ? { aiPausedUntil: null }
    : body.action === "resolve" ? { needsHuman: false, needsHumanReason: null }
    : body.action === "rename" && cleanTitle(body.title) ? { title: cleanTitle(body.title) }
    : null;
  if (!data) return NextResponse.json({ error: "Ação inválida." }, { status: 400, headers: noStoreHeaders() });
  const updated = await prisma.aiConversation.updateMany({ where: { id, channel: AiChannel.WHATSAPP }, data });
  if (!updated.count) return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404, headers: noStoreHeaders() });
  return NextResponse.json({ view: await loadWhatsAppView(id) }, { headers: noStoreHeaders() });
}
