import { FinancialEntryType, PaymentStatus, UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { FinancialEntryManager, FinancialMobileActions } from "@/components/financial-entry-manager";
import { FinanceMonthPicker } from "@/components/finance-month-picker";
import { requireRole } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { recognizedRevenueCents } from "@/lib/revenue-recognition";

type SearchParams = { month?: string };
type StoreSalesSummary = { count: number; totalCents: number };

function monthRange(value?: string) {
  const match = value?.match(/^(\d{4})-(\d{2})$/); const now = new Date();
  const year = match ? Number(match[1]) : now.getFullYear(); const month = match ? Number(match[2]) - 1 : now.getMonth();
  const from = new Date(Date.UTC(year, month, 1, 3)); const to = new Date(Date.UTC(year, month + 1, 1, 3) - 1);
  const key = `${year}-${String(month + 1).padStart(2, "0")}`;
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "America/Maceio" }).format(from);
  return { from, to, key, label };
}

function salesLabel(count: number) {
  return `${count} ${count === 1 ? "venda" : "vendas"}`;
}

function LedgerRows({ entries, empty, kind }: { entries: Array<{ id: string; title: string; category: string | null; amountCents: number; occurredAt: Date; createdBy: { name: string } }>; empty: string; kind: "income" | "cost" }) {
  return entries.length ? <div className="finance-list">{entries.map((entry) => <div key={entry.id}><span className={`finance-entry-mark ${kind}`}>{kind === "income" ? "+" : "−"}</span><div><strong>{entry.title}</strong><small>{entry.category ? `${entry.category} · ` : ""}{formatDate(entry.occurredAt)} · {entry.createdBy.name}</small></div><b className={kind === "cost" ? "negative" : ""}>{kind === "cost" ? "−" : ""}{formatCurrency(entry.amountCents)}</b></div>)}</div> : <p className="finance-ledger-empty">{empty}</p>;
}

async function getStoreSalesSummary(month: string): Promise<StoreSalesSummary> {
  const urlValue = process.env.STORE_FINANCE_SUMMARY_URL;
  const sharedSecret = process.env.STORE_AUTH_SHARED_SECRET;
  if (!urlValue || !sharedSecret) return { count: 0, totalCents: 0 };

  try {
    const url = new URL(urlValue);
    url.searchParams.set("month", month);
    const response = await fetch(url, { cache: "no-store", headers: { "x-store-auth-secret": sharedSecret }, signal: AbortSignal.timeout(5_000) });
    const payload: unknown = response.ok ? await response.json() : null;
    if (!payload || typeof payload !== "object") return { count: 0, totalCents: 0 };
    const { count, totalCents } = payload as { count?: unknown; totalCents?: unknown };
    if (typeof count !== "number" || typeof totalCents !== "number" || !Number.isInteger(count) || !Number.isInteger(totalCents) || count < 0 || totalCents < 0) return { count: 0, totalCents: 0 };
    return { count, totalCents };
  } catch {
    return { count: 0, totalCents: 0 };
  }
}

