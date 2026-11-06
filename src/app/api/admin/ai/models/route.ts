import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { listModels, OpenRouterError } from "@/lib/ai/openrouter";
import { noStoreHeaders } from "@/lib/security";

export const dynamic = "force-dynamic";

// Todos os modelos de texto do OpenRouter, Claude primeiro.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (user?.role !== UserRole.ADMIN) return NextResponse.json({ error: "Sem permissão" }, { status: 403, headers: noStoreHeaders() });
  try {
    const force = new URL(request.url).searchParams.get("refresh") === "1";
    const models = await listModels(force);
    const sorted = [...models].sort((left, right) => {
      const rank = (provider: string) => (provider === "anthropic" ? 0 : 1);
      return rank(left.provider) - rank(right.provider) || left.provider.localeCompare(right.provider) || left.name.localeCompare(right.name, "pt-BR");
    });
    return NextResponse.json({ models: sorted }, { headers: noStoreHeaders() });
  } catch (error) {
    const message = error instanceof OpenRouterError ? error.message : "Não foi possível carregar a lista de modelos do OpenRouter.";
    return NextResponse.json({ error: message }, { status: 502, headers: noStoreHeaders() });
  }
}
