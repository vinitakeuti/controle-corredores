import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";
import { toWhatsappNumber } from "@/lib/whatsapp/phone";
import { getWhatsAppSummary, saveWhatsAppSettings, type WhatsAppInput } from "@/lib/whatsapp/settings";

export const dynamic = "force-dynamic";

async function admin() {
  const user = await getCurrentUser();
  return user?.role === UserRole.ADMIN ? user : null;
}

export async function GET() {
  if (!await admin()) return NextResponse.json({ error: "Sem permissão" }, { status: 403, headers: noStoreHeaders() });
  return NextResponse.json({ settings: await getWhatsAppSummary() }, { headers: noStoreHeaders() });
}

export async function PUT(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  const user = await admin();
  if (!user) return NextResponse.json({ error: "Sem permissão" }, { status: 403, headers: noStoreHeaders() });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const input: WhatsAppInput = {};
  const fail = (error: string) => NextResponse.json({ error }, { status: 400, headers: noStoreHeaders() });

  if (typeof body.baseUrl === "string") {
    const value = body.baseUrl.trim().replace(/\/+$/, "");
    try { const url = new URL(value); if (!/^https?:$/.test(url.protocol)) throw new Error(); } catch { return fail("Informe a URL da Evolution, por exemplo https://evolution.seudominio.com."); }
    input.baseUrl = value;
  }
  if (body.apiKey === null) input.apiKey = null;
  else if (typeof body.apiKey === "string" && body.apiKey.trim()) {
    if (body.apiKey.trim().length < 8 || /\s/.test(body.apiKey.trim())) return fail("API key da Evolution em formato inválido.");
    input.apiKey = body.apiKey.trim();
  }
  if (typeof body.instance === "string") {
    const value = body.instance.trim();
    if (!value || value.length > 80) return fail("Informe o nome da instância.");
    input.instance = value;
  }
  if (typeof body.botNumber === "string") {
    const value = body.botNumber.trim() ? toWhatsappNumber(body.botNumber) : null;
    if (body.botNumber.trim() && !value) return fail("Número da Pace Lab inválido. Use DDD e número, por exemplo (82) 99999-9999.");
    input.botNumber = value;
  }
  if (typeof body.groupTrigger === "string") {
    const value = body.groupTrigger.trim().replace(/^@/, "").slice(0, 30);
    if (!/^[\p{L}\d]{3,30}$/u.test(value)) return fail("A palavra de chamada precisa ter de 3 a 30 letras ou números, sem espaços.");
    input.groupTrigger = value.toLowerCase();
  }
  if (typeof body.leadPrices === "boolean") input.leadPrices = body.leadPrices;
  if (typeof body.teamNotifyTarget === "string") {
    const value = body.teamNotifyTarget.trim();
    if (value && !value.endsWith("@g.us") && !toWhatsappNumber(value)) return fail("Para avisar a equipe, informe um número com DDD ou o ID de um grupo (termina em @g.us).");
    input.teamNotifyTarget = value ? (value.endsWith("@g.us") ? value : toWhatsappNumber(value)) : null;
  }
  if (typeof body.enabled === "boolean") input.enabled = body.enabled;

  const current = await getWhatsAppSummary();
  const ready = (input.baseUrl ?? current.baseUrl) && (input.apiKey !== undefined ? input.apiKey : current.hasApiKey) && (input.instance ?? current.instance);
  if (input.enabled && !ready) return fail("Para ativar, salve a URL, a API key e o nome da instância.");
  await saveWhatsAppSettings(input, user.id);
  return NextResponse.json({ settings: await getWhatsAppSummary() }, { headers: noStoreHeaders() });
}
