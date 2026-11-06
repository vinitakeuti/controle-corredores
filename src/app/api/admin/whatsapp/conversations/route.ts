import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { noStoreHeaders } from "@/lib/security";
import { canUseWhatsAppInbox, listWhatsAppConversations } from "@/lib/whatsapp/inbox";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canUseWhatsAppInbox(user)) return NextResponse.json({ error: "Sem permissão" }, { status: 403, headers: noStoreHeaders() });
  const params = new URL(request.url).searchParams;
  const page = await listWhatsAppConversations({ query: (params.get("q") ?? "").trim().slice(0, 80), cursor: params.get("cursor"), onlyNeedsHuman: params.get("filtro") === "atendimento" });
  return NextResponse.json(page, { headers: noStoreHeaders() });
}