export default async function FinancePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireRole(UserRole.ADMIN);
  const range = monthRange((await searchParams).month);
  const [payments, financialEntries, storeSales] = await Promise.all([
    prisma.payment.findMany({ where: { status: PaymentStatus.PAID }, select: { id: true, amountCents: true, paidAt: true, subscription: { select: { billingPeriod: true, manualMonthlyBilling: true } } } }),
    prisma.financialEntry.findMany({ where: { OR: [{ occurredAt: { gte: range.from, lte: range.to } }, { isFixed: true, occurredAt: { lt: range.from } }] }, include: { createdBy: { select: { name: true } } }, orderBy: { occurredAt: "desc" } }),
    getStoreSalesSummary(range.key),
  ]);
  const entries = financialEntries.map((entry) => {
    if (!entry.isFixed || entry.occurredAt >= range.from) return entry;
    const day = Math.min(entry.occurredAt.getUTCDate(), new Date(Date.UTC(range.from.getUTCFullYear(), range.from.getUTCMonth() + 1, 0)).getUTCDate());
    return { ...entry, occurredAt: new Date(Date.UTC(range.from.getUTCFullYear(), range.from.getUTCMonth(), day, 15)) };
  });
  const monthPayments = payments.filter((payment) => payment.paidAt && payment.paidAt >= range.from && payment.paidAt <= range.to);
  const planCash = monthPayments.reduce((sum, payment) => sum + payment.amountCents, 0);
  const plannedRevenue = recognizedRevenueCents(payments, range.from, range.to);
  const otherRevenue = entries.filter((entry) => entry.type === FinancialEntryType.REVENUE).reduce((sum, entry) => sum + entry.amountCents, 0);
  const revenueEntries = entries.filter((entry) => entry.type === FinancialEntryType.REVENUE);
  const monthCosts = entries.filter((entry) => entry.type === FinancialEntryType.EXPENSE && !entry.isFixed);
  const fixedCosts = entries.filter((entry) => entry.type === FinancialEntryType.EXPENSE && entry.isFixed);
  const monthCostsCents = monthCosts.reduce((sum, entry) => sum + entry.amountCents, 0);
  const fixedCostsCents = fixedCosts.reduce((sum, entry) => sum + entry.amountCents, 0);
  const costs = monthCostsCents + fixedCostsCents;
  const cashRevenue = planCash + storeSales.totalCents + otherRevenue;
  const realProfit = plannedRevenue + storeSales.totalCents + otherRevenue - costs;

  return <AppShell user={user} current="finance">
    <header className="page-heading finance-heading"><h1>Financeiro</h1><FinanceMonthPicker value={range.key} /></header>
    <section className="finance-metrics"><article><p>Entradas do mês</p><strong>{formatCurrency(cashRevenue)}</strong><small>Planos, loja e lançamentos manuais</small></article><article className="expense"><p>Saídas do mês</p><strong>{formatCurrency(costs)}</strong><small>{formatCurrency(monthCostsCents)} variáveis · {formatCurrency(fixedCostsCents)} fixas</small></article><article className="profit"><p>Resultado do mês</p><strong>{formatCurrency(realProfit)}</strong><small>Entradas menos todas as saídas</small></article></section>
    <section className="finance-layout"><div>
      <section className="finance-statement"><section className="panel finance-ledger finance-income-ledger"><div className="panel-heading"><div><p className="eyebrow">Ganhos</p><h2>Entradas</h2><p>Tudo que compõe o faturamento de {range.label}.</p></div><b className="finance-section-total">{formatCurrency(cashRevenue)}</b></div><div className="finance-list"><div><span className="finance-entry-mark income">+</span><div><strong>Planos</strong><small>{salesLabel(monthPayments.length)} · Pagamentos confirmados</small></div><b>{formatCurrency(planCash)}</b></div><div><span className="finance-entry-mark income">+</span><div><strong>Loja</strong><small>{salesLabel(storeSales.count)} · Pedidos pagos</small></div><b>{formatCurrency(storeSales.totalCents)}</b></div></div><div className="finance-subsection"><p>Outras entradas</p><LedgerRows entries={revenueEntries} kind="income" empty="Nenhuma outra entrada neste mês." /></div></section><section className="panel finance-ledger finance-expense-ledger"><div className="panel-heading"><div><p className="eyebrow">Saídas</p><h2>Despesas</h2><p>Separadas entre o que variou no mês e o que é recorrente.</p></div><b className="finance-section-total negative">−{formatCurrency(costs)}</b></div><div className="finance-expense-columns"><div className="finance-subsection"><p>Saídas do mês <b>−{formatCurrency(monthCostsCents)}</b></p><LedgerRows entries={monthCosts} kind="cost" empty="Nenhuma saída variável neste mês." /></div><div className="finance-subsection fixed"><p>Custos fixos <b>−{formatCurrency(fixedCostsCents)}</b></p><LedgerRows entries={fixedCosts} kind="cost" empty="Nenhum custo fixo neste mês." /></div></div></section></section>
    </div><aside className="finance-entry-panel"><p className="eyebrow">Novo lançamento</p><h2>Complete o financeiro</h2><p>Registre vendas fora dos planos e todos os custos do mês.</p><FinancialEntryManager month={range.key} /></aside></section>
    <FinancialMobileActions month={range.key} />
  </AppShell>;
}
