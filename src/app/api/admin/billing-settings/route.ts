import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getBillingSettings, parseAllowedMethods } from "@/lib/billing";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

export async function PATCH(request: Request) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
    const admin = await getCurrentUser();
    if (!admin || admin.role !== UserRole.ADMIN) return NextResponse.json({ error: "Apenas administradores podem alterar a cobrança" }, { status: 403, headers: noStoreHeaders() });
    const body = await request.json() as Record<string, unknown>;
    const current = await getBillingSettings();
    const defaultAllowedMethods = parseAllowedMethods(body.defaultAllowedMethods);
    if (!defaultAllowedMethods) return NextResponse.json({ error: "Selecione ao menos um método de pagamento padrão" }, { status: 400, headers: noStoreHeaders() });
    await prisma.billingSettings.upsert({ where: { id: "platform" }, update: { defaultAllowedMethods }, create: { id: "platform", basePriceCents: current.basePriceCents, defaultAllowedMethods } });
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("billing settings update failed", error);
    return NextResponse.json({ error: "Não foi possível atualizar a configuração de cobrança" }, { status: 502, headers: noStoreHeaders() });
  }
}
