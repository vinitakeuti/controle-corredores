import Link from "next/link";
import { PaymentStatus, Prisma, UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { SaleOwnerSelect } from "@/components/sale-owner-select";
import { requireFeature } from "@/lib/auth";
import { formatCurrency, formatDate, toDateEnd, toDateStart } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type SearchParams = { period?: string; from?: string; to?: string; status?: string };
type Period = "today" | "yesterday" | "week" | "month" | "last-month" | "custom";
const periods: Array<{ id: Period; label: string }> = [
  { id: "today", label: "Hoje" }, { id: "yesterday", label: "Ontem" }, { id: "week", label: "Últimos 7 dias" }, { id: "month", label: "Este mês" }, { id: "last-month", label: "Mês passado" }, { id: "custom", label: "Personalizado" },
];
const inputDate = (date: Date) => date.toISOString().slice(0, 10);

function periodRange(period: Period, fromParam?: string, toParam?: string) {
  const now = new Date(); const endToday = new Date(now); endToday.setHours(23, 59, 59, 999);
  const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
  if (period === "yesterday") { const start = new Date(startToday); start.setDate(start.getDate() - 1); const end = new Date(endToday); end.setDate(end.getDate() - 1); return { from: start, to: end, fromValue: inputDate(start), toValue: inputDate(end) }; }
  if (period === "week") { const start = new Date(startToday); start.setDate(start.getDate() - 6); return { from: start, to: endToday, fromValue: inputDate(start), toValue: inputDate(endToday) }; }
  if (period === "month") { const start = new Date(now.getFullYear(), now.getMonth(), 1); return { from: start, to: endToday, fromValue: inputDate(start), toValue: inputDate(endToday) }; }
  if (period === "last-month") { const start = new Date(now.getFullYear(), now.getMonth() - 1, 1); const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999); return { from: start, to: end, fromValue: inputDate(start), toValue: inputDate(end) }; }
  if (period === "custom") { const from = toDateStart(fromParam) ?? startToday; const to = toDateEnd(toParam) ?? endToday; return { from, to, fromValue: inputDate(from), toValue: inputDate(to) }; }
  return { from: startToday, to: endToday, fromValue: inputDate(startToday), toValue: inputDate(endToday) };
}

export default async function SalesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireFeature("sales"); const params = await searchParams;
  const period = periods.some((item) => item.id === params.period) ? params.period as Period : "month";
  const range = periodRange(period, params.from, params.to);
  const status = params.status === "approved" || params.status === "pending" ? params.status : "";
  const where: Prisma.UserWhereInput = {
    role: UserRole.STUDENT,
    createdAt: { gte: range.from, lte: range.to },
    ...(status === "approved" ? { payments: { some: { status: PaymentStatus.PAID } } } : status === "pending" ? { payments: { none: { status: PaymentStatus.PAID } } } : {}),
  };
  const [students, sellers] = await Promise.all([
    prisma.user.findMany({ where, include: { payments: { where: { status: PaymentStatus.PAID }, orderBy: { paidAt: "asc" }, take: 1 }, subscription: { select: { planName: true } } }, orderBy: { createdAt: "desc" }, take: 250 }),
    prisma.user.findMany({ where: { active: true, role: { in: [UserRole.ADMIN, UserRole.OPERATOR] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const approved = students.filter((student) => student.payments.length > 0);
  const canViewRevenue = user.role === UserRole.ADMIN;
  const revenue = approved.reduce((sum, student) => sum + (student.payments[0]?.amountCents ?? 0), 0);

  return <AppShell user={user} current="sales"><header className="page-heading sales-heading"><div><p className="eyebrow">Comercial</p><h1>Vendas.</h1><p>Cadastros e conversões do período selecionado.</p></div><Link className="directory-action sales-analysis-link" href="/admin/vendas/analise"><span>↗</span> Analisar vendas</Link></header><form className="sales-filter" method="get"><div className="field"><label htmlFor="sales-period">Período</label><select id="sales-period" name="period" defaultValue={period}>{periods.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div><div className="field"><label htmlFor="sales-status">Status</label><select id="sales-status" name="status" defaultValue={status}><option value="">Todos os status</option><option value="pending">Pendente</option><option value="approved">Aprovado</option></select></div><div className="field sales-custom-date"><label htmlFor="sales-from">De</label><input id="sales-from" name="from" type="date" defaultValue={range.fromValue} /></div><div className="field sales-custom-date"><label htmlFor="sales-to">Até</label><input id="sales-to" name="to" type="date" defaultValue={range.toValue} /></div><button className="button button-dark" type="submit">Atualizar visão</button></form><section className="metric-grid sales-metrics"><article className="metric-card"><p>Cadastros</p><strong>{students.length}</strong><small>no período</small></article><article className="metric-card"><p>Vendas aprovadas</p><strong>{approved.length}</strong><small>{students.length ? Math.round((approved.length / students.length) * 100) : 0}% de conversão</small></article><article className="metric-card"><p>Vendas pendentes</p><strong>{students.length - approved.length}</strong><small>aguardando pagamento</small></article>{canViewRevenue ? <article className="metric-card"><p>Faturamento recebido</p><strong>{formatCurrency(revenue)}</strong><small>valor total do primeiro pagamento</small></article> : null}</section><section className="panel"><div className="panel-heading"><div><h2>Cadastros</h2><p>{formatDate(range.from)} — {formatDate(range.to)}</p></div></div>{students.length ? <div className="table-scroll"><table className="sales-table"><thead><tr><th>Aluno</th><th>Cadastro</th><th>Plano</th><th>Status</th><th>Vendedor</th></tr></thead><tbody>{students.map((student) => { const payment = student.payments[0]; return <tr key={student.id}><td><strong>{student.name}</strong><small>{student.email}</small></td><td>{formatDate(student.createdAt)}</td><td>{student.subscription?.planName ?? "Sem plano"}</td><td><span className={`pill ${payment ? "" : "pill-coral"}`}>{payment ? "Aprovado" : "Pendente"}</span>{payment && canViewRevenue ? <small>{formatCurrency(payment.amountCents)}</small> : null}</td><td><SaleOwnerSelect studentId={student.id} value={student.saleOwnerId} sellers={sellers} /></td></tr>; })}</tbody></table></div> : <div className="empty-state">Nenhum cadastro encontrado neste filtro.</div>}</section></AppShell>;
}
