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
  const costs = entries.filter((entry) => entry.type === FinancialEntryType.EXPENSE).reduce((sum, entry) => sum + entry.amountCents, 0);
  const cashRevenue = planCash + storeSales.totalCents + otherRevenue;
  const realProfit = plannedRevenue + storeSales.totalCents + otherRevenue - costs;

  return <AppShell user={user} current="finance">
    <header className="page-heading finance-heading"><h1>Financeiro</h1><FinanceMonthPicker value={range.key} /></header>
    <section className="finance-metrics"><article><p>Faturamento Total</p><strong>{formatCurrency(cashRevenue)}</strong></article><article><p>Parcelas correspondentes ao mês</p><strong>{formatCurrency(plannedRevenue)}</strong></article><article className="expense"><p>Custos</p><strong>{formatCurrency(costs)}</strong></article><article className="profit"><p>Lucro real</p><strong>{formatCurrency(realProfit)}</strong></article></section>
    <section className="finance-layout"><div>
      <section className="panel finance-ledger finance-sources"><div className="panel-heading"><div><p className="eyebrow">Fontes</p><h2>Entradas de {range.label}</h2><p>Vendas confirmadas organizadas pela origem.</p></div><span className="pill">{salesLabel(monthPayments.length + storeSales.count)}</span></div><div className="finance-list"><div><span className="finance-entry-mark income">+</span><div><strong>Planos</strong><small>{salesLabel(monthPayments.length)} · Pagamentos confirmados</small></div><b>{formatCurrency(planCash)}</b></div><div><span className="finance-entry-mark income">+</span><div><strong>Loja</strong><small>{salesLabel(storeSales.count)} · Pedidos pagos na loja</small></div><b>{formatCurrency(storeSales.totalCents)}</b></div></div></section>
      <section className="panel finance-ledger"><div className="panel-heading"><div><p className="eyebrow">Lançamentos avulsos</p><h2>Outras vendas e custos</h2><p>Itens registrados manualmente para compor o resultado.</p></div></div>{entries.length ? <div className="finance-list">{entries.map((entry) => <div key={entry.id}><span className={`finance-entry-mark ${entry.type === FinancialEntryType.REVENUE ? "income" : "cost"}`}>{entry.type === "REVENUE" ? "+" : "−"}</span><div><strong>{entry.title}</strong><small>{entry.category ? `${entry.category} · ` : ""}{entry.type === "REVENUE" ? "Outra venda" : "Custo"} · {formatDate(entry.occurredAt)} · {entry.createdBy.name}{entry.isFixed ? " · Fixo" : ""}</small></div><b className={entry.type === "EXPENSE" ? "negative" : ""}>{entry.type === "EXPENSE" ? "−" : ""}{formatCurrency(entry.amountCents)}</b></div>)}</div> : <div className="empty-state">Nenhuma outra venda ou custo registrado neste mês.</div>}</section>
    </div><aside className="finance-entry-panel"><p className="eyebrow">Novo lançamento</p><h2>Complete o financeiro</h2><p>Registre vendas fora dos planos e todos os custos do mês.</p><FinancialEntryManager month={range.key} /></aside></section>
    <FinancialMobileActions month={range.key} />
  </AppShell>;
}
