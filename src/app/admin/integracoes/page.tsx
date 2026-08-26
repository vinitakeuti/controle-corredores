import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { IntegrationCenter } from "@/components/integration-center";
import { getAsaasIntegrationSummary } from "@/lib/asaas-integration";
import { requireRole } from "@/lib/auth";
import { getAppmaxIntegrationSummary } from "@/lib/appmax-integration";
import { getIntegrationDirectory } from "@/lib/integration-directory";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const user = await requireRole(UserRole.ADMIN);
  const [directory, appmax, asaas] = await Promise.all([
    getIntegrationDirectory(),
    getAppmaxIntegrationSummary(),
    getAsaasIntegrationSummary(),
  ]);

  return (
    <AppShell user={user} current="integrations">
      <IntegrationCenter initialDirectory={directory} initialAppmaxSummary={appmax} initialAsaasSummary={asaas} />
    </AppShell>
  );
}
