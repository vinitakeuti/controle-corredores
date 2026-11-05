import Link from "next/link";
import { PaymentStatus, Prisma, UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { SaleOwnerSelect } from "@/components/sale-owner-select";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { StatusPill } from "@/components/ui/status-pill";
import { requireFeature } from "@/lib/auth";
import { formatCurrency, formatDate, formatShortDate, toDateEnd, toDateStart } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type SearchParams = { period?: string; from?: string; to?: string; status?: string; page?: string };
const PAGE_SIZE = 25;
const numberFormat = new Intl.NumberFormat("pt-BR");
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
  const requestedPage = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const where: Prisma.UserWhereInput = {
    role: UserRole.STUDENT,
    createdAt: { gte: range.from, lte: range.to },
    ...(status === "approved" ? { payments: { some: { status: PaymentStatus.PAID } } } : status === "pending" ? { payments: { none: { status: PaymentStatus.PAID } } } : {}),
  };
  // Indicadores sobre todos os cadastros do filtro; a lista abaixo é paginada.
  const [summary, sellers] = await Promise.all([
    prisma.user.findMany({ where, select: { payments: { where: { status: PaymentStatus.PAID }, orderBy: { paidAt: "asc" }, take: 1, select: { amountCents: true } } } }),
    prisma.user.findMany({ where: { active: true, role: { in: [UserRole.ADMIN, UserRole.OPERATOR] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const total = summary.length;
  const approvedCount = summary.filter((student) => student.payments.length > 0).length;
  const canViewRevenue = user.role === UserRole.ADMIN;
  const revenue = summary.reduce((sum, student) => sum + (student.payments[0]?.amountCents ?? 0), 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const students = await prisma.user.findMany({ where, include: { payments: { where: { status: PaymentStatus.PAID }, orderBy: { paidAt: "asc" }, take: 1 }, subscription: { select: { planName: true } } }, orderBy: { createdAt: "desc" }, skip: (currentPage - 1) * PAGE_SIZE, take: PAGE_SIZE });
  const hrefFor = (page: number) => {
    const search = new URLSearchParams({ period });
    if (status) search.set("status", status);
    if (period === "custom") { search.set("from", range.fromValue); search.set("to", range.toValue); }
    if (page > 1) search.set("page", String(page));
    return `/admin/vendas?${search.toString()}`;
  };

  return <AppShell user={user} current="sales">
    <PageHeader context={{ label: "Comercial" }} title="Vendas." lead="Cadastros e conversões do período selecionado." actions={<Link className="btn btn-secondary" href="/admin/vendas/analise"><Icon name="chart" />Analisar vendas</Link>} />
    <form className="sales-filters" method="get" aria-label="Filtrar vendas">
      <div className="form-field"><label htmlFor="sales-period">Período</label><select className="control" id="sales-period" name="period" defaultValue={period}>{periods.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
      <div className="form-field"><label htmlFor="sales-status">Status</label><select className="control" id="sales-status" name="status" defaultValue={status}><option value="">Todos os status</option><option value="pending">Pendente</option><option value="approved">Aprovado</option></select></div>
      <div className="form-field"><label htmlFor="sales-from">De</label><input className="control" id="sales-from" name="from" type="date" defaultValue={range.fromValue} /></div>
      <div className="form-field"><label htmlFor="sales-to">Até</label><input className="control" id="sales-to" name="to" type="date" defaultValue={range.toValue} /></div>
      <button className="btn btn-secondary" type="submit">Atualizar visão</button>
    </form>
    <div className="metric-strip sales-summary" data-count={canViewRevenue ? 4 : 3}>
      <div className="metric"><span className="metric-label">Cadastros</span><strong className="metric-value">{numberFormat.format(total)}</strong><span className="metric-note">no período</span></div>
      <div className="metric" data-tone="positive"><span className="metric-label">Vendas aprovadas</span><strong className="metric-value">{numberFormat.format(approvedCount)}</strong><span className="metric-note">{total ? Math.round((approvedCount / total) * 100) : 0}% de conversão</span></div>
      <div className="metric"><span className="metric-label">Vendas pendentes</span><strong className="metric-value">{numberFormat.format(total - approvedCount)}</strong><span className="metric-note">aguardando pagamento</span></div>
      {canViewRevenue ? <div className="metric"><span className="metric-label">Faturamento recebido</span><strong className="metric-value">{formatCurrency(revenue)}</strong><span className="metric-note">valor total do primeiro pagamento</span></div> : null}
    </div>
    <section className="section-block sales-list" aria-labelledby="sales-list-title">
      <div className="section-head"><div><h2 className="section-title" id="sales-list-title">Cadastros</h2><p className="section-lead">{formatDate(range.from)} — {formatDate(range.to)}</p></div></div>
      {students.length ? <>
        <div className="data-table-wrap responsive-table">
          <table className="data-table sales-list-table">
            <caption className="visually-hidden">Cadastros do período, página {currentPage} de {totalPages}</caption>
            <thead><tr><th scope="col">Aluno</th><th scope="col">Cadastro</th><th scope="col">Plano</th><th scope="col">Status</th><th scope="col">Vendedor</th></tr></thead>
            <tbody>{students.map((student) => { const payment = student.payments[0]; return <tr key={student.id}>
              <td><span className="cell-primary">{student.name}</span><span className="cell-secondary sales-email">{student.email}</span></td>
              <td>{formatShortDate(student.createdAt)}</td>
              <td>{student.subscription?.planName ?? "Sem plano"}</td>
              <td><StatusPill tone={payment ? "positive" : "warning"}>{payment ? "Aprovado" : "Pendente"}</StatusPill>{payment && canViewRevenue ? <span className="cell-secondary">{formatCurrency(payment.amountCents)}</span> : null}</td>
              <td><SaleOwnerSelect studentId={student.id} value={student.saleOwnerId} sellers={sellers} label={`Vendedor de ${student.name}`} /></td>
            </tr>; })}</tbody>
          </table>
        </div>
        <ul className="data-rows responsive-rows" aria-label={`Cadastros do período, página ${currentPage} de ${totalPages}`}>
          {students.map((student) => { const payment = student.payments[0]; return <li key={student.id} className="sales-row">
            <span className="row-title">{student.name}</span>
            <StatusPill tone={payment ? "positive" : "warning"}>{payment ? "Aprovado" : "Pendente"}</StatusPill>
            <span className="row-meta"><span>{formatDate(student.createdAt)}</span><span>{student.subscription?.planName ?? "Sem plano"}</span>{payment && canViewRevenue ? <span>{formatCurrency(payment.amountCents)}</span> : null}</span>
            <span className="sales-row-owner"><SaleOwnerSelect studentId={student.id} value={student.saleOwnerId} sellers={sellers} label={`Vendedor de ${student.name}`} /></span>
          </li>; })}
        </ul>
      </> : <div className="state-empty"><strong>Nenhum cadastro encontrado neste filtro.</strong><p>Escolha outro período ou status.</p></div>}
      <Pagination page={currentPage} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} itemLabel="cadastros" label="Paginação dos cadastros" hrefFor={hrefFor} />
    </section>
  </AppShell>;
}
