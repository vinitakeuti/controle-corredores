import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { PlansManager } from "@/components/plans-manager";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function PlansPage() {
  const user = await requireRole(UserRole.ADMIN);
  const services = await prisma.service.findMany({ include: { plans: { orderBy: { priceCents: "asc" } } }, orderBy: { name: "asc" } });
  return <AppShell user={user} current="plans"><header className="page-heading"><div><p className="eyebrow">Catálogo de assinaturas</p><h1>Planos.</h1><p>Monte os serviços da Pace Lab e defina como cada um será contratado.</p></div></header><PlansManager initialServices={services} /></AppShell>;
}
