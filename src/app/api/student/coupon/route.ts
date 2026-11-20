import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { activeDiscountPercent, findActiveInfluencerByCoupon, ReferralError, setReferral } from "@/lib/influencers";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

// O aluno informa o cupom de um Expert/Creator antes do primeiro pagamento.
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  const user = await getCurrentUser();
  if (!user || user.role !== UserRole.STUDENT) return NextResponse.json({ error: "Entre como aluno para usar um cupom." }, { status: 401, headers: noStoreHeaders() });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const influencer = await findActiveInfluencerByCoupon(typeof body.code === "string" ? body.code : "");
  if (!influencer) return NextResponse.json({ error: "Cupom não encontrado." }, { status: 404, headers: noStoreHeaders() });
  try {
    await setReferral({ studentId: user.id, influencerId: influencer.id, by: "student" });
    return NextResponse.json({ code: influencer.couponCode, discountPercent: activeDiscountPercent(influencer) }, { headers: noStoreHeaders() });
  } catch (error) {
    if (error instanceof ReferralError) return NextResponse.json({ error: error.message }, { status: error.status, headers: noStoreHeaders() });
    console.error("student coupon failed", error);
    return NextResponse.json({ error: "Não foi possível aplicar o cupom." }, { status: 500, headers: noStoreHeaders() });
  }
}
