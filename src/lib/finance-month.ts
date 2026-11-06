import { FinancialEntryType, PaymentStatus, SubscriptionStatus } from "@prisma/client";
import { maceioDateParts } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { contractedMonthlyRevenueCents } from "@/lib/revenue-recognition";
import { getStoreSalesSummary } from "@/lib/store-finance";

export type FinanceMonthRange = { from: Date; to: Date; key: string; label: string };

// Mês de Maceió (AAAA-MM). Sem valor válido, usa o mês atual.
export function financeMonthRange(value?: string): FinanceMonthRange {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  const today = maceioDateParts();
  const year = match ? Number(match[1]) : today.year;
  const month = match ? Number(match[2]) - 1 : today.month - 1;
  const from = new Date(Date.UTC(year, month, 1, 3));
  const to = new Date(Date.UTC(year, month + 1, 1, 3) - 1);
  const key = `${year}-${String(month + 1).padStart(2, "0")}`;
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "America/Maceio" }).format(from);
  return { from, to, key, label };
}

// Números do mês usados pela tela Financeiro e pelo assistente. Uma só conta para os dois.
export async function loadFinanceMonth(range: FinanceMonthRange) {
  const [payments, financialEntries, storeSales, activeContracts] = await Promise.all([
    prisma.payment.findMany({ where: { status: PaymentStatus.PAID }, select: { id: true, amountCents: true, paidAt: true } }),
    prisma.financialEntry.findMany({ where: { OR: [{ occurredAt: { gte: range.from, lte: range.to } }, { isFixed: true, occurredAt: { lt: range.from } }] }, include: { createdBy: { select: { name: true } } }, orderBy: { occurredAt: "desc" } }),
    getStoreSalesSummary(range.key),
    prisma.subscription.findMany({ where: { status: SubscriptionStatus.ACTIVE, isCourtesy: false, createdAt: { lte: range.to }, user: { is: { active: true } } }, select: { id: true, planName: true, priceCents: true, billingPeriod: true, manualMonthlyBilling: true } }),
  ]);
  // Custos fixos lançados em meses anteriores se repetem neste mês, no mesmo dia.
  const entries = financialEntries.map((entry) => {
    if (!entry.isFixed || entry.occurredAt >= range.from) return entry;
    const day = Math.min(entry.occurredAt.getUTCDate(), new Date(Date.UTC(range.from.getUTCFullYear(), range.from.getUTCMonth() + 1, 0)).getUTCDate());
    return { ...entry, occurredAt: new Date(Date.UTC(range.from.getUTCFullYear(), range.from.getUTCMonth(), day, 15)) };
  });
  const monthPayments = payments.filter((payment) => payment.paidAt && payment.paidAt >= range.from && payment.paidAt <= range.to);
  const planCash = monthPayments.reduce((sum, payment) => sum + payment.amountCents, 0);
  const contractedPlanRevenue = contractedMonthlyRevenueCents(activeContracts);
  const revenueEntries = entries.filter((entry) => entry.type === FinancialEntryType.REVENUE);
  const otherRevenue = revenueEntries.reduce((sum, entry) => sum + entry.amountCents, 0);
  const monthCosts = entries.filter((entry) => entry.type === FinancialEntryType.EXPENSE && !entry.isFixed);
  const fixedCosts = entries.filter((entry) => entry.type === FinancialEntryType.EXPENSE && entry.isFixed);
  const monthCostsCents = monthCosts.reduce((sum, entry) => sum + entry.amountCents, 0);
  const fixedCostsCents = fixedCosts.reduce((sum, entry) => sum + entry.amountCents, 0);
  const costs = monthCostsCents + fixedCostsCents;
  const cashRevenue = planCash + storeSales.totalCents + otherRevenue;
  const projectedResult = contractedPlanRevenue + storeSales.totalCents + otherRevenue - costs;
  return { entries, storeSales, activeContracts, monthPayments, planCash, contractedPlanRevenue, revenueEntries, otherRevenue, monthCosts, fixedCosts, monthCostsCents, fixedCostsCents, costs, cashRevenue, projectedResult };
}
