import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { BillingSettingsForm } from "@/components/billing-settings-form";
import { requireRole } from "@/lib/auth";
import { getBillingSettings } from "@/lib/billing";
import { prisma } from "@/lib/prisma";

export default async function BillingSettingsPage() {
  const user = await requireRole(UserRole.ADMIN);
  const settings = await getBillingSettings();
  const subscriptions = await prisma.subscription.findMany({
    where: { user: { active: true }, status: { not: "CANCELED" } },
    select: { userId: true, priceCents: true, user: { select: { name: true, email: true } } },
    orderBy: { priceCents: "asc" },
  });
  const students = subscriptions
    .map((subscription) => ({ id: subscription.userId, name: subscription.user.name, email: subscription.user.email, priceCents: subscription.priceCents }))
    .sort((left, right) => left.priceCents - right.priceCents || left.name.localeCompare(right.name, "pt-BR"));
  return <AppShell user={user} current="billing"><header className="page-heading"><div><p className="eyebrow">Configuração financeira</p><h1>Cobranças.</h1><p>Defina o valor-base, organize exceções e planeje reajustes.</p></div></header><BillingSettingsForm initialBasePriceCents={settings.basePriceCents} initialAllowedMethods={settings.defaultAllowedMethods} students={students} /></AppShell>;
}
