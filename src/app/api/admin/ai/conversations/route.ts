import { NextResponse } from "next/server";
import { canAccessFeature, getCurrentUser } from "@/lib/auth";
import { listConversations } from "@/lib/ai/conversations";
import { prisma } from "@/lib/prisma";
import { noStoreHeaders } from "@/lib/security";

export const dynamic = "force-dynamic";

// ?q= busca no título; ?cursor= continua a partir da última conversa carregada.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canAccessFeature(user, "assistant")) return NextResponse.json({ error: "Sem permissão" }, { status: 403, headers: noStoreHeaders() });
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim().slice(0, 80);
  const cursorId = params.get("cursor");
  const cursor = cursorId && await prisma.aiConversation.findFirst({ where: { id: cursorId, userId: user.id }, select: { id: true } }) ? cursorId : null;
  const page = await listConversations(user.id, { query, cursor });
  return NextResponse.json(page, { headers: noStoreHeaders() });
}
