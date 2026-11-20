import { notFound } from "next/navigation";
import { SalesCardDisplay } from "@/components/sales-card-display";
import { requireFeature } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import { planDisplayName } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { salesCardStatus, salesCardUrl } from "@/lib/sales-cards";

export const dynamic = "force-dynamic";

// Tela cheia do cartão de venda, sem o menu do painel: é o "PDV" do evento.
export default async function SalesCardDisplayPage({ params }: { params: Promise<{ id: string }> }) {
  await requireFeature("sales");
  const { id } = await params;
  const card = await prisma.salesCard.findUnique({
    where: { id },
    include: { plans: { where: { active: true, service: { active: true } }, include: { service: true }, orderBy: [{ service: { name: "asc" } }, { isHidden: "asc" }, { priceCents: "asc" }] }, _count: { select: { students: true } } },
  });
  if (!card) notFound();
  return <SalesCardDisplay
    id={card.id}
    name={card.name}
    url={salesCardUrl(card.code)}
    expiresAt={card.expiresAt.toISOString()}
    status={card.plans.length ? salesCardStatus(card) : "closed"}
    signups={card._count.students}
    plans={card.plans.map((plan) => ({ title: planDisplayName(plan), price: plan.isCourtesy ? "Cortesia" : `${formatCurrency(plan.priceCents)}/mês` }))}
    onlyCourtesy={card.plans.length > 0 && card.plans.every((plan) => plan.isCourtesy)}
  />;
}
