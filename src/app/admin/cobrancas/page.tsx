import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { BillingSettingsForm } from "@/components/billing-settings-form";
import { requireRole } from "@/lib/auth";
import { getBillingSettings } from "@/lib/billing";

export default async function BillingSettingsPage() {
  const user = await requireRole(UserRole.ADMIN);
  const settings = await getBillingSettings();
  return <AppShell user={user} current="billing"><header className="page-heading"><div><p className="eyebrow">Configuração financeira</p><h1>Cobranças.</h1><p>Defina o valor-base e as opções para os novos alunos.</p></div></header><BillingSettingsForm initialBasePriceCents={settings.basePriceCents} initialAllowedMethods={settings.defaultAllowedMethods} /></AppShell>;
}
