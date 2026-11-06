import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { IntegrationCenter, type IntegrationKey } from "@/components/integration-center";
import { getAsaasIntegrationSummary } from "@/lib/asaas-integration";
import { requireFeature } from "@/lib/auth";
import { getAppmaxIntegrationSummary } from "@/lib/appmax-integration";
import { getIntegrationDirectory } from "@/lib/integration-directory";
import { getAiSettingsSummary } from "@/lib/ai/settings";

export const dynamic = "force-dynamic";

const apps: Record<string, IntegrationKey> = { appmax: "APPMAX", asaas: "ASAAS", openrouter: "OPENROUTER" };

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ app?: string }> }) {
  const user = await requireFeature("integrations");
  const params = await searchParams;
  // A IA usa dados de toda a gestão: só administradores veem e configuram o OpenRouter.
  const isAdmin = user.role === UserRole.ADMIN;
  const [directory, appmax, asaas, ai] = await Promise.all([
    getIntegrationDirectory(),
    getAppmaxIntegrationSummary(),
    getAsaasIntegrationSummary(),
    isAdmin ? getAiSettingsSummary() : Promise.resolve(null),
  ]);

  return (
    <AppShell user={user} current="integrations">
      <IntegrationCenter
        initialDirectory={directory}
        initialAppmaxSummary={appmax}
        initialAsaasSummary={asaas}
        initialAi={ai ? { enabled: ai.enabled, hasApiKey: ai.hasApiKey, apiKeyHint: ai.apiKeyHint, model: ai.model, modelName: ai.modelName, modelPricing: ai.modelPricing, modelSupportsTools: ai.modelSupportsTools, updatedAt: ai.updatedAt } : null}
        initialSelected={params.app ? apps[params.app.toLowerCase()] ?? null : null}
      />
    </AppShell>
  );
}
