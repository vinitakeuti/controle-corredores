import Link from "next/link";
import { FinancialEntryType, PlanPeriod, UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { FinancialEntryActions, FinancialEntryEditButton, type FinancialEntryRowData } from "@/components/financial-entry-manager";
import { FinanceMonthPicker } from "@/components/finance-month-picker";
import { FilterChips } from "@/components/ui/filter-chips";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { requireFeature } from "@/lib/auth";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { financeMonthRange, loadFinanceMonth } from "@/lib/finance-month";

type SearchParams = { month?: string; tipo?: string; q?: string; pagina?: string };
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

function salesLabel(count: number) {
  return `${count} ${count === 1 ? "venda" : "vendas"}`;
}

type LedgerFilter = "todos" | "entradas" | "variaveis" | "fixos";
const PAGE_SIZE = 20;
const ledgerFilters: Record<LedgerFilter, string> = { todos: "Todos", entradas: "Entradas", variaveis: "Saídas variáveis", fixos: "Custos fixos" };
const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const countLabel = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function ledgerKey(entry: { type: FinancialEntryType; isFixed: boolean }): Exclude<LedgerFilter, "todos"> {
  if (entry.type === FinancialEntryType.REVENUE) return "entradas";
  return entry.isFixed ? "fixos" : "variaveis";
}

function typeLabel(entry: { type: FinancialEntryType; isFixed: boolean }) {
  if (entry.type === FinancialEntryType.REVENUE) return entry.isFixed ? "Entrada recorrente" : "Entrada";
  return entry.isFixed ? "Custo fixo" : "Saída variável";
}

function toRowData(entry: FinancialLedgerEntry): FinancialEntryRowData {
  return { id: entry.id, title: entry.title, category: entry.category, description: entry.description, amountCents: entry.amountCents, occurredAt: entry.occurredAt.toISOString(), isFixed: entry.isFixed, createdByName: entry.createdBy.name };
}

// Composição da receita contratada: contratos ativos agrupados por plano, valor e período.
function PlanRevenueComposition({ contracts, totalCents, monthLabel }: { contracts: ActiveContract[]; totalCents: number; monthLabel: string }) {
  const groups = Array.from(contracts.reduce((items, contract) => {
    const key = `${contract.planName}:${contract.priceCents}:${contract.billingPeriod}:${contract.manualMonthlyBilling}`;
    const current = items.get(key) ?? { ...contract, count: 0, totalCents: 0 };
    current.count += 1;
    current.totalCents += contract.priceCents;
    items.set(key, current);
    return items;
  }, new Map<string, ActiveContract & { count: number; totalCents: number }>()).values()).sort((left, right) => right.totalCents - left.totalCents || left.planName.localeCompare(right.planName, "pt-BR"));

  return <details className="disclosure fin-contracts">
    <summary>
      <span>
        <span className="section-title">Receita contratada de planos</span>
        <span className="section-lead disclosure-lead">{formatCurrency(totalCents)} previsto em {monthLabel} · {countLabel(contracts.length, "contrato ativo", "contratos ativos")} · receita do mês inteiro</span>
      </span>
      <Icon name="chevronRight" />
    </summary>
    <div className="disclosure-body">
      <p className="field-hint fin-contracts-hint">Composição da receita mensal contratada. Cada contrato ativo entra uma vez no mês, sem esperar o dia do vencimento.</p>
      {groups.length ? <ul className="ledger ledger-compact">{groups.map((group) => <li className="ledger-row" key={`${group.planName}-${group.priceCents}-${group.billingPeriod}-${group.manualMonthlyBilling}`}><div className="ledger-row-content">
        <span className="ledger-copy"><strong>{group.planName}</strong><small>{countLabel(group.count, "contrato", "contratos")} · {group.manualMonthlyBilling ? "cobrança mensal manual" : `plano ${periodLabels[group.billingPeriod]}`} · {formatCurrency(group.priceCents)}/mês cada</small></span>
        <span className="ledger-amount">{formatCurrency(group.totalCents)}</span>
      </div></li>)}</ul> : <p className="ledger-empty">Nenhum contrato ativo compõe esta receita.</p>}
    </div>
  </details>;
}

export default async function FinancePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireFeature("finance");
  const params = await searchParams;
  const range = financeMonthRange(params.month);
  const filter: LedgerFilter = params.tipo === "entradas" || params.tipo === "variaveis" || params.tipo === "fixos" ? params.tipo : "todos";
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  const { entries, storeSales, activeContracts, monthPayments, planCash, contractedPlanRevenue, revenueEntries, otherRevenue, monthCosts, fixedCosts, monthCostsCents, fixedCostsCents, costs, cashRevenue, projectedResult } = await loadFinanceMonth(range);
  const canManageEntries = user.role === UserRole.ADMIN;

  // Lançamentos: um só livro do mês, com filtro por tipo, busca e páginas (estado na URL).
  const counts: Record<LedgerFilter, number> = { todos: entries.length, entradas: revenueEntries.length, variaveis: monthCosts.length, fixos: fixedCosts.length };
  const needle = normalize(query);
  const ledger = entries
    .filter((entry) => filter === "todos" || ledgerKey(entry) === filter)
    .filter((entry) => !needle || normalize([entry.title, entry.category, entry.description, entry.createdBy.name].filter(Boolean).join(" ")).includes(needle))
    .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime() || left.title.localeCompare(right.title, "pt-BR"));
  const totalPages = Math.max(1, Math.ceil(ledger.length / PAGE_SIZE));
  const page = Math.min(totalPages, Math.max(1, Number.parseInt(params.pagina ?? "1", 10) || 1));
  const pageEntries = ledger.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const ledgerHref = (next: { tipo?: LedgerFilter; q?: string; pagina?: number }) => {
    const search = new URLSearchParams();
    if (params.month) search.set("month", range.key);
    const tipo = next.tipo ?? filter;
    if (tipo !== "todos") search.set("tipo", tipo);
    const q = next.q ?? query;
    if (q) search.set("q", q);
    if (next.pagina && next.pagina > 1) search.set("pagina", String(next.pagina));
    const value = search.toString();
    return `/admin/financeiro${value ? `?${value}` : ""}#lancamentos`;
  };
  const amountText = (entry: { type: FinancialEntryType; amountCents: number }) => `${entry.type === FinancialEntryType.EXPENSE ? "−" : ""}${formatCurrency(entry.amountCents)}`;
  const kindOf = (entry: { type: FinancialEntryType }) => entry.type === FinancialEntryType.REVENUE ? "income" as const : "cost" as const;

  return <AppShell user={user} current="finance">
    <PageHeader context={{ label: "Gestão financeira" }} title="Financeiro." lead={`Entradas, saídas e resultado de ${range.label}.`} actions={<><FinanceMonthPicker value={range.key} /><FinancialEntryActions month={range.key} /></>} />
    <div className="metric-strip finance-summary" data-count={3}>
      <div className="metric" data-tone="positive"><span className="metric-label">Entradas recebidas</span><strong className="metric-value">{formatCurrency(cashRevenue)}</strong><span className="metric-note">Planos, loja e lançamentos confirmados</span></div>
      <div className="metric"><span className="metric-label">Saídas do mês</span><strong className="metric-value">{formatCurrency(costs)}</strong><span className="metric-note">{formatCurrency(monthCostsCents)} variáveis · {formatCurrency(fixedCostsCents)} fixas</span></div>
      <div className="metric" data-tone={projectedResult < 0 ? "danger" : "positive"}><span className="metric-label">Resultado projetado</span><strong className="metric-value">{formatCurrency(projectedResult)}</strong><span className="metric-note">Receita dos contratos, loja e lançamentos menos saídas</span></div>
    </div>

    <section className="section-block fin-statement" aria-labelledby="finance-statement-title">
      <div className="section-head"><div><h2 className="section-title" id="finance-statement-title">Resumo de {range.label}</h2><p className="section-lead">De onde veio o que entrou no caixa e para onde foram as saídas.</p></div></div>
      <div className="fin-statement-grid">
        <div className="fin-group">
          <div className="fin-group-head"><h3>Entradas recebidas</h3><span className="fin-group-total" data-kind="income">{formatCurrency(cashRevenue)}</span></div>
          <ul className="fin-lines">
            <li><div className="fin-line"><span className="fin-line-copy"><strong>Planos</strong><small>{salesLabel(monthPayments.length)} · pagamentos confirmados</small></span><span className="fin-line-amount">{formatCurrency(planCash)}</span></div></li>
            <li><div className="fin-line"><span className="fin-line-copy"><strong>Loja</strong><small>{salesLabel(storeSales.count)} · Pedidos pagos</small></span><span className="fin-line-amount">{formatCurrency(storeSales.totalCents)}</span></div></li>
            <li><Link className="fin-line" href={ledgerHref({ tipo: "entradas", q: "", pagina: 1 })}><span className="fin-line-copy"><strong>Outras entradas</strong><small>{countLabel(revenueEntries.length, "lançamento manual", "lançamentos manuais")}</small></span><span className="fin-line-amount">{formatCurrency(otherRevenue)}</span><Icon name="chevronRight" className="icon-sm" /></Link></li>
          </ul>
        </div>
        <div className="fin-group">
          <div className="fin-group-head"><h3>Saídas do mês</h3><span className="fin-group-total" data-kind="cost">−{formatCurrency(costs)}</span></div>
          <ul className="fin-lines">
            <li><Link className="fin-line" href={ledgerHref({ tipo: "variaveis", q: "", pagina: 1 })}><span className="fin-line-copy"><strong>Saídas variáveis</strong><small>{countLabel(monthCosts.length, "lançamento", "lançamentos")} no mês</small></span><span className="fin-line-amount" data-kind="cost">−{formatCurrency(monthCostsCents)}</span><Icon name="chevronRight" className="icon-sm" /></Link></li>
            <li><Link className="fin-line" href={ledgerHref({ tipo: "fixos", q: "", pagina: 1 })}><span className="fin-line-copy"><strong>Custos fixos</strong><small>{countLabel(fixedCosts.length, "custo recorrente", "custos recorrentes")} · repetem todo mês</small></span><span className="fin-line-amount" data-kind="cost">−{formatCurrency(fixedCostsCents)}</span><Icon name="chevronRight" className="icon-sm" /></Link></li>
          </ul>
        </div>
      </div>
      <PlanRevenueComposition contracts={activeContracts} totalCents={contractedPlanRevenue} monthLabel={range.label} />
    </section>

    <section className="section-block fin-ledger" id="lancamentos" aria-labelledby="finance-ledger-title">
      <div className="section-head"><div><h2 className="section-title" id="finance-ledger-title">Lançamentos de {range.label}</h2><p className="section-lead">Entradas e saídas registradas no financeiro. Custos fixos aparecem em todos os meses.{canManageEntries ? " Toque em um lançamento para editar ou excluir." : ""}</p></div></div>
      <FilterChips label="Filtrar lançamentos por tipo" active={filter} chips={(Object.keys(ledgerFilters) as LedgerFilter[]).map((key) => ({ key, label: ledgerFilters[key], count: counts[key], href: ledgerHref({ tipo: key, pagina: 1 }) }))} />
      {entries.length ? <form className="toolbar fin-ledger-search" method="get" action="/admin/financeiro#lancamentos" role="search" aria-label="Buscar lançamentos">
        {params.month ? <input type="hidden" name="month" value={range.key} /> : null}
        {filter !== "todos" ? <input type="hidden" name="tipo" value={filter} /> : null}
        <div className="toolbar-search">
          <div className="search-field">
            <label className="visually-hidden" htmlFor="finance-ledger-search">Buscar lançamento</label>
            <Icon name="search" />
            <input className="control" id="finance-ledger-search" name="q" type="search" placeholder="Buscar por título, categoria ou responsável" defaultValue={query} />
          </div>
          <button className="btn btn-secondary" type="submit">Buscar</button>
        </div>
      </form> : null}

      {pageEntries.length ? <>
        <div className="data-table-wrap responsive-table">
          <table className="data-table fin-ledger-table">
            <caption className="visually-hidden">Lançamentos de {range.label}{filter !== "todos" ? `, ${ledgerFilters[filter]}` : ""}, página {page} de {totalPages}</caption>
            <thead><tr><th scope="col">Data</th><th scope="col">Lançamento</th><th scope="col">Tipo</th><th scope="col">Registrado por</th><th scope="col" className="num">Valor</th></tr></thead>
            <tbody>{pageEntries.map((entry) => {
              const meta = [entry.category, entry.description].filter(Boolean).join(" · ");
              const copy = <><span className="cell-primary">{entry.title}</span>{meta ? <span className="cell-secondary">{meta}</span> : null}</>;
              return <tr key={entry.id}>
                <td className="fin-date">{formatShortDate(entry.occurredAt)}</td>
                <td className="fin-entry-cell">{canManageEntries ? <FinancialEntryEditButton className="fin-entry-link" entry={toRowData(entry)} kind={kindOf(entry)} label={`Editar lançamento ${entry.title}, ${amountText(entry)}`}>{copy}</FinancialEntryEditButton> : copy}</td>
                <td className="fin-type">{typeLabel(entry)}</td>
                <td className="fin-author">{entry.createdBy.name}</td>
                <td className="num"><span className="fin-amount" data-kind={kindOf(entry)}>{amountText(entry)}</span></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        <ul className="data-rows responsive-rows fin-ledger-rows" aria-label={`Lançamentos de ${range.label}, página ${page} de ${totalPages}`}>
          {pageEntries.map((entry) => {
            const content = <>
              <span className="row-title">{entry.title}</span>
              <span className="fin-amount" data-kind={kindOf(entry)}>{amountText(entry)}</span>
              <span className="row-meta"><span>{formatShortDate(entry.occurredAt)}</span><span>{typeLabel(entry)}</span>{entry.category ? <span>{entry.category}</span> : null}<span>{entry.createdBy.name}</span></span>
            </>;
            return <li key={entry.id}>{canManageEntries ? <FinancialEntryEditButton className="fin-row-button" entry={toRowData(entry)} kind={kindOf(entry)} label={`Editar lançamento ${entry.title}, ${amountText(entry)}`}>{content}</FinancialEntryEditButton> : <div className="fin-row-static">{content}</div>}</li>;
          })}
        </ul>
        <Pagination page={page} totalPages={totalPages} total={ledger.length} pageSize={PAGE_SIZE} itemLabel={ledger.length === 1 ? "lançamento" : "lançamentos"} hrefFor={(next) => ledgerHref({ pagina: next })} label="Paginação dos lançamentos" />
      </> : entries.length ? <div className="state-empty">
        <strong>{query ? `Nada corresponde a “${query}”.` : `Nenhum lançamento em ${ledgerFilters[filter]}.`}</strong>
        <p>{query ? "Confira a grafia ou busque por outra palavra." : "Escolha outro tipo acima."}</p>
        <Link className="btn btn-secondary" href={ledgerHref({ tipo: "todos", q: "", pagina: 1 })}>Limpar busca e filtros</Link>
      </div> : <div className="state-empty">
        <strong>Nenhum lançamento em {range.label}.</strong>
        <p>Use Nova saída ou Nova entrada para registrar o que entrou ou saiu do caixa.</p>
      </div>}
    </section>
  </AppShell>;
}
