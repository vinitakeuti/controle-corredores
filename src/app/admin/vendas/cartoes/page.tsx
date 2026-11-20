import { AppShell } from "@/components/app-shell";
import { SalesCardsManager } from "@/components/sales-cards-manager";
import { PageHeader } from "@/components/ui/page-header";
import { requireFeature } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import { getStaffPlans, planDisplayName } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { salesCardStatus, salesCardUrl } from "@/lib/sales-cards";

export default async function SalesCardsPage() {
  const user = await requireFeature("sales");
  const [cards, plans] = await Promise.all([
    prisma.salesCard.findMany({
      orderBy: { expiresAt: "desc" },
      take: 60,
      include: { plans: { where: { active: true, service: { active: true } }, include: { service: true }, orderBy: [{ service: { name: "asc" } }, { isHidden: "asc" }, { priceCents: "asc" }] }, createdBy: { select: { name: true } }, _count: { select: { students: true } } },
    }),
    getStaffPlans(),
  ]);
  const planLabel = (plan: (typeof plans)[number]) => `${planDisplayName(plan)} · ${plan.isCourtesy ? "Cortesia" : `${formatCurrency(plan.priceCents)}/mês`}`;
  const rows = cards.map((card) => ({
    id: card.id,
    name: card.name,
    url: salesCardUrl(card.code),
    expiresAt: card.expiresAt.toISOString(),
    status: salesCardStatus(card),
    signups: card._count.students,
    createdBy: card.createdBy.name,
    plans: card.plans.map((plan) => ({ id: plan.id, label: planLabel(plan) })),
  })).sort((a, b) => Number(b.status === "active") - Number(a.status === "active"));

  return <AppShell user={user} current="sales">
    <PageHeader context={{ label: "Vendas", href: "/admin/vendas", current: "Cartões de venda" }} title="Cartões de venda." lead="QR Codes para deixar em exibição em eventos. Cada pessoa escaneia, escolhe um dos planos do cartão e se cadastra sozinha até o prazo acabar." />
    <SalesCardsManager cards={rows} plans={plans.map((plan) => ({ id: plan.id, label: planLabel(plan), isHidden: plan.isHidden, isCourtesy: plan.isCourtesy }))} />
  </AppShell>;
}
