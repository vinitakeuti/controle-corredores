import { PaymentStatus, Prisma, UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { FilterChips } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { requireFeature } from "@/lib/auth";
import { formatCurrency, formatDate, maceioDateParts, maceioDayEnd, maceioDayStart } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { monthlyEquivalentCents } from "@/lib/revenue-recognition";

type Period = "day" | "week" | "month" | "last-month";
type SearchParams = { period?: string };
const periods: Array<{ id: Period; label: string }> = [
  { id: "day", label: "Hoje" }, { id: "week", label: "Esta semana" }, { id: "month", label: "Este mês" }, { id: "last-month", label: "Mês passado" },
];

// Períodos sempre no calendário de Maceió, qualquer que seja o fuso do servidor.
function periodRange(period: Period) {
  const { year, month, day } = maceioDateParts();
  const to = maceioDayEnd(year, month, day);
  if (period === "week") return { from: maceioDayStart(year, month, day - 6), to };
  if (period === "month") return { from: maceioDayStart(year, month, 1), to };
  if (period === "last-month") return { from: maceioDayStart(year, month - 1, 1), to: maceioDayEnd(year, month, 0) };
  return { from: maceioDayStart(year, month, day), to };
}

function commissionFor(amountCents: number, rateBps: number) { return Math.round(amountCents * rateBps / 10000); }
function rateLabel(rateBps: number) { return `${(rateBps / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`; }

export default async function SalesAnalysisPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireFeature("sales"); const params = await searchParams;
  const period = periods.some((item) => item.id === params.period) ? params.period as Period : "month";
  const range = periodRange(period);
  const salesScope: Prisma.UserWhereInput = { role: UserRole.STUDENT, createdAt: { gte: range.from, lte: range.to }, ...(user.role === UserRole.OPERATOR ? { saleOwnerId: user.id } : {}) };
  const [students, staff] = await Promise.all([
    prisma.user.findMany({ where: salesScope, select: { id: true, saleOwnerId: true, payments: { where: { status: PaymentStatus.PAID }, orderBy: { paidAt: "asc" }, take: 1 }, subscription: { select: { billingPeriod: true, manualMonthlyBilling: true } } } }),
    prisma.user.findMany({ where: { active: true, role: { in: [UserRole.ADMIN, UserRole.OPERATOR] }, ...(user.role === UserRole.OPERATOR ? { id: user.id } : {}) }, select: { id: true, name: true, email: true, commissionRateBps: true }, orderBy: { name: "asc" } }),
  ]);
  const approved = students.filter((student) => student.payments.length > 0);
  const performance = staff.map((seller) => {
    const records = students.filter((student) => student.saleOwnerId === seller.id);
    const won = records.filter((student) => student.payments.length > 0);
    const invoicedRevenue = won.reduce((sum, student) => sum + (student.payments[0]?.amountCents ?? 0), 0);
    const monthlyRevenue = won.reduce((sum, student) => sum + monthlyEquivalentCents({ ...student.payments[0], subscription: student.subscription }), 0);
    return { ...seller, total: records.length, approved: won.length, pending: records.length - won.length, invoicedRevenue, monthlyRevenue, commission: commissionFor(invoicedRevenue, seller.commissionRateBps) };
  }).filter((seller) => seller.total > 0 || user.role === UserRole.OPERATOR).sort((left, right) => right.invoicedRevenue - left.invoicedRevenue || right.approved - left.approved || left.name.localeCompare(right.name, "pt-BR"));
  const totalInvoicedRevenue = performance.reduce((sum, seller) => sum + seller.invoicedRevenue, 0);
  const totalMonthlyRevenue = performance.reduce((sum, seller) => sum + seller.monthlyRevenue, 0);
  const totalCommission = performance.reduce((sum, seller) => sum + seller.commission, 0);
  const totalApproved = performance.reduce((sum, seller) => sum + seller.approved, 0);
  const isAdmin = user.role === UserRole.ADMIN;
  const canSeeSalesValues = isAdmin || user.role === UserRole.OPERATOR;

  const metricCount = 1 + (isAdmin ? 2 : 0) + (canSeeSalesValues ? 1 : 0);
  const lead = isAdmin ? "Valor das vendas, valor mensal, conversão e comissões da equipe comercial." : user.role === UserRole.OPERATOR ? "Acompanhe suas vendas aprovadas e sua comissão no período." : "Acompanhe as conversões da equipe no período.";

  return <AppShell user={user} current="sales">
    <PageHeader context={{ label: "Vendas", href: "/admin/vendas", current: "Análise" }} title="Analisar vendas." lead={lead} />
    <div className="sales-period">
      <FilterChips label="Selecionar período" active={period} chips={periods.map((item) => ({ key: item.id, label: item.label, href: `/admin/vendas/analise?period=${item.id}` }))} />
      <p className="sales-range">{formatDate(range.from)} — {formatDate(range.to)}</p>
    </div>
    <div className="metric-strip sales-summary" data-count={metricCount}>
      <div className="metric" data-tone="positive"><span className="metric-label">Vendas aprovadas</span><strong className="metric-value">{totalApproved}</strong><span className="metric-note">primeiro pagamento confirmado</span></div>
      {isAdmin ? <>
        <div className="metric"><span className="metric-label">Valor das vendas</span><strong className="metric-value">{formatCurrency(totalInvoicedRevenue)}</strong><span className="metric-note">valor total de cada venda aprovada</span></div>
        <div className="metric"><span className="metric-label">Valor mensal</span><strong className="metric-value">{formatCurrency(totalMonthlyRevenue)}</strong><span className="metric-note">equivalente mensal das vendas</span></div>
      </> : null}
      {canSeeSalesValues ? <div className="metric"><span className="metric-label">Comissões</span><strong className="metric-value">{formatCurrency(totalCommission)}</strong><span className="metric-note">calculadas sobre o valor total das vendas</span></div> : null}
    </div>
    <section className="section-block sales-ranking" aria-labelledby="sales-ranking-title">
      <div className="section-head"><div><h2 className="section-title" id="sales-ranking-title">{isAdmin ? "Desempenho por vendedor" : user.role === UserRole.OPERATOR ? "Meu resultado" : "Vendas no período"}</h2><p className="section-lead">{canSeeSalesValues ? "Comissão calculada sobre o valor total de cada venda aprovada." : "Acompanhe as vendas aprovadas e pendentes por vendedor."}</p></div></div>
      {performance.length ? <ol className="ranking">{performance.map((seller, index) => <li className="ranking-row" key={seller.id}>
        <span className="ranking-position" aria-label={user.role === UserRole.OPERATOR ? "Você" : `${index + 1}º lugar`}>{user.role === UserRole.OPERATOR ? "EU" : String(index + 1).padStart(2, "0")}</span>
        <span className="ranking-person"><strong>{seller.name}</strong><span>{seller.email}</span>{canSeeSalesValues ? <small>Comissão definida: {rateLabel(seller.commissionRateBps)}</small> : null}</span>
        <dl className="ranking-stats">
          <div><dt>Vendas</dt><dd>{seller.approved} aprovadas <span>· {seller.pending} pendentes</span></dd></div>
          {canSeeSalesValues ? <>
            <div><dt>Valor das vendas</dt><dd>{formatCurrency(seller.invoicedRevenue)}</dd></div>
            <div><dt>Valor mensal</dt><dd>{formatCurrency(seller.monthlyRevenue)}</dd></div>
            <div className="ranking-commission"><dt>Comissão</dt><dd>{formatCurrency(seller.commission)}</dd></div>
          </> : null}
        </dl>
      </li>)}</ol> : <div className="state-empty"><strong>Nenhuma venda atribuída neste período.</strong><p>Escolha outro período acima.</p></div>}
    </section>
  </AppShell>;
}
