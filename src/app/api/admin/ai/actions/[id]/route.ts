import { NextResponse } from "next/server";
import { canAccessFeature, getCurrentUser } from "@/lib/auth";
import { AssistantError, decideAction, staffContext } from "@/lib/ai/agent";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  const user = await getCurrentUser();
  if (!user || !canAccessFeature(user, "assistant")) return NextResponse.json({ error: "Sem permissão" }, { status: 403, headers: noStoreHeaders() });
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const decision = body.decision === "confirm" ? "confirm" : body.decision === "reject" ? "reject" : null;
  if (!decision) return NextResponse.json({ error: "Decisão inválida." }, { status: 400, headers: noStoreHeaders() });
  try {
    const outcome = await decideAction({ actionId: id, decision, context: staffContext(user) });
    return NextResponse.json(outcome, { headers: noStoreHeaders() });
  } catch (error) {
    if (error instanceof AssistantError) return NextResponse.json({ error: error.message }, { status: error.status, headers: noStoreHeaders() });
    console.error("assistant action decision failed", error);
    return NextResponse.json({ error: "Não foi possível concluir a ação." }, { status: 500, headers: noStoreHeaders() });
  }
}
