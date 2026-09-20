import Link from "next/link";
import { PaymentStatus, Prisma, UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { requireStaff } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { monthlyEquivalentCents } from "@/lib/revenue-recognition";

type Period = "day" | "week" | "month" | "last-month";
type SearchParams = { period?: string };
const periods: Array<{ id: Period; label: string }> = [
  { id: "day", label: "Hoje" }, { id: "week", label: "Esta semana" }, { id: "month", label: "Este mês" }, { id: "last-month", label: "Mês passado" },
];

function periodRange(period: Period) {
  const now = new Date(); const to = new Date(now); to.setHours(23, 59, 59, 999);
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  if (period === "week") { const from = new Date(startOfDay); from.setDate(from.getDate() - 6); return { from, to }; }
  if (period === "month") return { from: new Date(now.getFullYear(), now.getMonth(), 1), to };
  if (period === "last-month") return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999) };
  return { from: startOfDay, to };
}

function commissionFor(amountCents: number, rateBps: number) { return Math.round(amountCents * rateBps / 10000); }
function rateLabel(rateBps: number) { return `${(rateBps / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`; }

export default async function SalesAnalysisPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireStaff(); const params = await searchParams;
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

  return <AppShell user={user} current="sales"><header className="page-heading sales-analysis-heading"><div><p className="eyebrow">Comercial</p><h1>Analisar vendas.</h1><p>{user.role === UserRole.ADMIN ? "Valor das vendas, valor mensal, conversão e comissões da equipe comercial." : "Acompanhe suas vendas aprovadas e sua comissão no período."}</p></div><Link className="directory-action" href="/admin/vendas">← Voltar para vendas</Link></header><nav className="sales-period-tabs" aria-label="Selecionar período">{periods.map((item) => <Link className={item.id === period ? "active" : ""} href={`/admin/vendas/analise?period=${item.id}`} key={item.id}>{item.label}</Link>)}</nav><p className="sales-range-label">{formatDate(range.from)} — {formatDate(range.to)}</p><section className="metric-grid sales-metrics sales-analysis-metrics"><article className="metric-card"><p>Vendas aprovadas</p><strong>{totalApproved}</strong><small>primeiro pagamento confirmado</small></article><article className="metric-card"><p>Valor das vendas</p><strong>{formatCurrency(totalInvoicedRevenue)}</strong><small>valor total de cada venda aprovada</small></article><article className="metric-card"><p>Valor mensal</p><strong>{formatCurrency(totalMonthlyRevenue)}</strong><small>equivalente mensal das vendas</small></article><article className="metric-card accent"><p>Comissões</p><strong>{formatCurrency(totalCommission)}</strong><small>calculadas sobre o valor total das vendas</small></article></section><section className="panel sales-analysis-panel"><div className="panel-heading"><div><p className="eyebrow">{user.role === UserRole.ADMIN ? "Ranking comercial" : "Meu resultado"}</p><h2>{user.role === UserRole.ADMIN ? "Desempenho por vendedor" : user.name}</h2><p>Comissão calculada sobre o valor total de cada venda aprovada.</p></div></div>{performance.length ? <div className="sales-analysis-list">{performance.map((seller, index) => <article className="sales-analysis-row" key={seller.id}><div className="sales-rank">{user.role === UserRole.ADMIN ? String(index + 1).padStart(2, "0") : "EU"}</div><div className="sales-person"><strong>{seller.name}</strong><span>{seller.email}</span><small>Comissão definida: {rateLabel(seller.commissionRateBps)}</small></div><dl><div><dt>Vendas</dt><dd>{seller.approved} aprovadas <span>· {seller.pending} pendentes</span></dd></div><div><dt>Valor das vendas</dt><dd>{formatCurrency(seller.invoicedRevenue)}</dd></div><div><dt>Valor mensal</dt><dd>{formatCurrency(seller.monthlyRevenue)}</dd></div><div className="sales-commission-value"><dt>Comissão</dt><dd>{formatCurrency(seller.commission)}</dd></div></dl></article>)}</div> : <div className="empty-state">Nenhuma venda atribuída neste período.</div>}</section></AppShell>;
}
