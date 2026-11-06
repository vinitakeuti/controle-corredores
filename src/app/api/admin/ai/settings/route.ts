import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { findModel, OpenRouterError } from "@/lib/ai/openrouter";
import { getAiSettingsSummary, saveAiSettings } from "@/lib/ai/settings";
import { isSameOrigin, noStoreHeaders } from "@/lib/security";

export const dynamic = "force-dynamic";

async function admin() {
  const user = await getCurrentUser();
  return user?.role === UserRole.ADMIN ? user : null;
}

export async function GET() {
  if (!await admin()) return NextResponse.json({ error: "Sem permissão" }, { status: 403, headers: noStoreHeaders() });
  return NextResponse.json({ settings: await getAiSettingsSummary() }, { headers: noStoreHeaders() });
}

// Salva só o que veio no corpo. apiKey: string nova, null para apagar, ausente para manter.
export async function PUT(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers: noStoreHeaders() });
  const user = await admin();
  if (!user) return NextResponse.json({ error: "Sem permissão" }, { status: 403, headers: noStoreHeaders() });
  try {
    const body = await request.json() as Record<string, unknown>;
    const input: Parameters<typeof saveAiSettings>[0] = {};

    if (body.apiKey === null) input.apiKey = null;
    else if (typeof body.apiKey === "string" && body.apiKey.trim()) {
      const key = body.apiKey.trim();
      if (key.length < 20 || key.length > 300 || /\s/.test(key)) return NextResponse.json({ error: "Chave do OpenRouter em formato inválido." }, { status: 400, headers: noStoreHeaders() });
      input.apiKey = key;
    }
    if (body.model === null) input.model = null;
    else if (typeof body.model === "string" && body.model.trim()) {
      const model = await findModel(body.model.trim());
      if (!model) return NextResponse.json({ error: "Modelo não encontrado no OpenRouter." }, { status: 400, headers: noStoreHeaders() });
      input.model = model;
    }
    if (typeof body.enabled === "boolean") input.enabled = body.enabled;
    if (typeof body.generalInstructions === "string") input.generalInstructions = body.generalInstructions.trim();
    if (typeof body.businessInfo === "string") input.businessInfo = body.businessInfo.trim();
    if (body.monthlyBudgetUsd === null || body.monthlyBudgetUsd === "") input.monthlyBudgetUsd = null;
    else if (body.monthlyBudgetUsd !== undefined) {
      const budget = Number(body.monthlyBudgetUsd);
      if (!Number.isFinite(budget) || budget <= 0 || budget > 2000) return NextResponse.json({ error: "Informe um limite mensal entre US$ 0,01 e US$ 2.000." }, { status: 400, headers: noStoreHeaders() });
      input.monthlyBudgetUsd = budget;
    }

    const current = await getAiSettingsSummary();
    const willHaveKey = input.apiKey !== undefined ? Boolean(input.apiKey) : current.hasApiKey;
    const willHaveModel = input.model !== undefined ? Boolean(input.model) : Boolean(current.model);
    if (input.enabled && (!willHaveKey || !willHaveModel)) return NextResponse.json({ error: "Para ativar, salve a chave do OpenRouter e escolha um modelo." }, { status: 400, headers: noStoreHeaders() });

    await saveAiSettings(input, user.id);
    return NextResponse.json({ settings: await getAiSettingsSummary() }, { headers: noStoreHeaders() });
  } catch (error) {
    if (error instanceof OpenRouterError) return NextResponse.json({ error: error.message }, { status: 502, headers: noStoreHeaders() });
    console.error("AI settings save failed", error);
    return NextResponse.json({ error: "Não foi possível salvar as configurações do assistente." }, { status: 400, headers: noStoreHeaders() });
  }
}
