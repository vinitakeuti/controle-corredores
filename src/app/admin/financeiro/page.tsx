import { FinancialEntryType, PaymentStatus, PlanPeriod, SubscriptionStatus, UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { FinancialEntryManager, FinancialEntryRow, FinancialMobileActions } from "@/components/financial-entry-manager";
import { FinanceMonthPicker } from "@/components/finance-month-picker";
import { requireFeature } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { contractedMonthlyRevenueCents } from "@/lib/revenue-recognition";
import { getStoreSalesSummary } from "@/lib/store-finance";

type SearchParams = { month?: string };
type FinancialLedgerEntry = {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
  amountCents: number;
  occurredAt: Date;
  isFixed: boolean;
  createdBy: { name: string };
};
type ActiveContract = {
  id: string;
  planName: string;
  priceCents: number;
  billingPeriod: PlanPeriod;
  manualMonthlyBilling: boolean;
};

const periodLabels: Record<PlanPeriod, string> = {
  MONTHLY: "mensal",
  QUARTERLY: "trimestral",
  SEMIANNUAL: "semestral",
  ANNUAL: "anual",
};

function monthRange(value?: string) {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  const now = new Date();
  const year = match ? Number(match[1]) : now.getFullYear();
  const month = match ? Number(match[2]) - 1 : now.getMonth();
  const from = new Date(Date.UTC(year, month, 1, 3));
  const to = new Date(Date.UTC(year, month + 1, 1, 3) - 1);
  const key = `${year}-${String(month + 1).padStart(2, "0")}`;
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "America/Maceio" }).format(from);
  return { from, to, key, label };
}

function salesLabel(count: number) {
  return `${count} ${count === 1 ? "venda" : "vendas"}`;
}

function LedgerRows({ entries, empty, kind, canDelete }: { entries: FinancialLedgerEntry[]; empty: string; kind: "income" | "cost"; canDelete: boolean }) {
  return entries.length ? <div className="finance-list finance-manual-list">{entries.map((entry) => <FinancialEntryRow
    key={entry.id}
    editable={canDelete}
    kind={kind}
    entry={{
      id: entry.id,
      title: entry.title,
      category: entry.category,
      description: entry.description,
      amountCents: entry.amountCents,
      occurredAt: entry.occurredAt.toISOString(),
      isFixed: entry.isFixed,
      createdByName: entry.createdBy.name,
    }}
  />)}</div> : <p className="finance-ledger-empty">{empty}</p>;
}

function PlanRevenueSummary({ contracts, totalCents, planCash, paymentCount, monthLabel }: { contracts: ActiveContract[]; totalCents: number; planCash: number; paymentCount: number; monthLabel: string }) {
  const groups = Array.from(contracts.reduce((items, contract) => {
    const key = `${contract.planName}:${contract.priceCents}:${contract.billingPeriod}:${contract.manualMonthlyBilling}`;
    const current = items.get(key) ?? { ...contract, count: 0, totalCents: 0 };
    current.count += 1;
    current.totalCents += contract.priceCents;
    items.set(key, current);
    return items;
  }, new Map<string, ActiveContract & { count: number; totalCents: number }>()).values()).sort((left, right) => right.totalCents - left.totalCents || left.planName.localeCompare(right.planName, "pt-BR"));

  return <details className="finance-plan-revenue">
    <summary>
      <span className="finance-entry-mark income">+</span>
      <span className="finance-plan-revenue-copy"><strong>Planos</strong><small>{contracts.length} contrato{contracts.length === 1 ? "" : "s"} ativo{contracts.length === 1 ? "" : "s"} · receita do mês inteiro</small></span>
      <span className="finance-plan-revenue-total"><b>{formatCurrency(totalCents)}</b><small>previsto em {monthLabel}</small></span>
    </summary>
    <div className="finance-plan-revenue-body">
      <div className="finance-plan-cash-summary"><span><strong>Recebido até agora</strong><small>{salesLabel(paymentCount)} · pagamentos confirmados</small></span><b>{formatCurrency(planCash)}</b></div>
      <p>Composição da receita mensal contratada. Cada contrato ativo entra uma vez no mês, sem esperar o dia do vencimento.</p>
      {groups.length ? <div className="finance-contract-list">{groups.map((group) => <div key={`${group.planName}-${group.priceCents}-${group.billingPeriod}-${group.manualMonthlyBilling}`}>
        <span>{group.planName}</span>
        <small>{group.count} contrato{group.count === 1 ? "" : "s"} · {group.manualMonthlyBilling ? "cobrança mensal manual" : `plano ${periodLabels[group.billingPeriod]}`} · {formatCurrency(group.priceCents)}/mês cada</small>
        <b>{formatCurrency(group.totalCents)}</b>
      </div>)}</div> : <p className="finance-ledger-empty">Nenhum contrato ativo compõe esta receita.</p>}
    </div>
  </details>;
}

