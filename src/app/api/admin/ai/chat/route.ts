import { NextResponse } from "next/server";
import { canAccessFeature, getCurrentUser } from "@/lib/auth";
import { AssistantError, loadConversationView, runAssistantTurn, staffContext } from "@/lib/ai/agent";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_MESSAGE = 4000;
const WINDOW_MS = 5 * 60 * 1000;
const MAX_PER_WINDOW = 40;
const recent = new Map<string, number[]>();

// Limite simples por pessoa para um clique repetido não virar uma conta alta.
function allow(userId: string) {
  const now = Date.now();
  const list = (recent.get(userId) ?? []).filter((time) => now - time < WINDOW_MS);
  if (list.length >= MAX_PER_WINDOW) { recent.set(userId, list); return false; }
  list.push(now);
  recent.set(userId, list);
  return true;
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  const user = await getCurrentUser();
  if (!user || !canAccessFeature(user, "assistant")) return NextResponse.json({ error: "Sem permissão para usar o assistente." }, { status: 403, headers: noStoreHeaders() });
  if (!allow(user.id)) return NextResponse.json({ error: "Muitas mensagens seguidas. Aguarde alguns minutos." }, { status: 429, headers: noStoreHeaders() });

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return NextResponse.json({ error: "Mensagem inválida." }, { status: 400, headers: noStoreHeaders() }); }
  const text = typeof body.message === "string" ? body.message.trim() : "";
  const conversationId = typeof body.conversationId === "string" && body.conversationId ? body.conversationId : null;
  if (!text) return NextResponse.json({ error: "Escreva uma mensagem." }, { status: 400, headers: noStoreHeaders() });
  if (text.length > MAX_MESSAGE) return NextResponse.json({ error: `Mensagem longa demais (máximo de ${MAX_MESSAGE} caracteres).` }, { status: 400, headers: noStoreHeaders() });

  try {
    const turn = await runAssistantTurn({ conversationId, text, context: staffContext(user) });
    const view = await loadConversationView(turn.conversationId, user.id);
    return NextResponse.json({ view }, { headers: noStoreHeaders() });
  } catch (error) {
    if (error instanceof AssistantError) {
      // A conversa pode ter sido criada e registrado o erro; devolve a vista para a tela se atualizar.
      const id = error.conversationId ?? conversationId;
      const view = id ? await loadConversationView(id, user.id) : null;
      return NextResponse.json({ error: error.message, view }, { status: error.status, headers: noStoreHeaders() });
    }
    console.error("assistant chat failed", error);
    return NextResponse.json({ error: "O assistente não conseguiu responder agora. Tente de novo." }, { status: 500, headers: noStoreHeaders() });
  }
}
