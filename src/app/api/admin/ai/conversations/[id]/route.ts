import { NextResponse } from "next/server";
import { canAccessFeature, getCurrentUser } from "@/lib/auth";
import { loadConversationView } from "@/lib/ai/agent";
import { cleanTitle } from "@/lib/ai/conversations";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user || !canAccessFeature(user, "assistant")) return NextResponse.json({ error: "Sem permissão" }, { status: 403, headers: noStoreHeaders() });
  const { id } = await params;
  const view = await loadConversationView(id, user.id);
  if (!view) return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404, headers: noStoreHeaders() });
  return NextResponse.json({ view }, { headers: noStoreHeaders() });
}

// Renomeia a conversa (só quem é dono dela).
export async function PATCH(request: Request, { params }: Params) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  const user = await getCurrentUser();
  if (!user || !canAccessFeature(user, "assistant")) return NextResponse.json({ error: "Sem permissão" }, { status: 403, headers: noStoreHeaders() });
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const title = cleanTitle(body.title);
  if (!title) return NextResponse.json({ error: "Dê um nome para a conversa." }, { status: 400, headers: noStoreHeaders() });
  const updated = await prisma.aiConversation.updateMany({ where: { id, userId: user.id, archivedAt: null }, data: { title } });
  if (!updated.count) return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404, headers: noStoreHeaders() });
  return NextResponse.json({ title }, { headers: noStoreHeaders() });
}

// Arquiva (some da lista). As mensagens ficam guardadas para o registro de custos.
export async function DELETE(request: Request, { params }: Params) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  const user = await getCurrentUser();
  if (!user || !canAccessFeature(user, "assistant")) return NextResponse.json({ error: "Sem permissão" }, { status: 403, headers: noStoreHeaders() });
  const { id } = await params;
  const updated = await prisma.aiConversation.updateMany({ where: { id, userId: user.id, archivedAt: null }, data: { archivedAt: new Date() } });
  if (!updated.count) return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404, headers: noStoreHeaders() });
  return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
}
