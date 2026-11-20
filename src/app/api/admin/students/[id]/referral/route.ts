import { NextResponse } from "next/server";
import { canAccessFeature } from "@/lib/access-control";
import { getCurrentUser } from "@/lib/auth";
import { ReferralError, setReferral } from "@/lib/influencers";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

// Indicação do aluno (qual Expert/Creator trouxe). A equipe pode definir, trocar ou remover.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  const staff = await getCurrentUser();
  if (!staff || !(canAccessFeature(staff, "marketing") || canAccessFeature(staff, "students"))) return NextResponse.json({ error: "Sem permissão." }, { status: 403, headers: noStoreHeaders() });
  const { id } = await context.params;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const influencerId = typeof body.influencerId === "string" && body.influencerId ? body.influencerId : null;
  try {
    await setReferral({ studentId: id, influencerId, by: "staff" });
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
  } catch (error) {
    if (error instanceof ReferralError) return NextResponse.json({ error: error.message }, { status: error.status, headers: noStoreHeaders() });
    console.error("referral update failed", error);
    return NextResponse.json({ error: "Não foi possível salvar a indicação." }, { status: 500, headers: noStoreHeaders() });
  }
}
