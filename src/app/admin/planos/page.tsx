import { AppShell } from "@/components/app-shell";
import { PlansManager } from "@/components/plans-manager";
import { PageHeader } from "@/components/ui/page-header";
import { requireFeature } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function PlansPage() {
  const user = await requireFeature("plans");
  const services = await prisma.service.findMany({ include: { plans: { orderBy: { priceCents: "asc" } } }, orderBy: { name: "asc" } });
  return <AppShell user={user} current="plans">
    <PageHeader context={{ label: "Catálogo de assinaturas" }} title="Planos." lead="Monte os serviços da Pace Lab e defina como cada um será contratado." />
    <PlansManager initialServices={services} />
  </AppShell>;
}
