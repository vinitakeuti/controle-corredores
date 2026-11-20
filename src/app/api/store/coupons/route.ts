import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { activeDiscountPercent, findActiveInfluencerByCoupon } from "@/lib/influencers";

function secretMatches(received: string | null, expected: string) {
  if (!received) return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

// A loja valida o cupom aqui antes de criar o pedido (servidor a servidor).
export async function GET(request: Request) {
  const secret = process.env.STORE_AUTH_SHARED_SECRET;
  if (!secret) return NextResponse.json({ error: "Integração indisponível." }, { status: 503 });
  if (!secretMatches(request.headers.get("x-store-auth-secret"), secret)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const influencer = await findActiveInfluencerByCoupon(params.get("code") ?? "");
  if (!influencer) return NextResponse.json({ valid: false, error: "Cupom não encontrado." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  const email = (params.get("email") ?? "").trim().toLowerCase();
  if (email && influencer.user.email.toLowerCase() === email) return NextResponse.json({ valid: false, error: "Não é possível usar o próprio cupom." }, { status: 422, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ valid: true, influencerId: influencer.id, code: influencer.couponCode, discountPercent: activeDiscountPercent(influencer) }, { headers: { "Cache-Control": "no-store" } });
}
