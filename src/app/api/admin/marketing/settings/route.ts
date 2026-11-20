import { NextResponse } from "next/server";
import { canAccessFeature } from "@/lib/access-control";
import { getCurrentUser } from "@/lib/auth";
import { parseCommissionPercent } from "@/lib/influencers";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

// Configurações do programa: mostrar a comissão no portal e as regras padrão
// (comissão no plano, na loja e o percentual), que valem para quem não tem regra própria.
export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  const staff = await getCurrentUser();
  if (!staff || !canAccessFeature(staff, "marketing")) return NextResponse.json({ error: "Sem permissão." }, { status: 403, headers: noStoreHeaders() });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const data: { showCommission?: boolean; planCommissionEnabled?: boolean; storeCommissionEnabled?: boolean; defaultCommissionBps?: number } = {};
  for (const key of ["showCommission", "planCommissionEnabled", "storeCommissionEnabled"] as const) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== "boolean") return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers: noStoreHeaders() });
    data[key] = body[key] as boolean;
  }
  if (body.defaultCommissionPercent !== undefined) {
    const parsed = parseCommissionPercent(body.defaultCommissionPercent);
    if (!parsed.ok || parsed.bps === null) return NextResponse.json({ error: parsed.ok ? "Informe o percentual padrão." : parsed.error }, { status: 400, headers: noStoreHeaders() });
    data.defaultCommissionBps = parsed.bps;
  }
  if (!Object.keys(data).length) return NextResponse.json({ error: "Nada para salvar." }, { status: 400, headers: noStoreHeaders() });
  const settings = await prisma.marketingSettings.upsert({ where: { id: "platform" }, update: { ...data, updatedById: staff.id }, create: { id: "platform", ...data, updatedById: staff.id } });
  return NextResponse.json({ showCommission: settings.showCommission, planCommissionEnabled: settings.planCommissionEnabled, storeCommissionEnabled: settings.storeCommissionEnabled, defaultCommissionBps: settings.defaultCommissionBps }, { headers: noStoreHeaders() });
}
