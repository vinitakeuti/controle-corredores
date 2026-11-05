import { FinancialEntryType, PaymentStatus, PlanPeriod, SubscriptionStatus, UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { FinancialEntryManager, FinancialEntryRow, FinancialMobileActions } from "@/components/financial-entry-manager";
import { FinanceMonthPicker } from "@/components/finance-month-picker";
import { PageHeader } from "@/components/ui/page-header";
import { Icon } from "@/components/ui/icon";
import { requireFeature } from "@/lib/auth";
import { formatCurrency, maceioDateParts } from "@/lib/format";
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
  const today = maceioDateParts();
  const year = match ? Number(match[1]) : today.year;
  const month = match ? Number(match[2]) - 1 : today.month - 1;
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
  return entries.length ? <ul className="ledger">{entries.map((entry) => <FinancialEntryRow
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
  />)}</ul> : <p className="ledger-empty">{empty}</p>;
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

  return <details className="ledger-group plan-revenue">
    <summary>
      <span className="ledger-sign" data-kind="income" aria-hidden="true">+</span>
      <span className="ledger-copy"><strong>Planos</strong><small>{contracts.length} contrato{contracts.length === 1 ? "" : "s"} ativo{contracts.length === 1 ? "" : "s"} · receita do mês inteiro</small></span>
      <span className="ledger-amount-stack"><span className="ledger-amount" data-kind="income">{formatCurrency(totalCents)}</span><small>previsto em {monthLabel}</small></span>
      <Icon name="chevronDown" className="icon-sm ledger-toggle" />
    </summary>
    <div className="plan-revenue-body">
      <dl className="kv-list"><div><dt>Recebido até agora<small className="kv-note">{salesLabel(paymentCount)} · pagamentos confirmados</small></dt><dd>{formatCurrency(planCash)}</dd></div></dl>
      <p className="field-hint">Composição da receita mensal contratada. Cada contrato ativo entra uma vez no mês, sem esperar o dia do vencimento.</p>
      {groups.length ? <ul className="ledger ledger-compact">{groups.map((group) => <li className="ledger-row" key={`${group.planName}-${group.priceCents}-${group.billingPeriod}-${group.manualMonthlyBilling}`}><div className="ledger-row-content">
        <span className="ledger-copy"><strong>{group.planName}</strong><small>{group.count} contrato{group.count === 1 ? "" : "s"} · {group.manualMonthlyBilling ? "cobrança mensal manual" : `plano ${periodLabels[group.billingPeriod]}`} · {formatCurrency(group.priceCents)}/mês cada</small></span>
        <span className="ledger-amount">{formatCurrency(group.totalCents)}</span>
      </div></li>)}</ul> : <p className="ledger-empty">Nenhum contrato ativo compõe esta receita.</p>}
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
    <PageHeader context={{ label: "Gestão financeira" }} title="Financeiro." lead={`Entradas, saídas e resultado de ${range.label}.`} actions={<FinanceMonthPicker value={range.key} />} />
    <div className="metric-strip finance-summary" data-count={3}>
      <div className="metric" data-tone="positive"><span className="metric-label">Entradas recebidas</span><strong className="metric-value">{formatCurrency(cashRevenue)}</strong><span className="metric-note">Planos, loja e lançamentos confirmados</span></div>
      <div className="metric"><span className="metric-label">Saídas do mês</span><strong className="metric-value">{formatCurrency(costs)}</strong><span className="metric-note">{formatCurrency(monthCostsCents)} variáveis · {formatCurrency(fixedCostsCents)} fixas</span></div>
      <div className="metric" data-tone={projectedResult < 0 ? "danger" : "positive"}><span className="metric-label">Resultado projetado</span><strong className="metric-value">{formatCurrency(projectedResult)}</strong><span className="metric-note">Receita dos contratos, loja e lançamentos menos saídas</span></div>
    </div>
    <div className="fin-layout">
      <div className="fin-statement">
        <section className="section-block" aria-labelledby="finance-income-title">
          <div className="section-head">
            <div><h2 className="section-title" id="finance-income-title">Entradas recebidas</h2><p className="section-lead">Valores que entraram no caixa em {range.label}.</p></div>
            <span className="ledger-total" data-kind="income">{formatCurrency(cashRevenue)}</span>
          </div>
          <PlanRevenueSummary contracts={activeContracts} totalCents={contractedPlanRevenue} planCash={planCash} paymentCount={monthPayments.length} monthLabel={range.label} />
          <ul className="ledger"><li className="ledger-row"><div className="ledger-row-content"><span className="ledger-sign" data-kind="income" aria-hidden="true">+</span><span className="ledger-copy"><strong>Loja</strong><small>{salesLabel(storeSales.count)} · Pedidos pagos</small></span><span className="ledger-amount" data-kind="income">{formatCurrency(storeSales.totalCents)}</span></div></li></ul>
          <details className="ledger-group">
            <summary><span className="ledger-copy"><strong>Outras entradas</strong><small>Lançamentos manuais do mês</small></span><span className="board-count">{revenueEntries.length}</span><Icon name="chevronDown" className="icon-sm ledger-toggle" /></summary>
            <LedgerRows entries={revenueEntries} kind="income" canDelete={canManageEntries} empty="Nenhuma outra entrada neste mês." />
          </details>
        </section>
        <section className="section-block" aria-labelledby="finance-expense-title">
          <div className="section-head">
            <div><h2 className="section-title" id="finance-expense-title">Despesas</h2><p className="section-lead">Separadas entre o que variou no mês e o que é recorrente.</p></div>
            <span className="ledger-total" data-kind="cost">−{formatCurrency(costs)}</span>
          </div>
          <div className="fin-expense-cols">
            <div><h3 className="ledger-subtitle">Saídas do mês <span>−{formatCurrency(monthCostsCents)}</span></h3><LedgerRows entries={monthCosts} kind="cost" canDelete={canManageEntries} empty="Nenhuma saída variável neste mês." /></div>
            <div><h3 className="ledger-subtitle">Custos fixos <span>−{formatCurrency(fixedCostsCents)}</span></h3><LedgerRows entries={fixedCosts} kind="cost" canDelete={canManageEntries} empty="Nenhum custo fixo neste mês." /></div>
          </div>
        </section>
      </div>
      <aside className="finance-aside section-block" aria-labelledby="finance-new-title">
        <div className="section-head"><div><h2 className="section-title" id="finance-new-title">Registrar no financeiro</h2><p className="section-lead">Inclua uma entrada ou saída avulsa para manter o resultado do mês atualizado.</p></div></div>
        <FinancialEntryManager month={range.key} />
      </aside>
    </div>
    <FinancialMobileActions month={range.key} />
  </AppShell>;
}