export default async function FinancePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireFeature("finance");
  const range = monthRange((await searchParams).month);
  const [payments, financialEntries, storeSales, activeContracts] = await Promise.all([
    prisma.payment.findMany({ where: { status: PaymentStatus.PAID }, select: { id: true, amountCents: true, paidAt: true } }),
    prisma.financialEntry.findMany({ where: { OR: [{ occurredAt: { gte: range.from, lte: range.to } }, { isFixed: true, occurredAt: { lt: range.from } }] }, include: { createdBy: { select: { name: true } } }, orderBy: { occurredAt: "desc" } }),
    getStoreSalesSummary(range.key),
    prisma.subscription.findMany({ where: { status: SubscriptionStatus.ACTIVE, isCourtesy: false, createdAt: { lte: range.to }, user: { is: { active: true } } }, select: { id: true, planName: true, priceCents: true, billingPeriod: true, manualMonthlyBilling: true } }),
  ]);

  const entries = financialEntries.map((entry) => {
    if (!entry.isFixed || entry.occurredAt >= range.from) return entry;
    const day = Math.min(entry.occurredAt.getUTCDate(), new Date(Date.UTC(range.from.getUTCFullYear(), range.from.getUTCMonth() + 1, 0)).getUTCDate());
    return { ...entry, occurredAt: new Date(Date.UTC(range.from.getUTCFullYear(), range.from.getUTCMonth(), day, 15)) };
  });
  const monthPayments = payments.filter((payment) => payment.paidAt && payment.paidAt >= range.from && payment.paidAt <= range.to);
  const planCash = monthPayments.reduce((sum, payment) => sum + payment.amountCents, 0);
  const contractedPlanRevenue = contractedMonthlyRevenueCents(activeContracts);
  const otherRevenue = entries.filter((entry) => entry.type === FinancialEntryType.REVENUE).reduce((sum, entry) => sum + entry.amountCents, 0);
  const revenueEntries = entries.filter((entry) => entry.type === FinancialEntryType.REVENUE);
  const monthCosts = entries.filter((entry) => entry.type === FinancialEntryType.EXPENSE && !entry.isFixed);
  const fixedCosts = entries.filter((entry) => entry.type === FinancialEntryType.EXPENSE && entry.isFixed);
  const monthCostsCents = monthCosts.reduce((sum, entry) => sum + entry.amountCents, 0);
  const fixedCostsCents = fixedCosts.reduce((sum, entry) => sum + entry.amountCents, 0);
  const costs = monthCostsCents + fixedCostsCents;
  const cashRevenue = planCash + storeSales.totalCents + otherRevenue;
  const projectedResult = contractedPlanRevenue + storeSales.totalCents + otherRevenue - costs;
  const canManageEntries = user.role === UserRole.ADMIN;

  return <AppShell user={user} current="finance">
    <header className="page-heading finance-heading"><h1>Financeiro</h1><FinanceMonthPicker value={range.key} /></header>
    <section className="finance-metrics">
      <article><p>Entradas recebidas</p><strong>{formatCurrency(cashRevenue)}</strong><small>Planos, loja e lançamentos confirmados</small></article>
      <article className="expense"><p>Saídas do mês</p><strong>{formatCurrency(costs)}</strong><small>{formatCurrency(monthCostsCents)} variáveis · {formatCurrency(fixedCostsCents)} fixas</small></article>
      <article className="profit"><p>Resultado projetado</p><strong>{formatCurrency(projectedResult)}</strong><small>Receita dos contratos, loja e lançamentos menos saídas</small></article>
    </section>
    <section className="finance-layout"><div>
      <section className="finance-statement">
        <section className="panel finance-ledger finance-income-ledger">
          <div className="panel-heading"><div><p className="eyebrow">Ganhos</p><h2>Entradas recebidas</h2><p>Valores que entraram no caixa em {range.label}.</p></div><b className="finance-section-total">{formatCurrency(cashRevenue)}</b></div>
          <div className="finance-list">
            <PlanRevenueSummary contracts={activeContracts} totalCents={contractedPlanRevenue} planCash={planCash} paymentCount={monthPayments.length} monthLabel={range.label} />
            <div><span className="finance-entry-mark income">+</span><div><strong>Loja</strong><small>{salesLabel(storeSales.count)} · Pedidos pagos</small></div><b>{formatCurrency(storeSales.totalCents)}</b></div>
          </div>
          <details className="finance-subsection finance-expandable"><summary>Outras entradas <b>{revenueEntries.length}</b></summary><LedgerRows entries={revenueEntries} kind="income" canDelete={canManageEntries} empty="Nenhuma outra entrada neste mês." /></details>
        </section>
        <section className="panel finance-ledger finance-expense-ledger">
          <div className="panel-heading"><div><p className="eyebrow">Saídas</p><h2>Despesas</h2><p>Separadas entre o que variou no mês e o que é recorrente.</p></div><b className="finance-section-total negative">−{formatCurrency(costs)}</b></div>
          <div className="finance-expense-columns">
            <div className="finance-subsection"><p>Saídas do mês <b>−{formatCurrency(monthCostsCents)}</b></p><LedgerRows entries={monthCosts} kind="cost" canDelete={canManageEntries} empty="Nenhuma saída variável neste mês." /></div>
            <div className="finance-subsection fixed"><p>Custos fixos <b>−{formatCurrency(fixedCostsCents)}</b></p><LedgerRows entries={fixedCosts} kind="cost" canDelete={canManageEntries} empty="Nenhum custo fixo neste mês." /></div>
          </div>
        </section>
      </section>
    </div><aside className="finance-entry-panel"><p className="eyebrow">Novo lançamento</p><h2>Complete o financeiro</h2><p>Registre vendas fora dos planos e todos os custos do mês.</p><FinancialEntryManager month={range.key} /></aside></section>
    <FinancialMobileActions month={range.key} />
  </AppShell>;
}
