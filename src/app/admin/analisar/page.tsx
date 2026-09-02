import { Prisma, SubscriptionStatus, UserRole } from "@prisma/client";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireStaff } from "@/lib/auth";
import { formatDate, subscriptionLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type AnalyzeSearchParams = { status?: string; page?: string; q?: string };
type ListStatus = "on-time" | "overdue" | "awaiting-payment";
const PAGE_SIZE = 12;

function getListStatus(value?: string): ListStatus {
  if (value === "overdue" || value === "awaiting-payment") return value;
  return "on-time";
}

function buildHref(status: ListStatus, page: number, query: string) {
  const search = new URLSearchParams({ status });
  if (page > 1) search.set("page", String(page));
  if (query) search.set("q", query);
  return `/admin/analisar?${search.toString()}`;
}

export default async function AnalyzePage({ searchParams }: { searchParams: Promise<AnalyzeSearchParams> }) {
  const user = await requireStaff();
  const params = await searchParams;
  const now = new Date();
  const status = getListStatus(params.status);
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  const requestedPage = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const searchFilter: Prisma.UserWhereInput = query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { email: { contains: query, mode: "insensitive" } }] } : {};
  const onTimeWhere: Prisma.UserWhereInput = { role: UserRole.STUDENT, active: true, ...searchFilter, subscription: { is: { status: SubscriptionStatus.ACTIVE, OR: [{ nextBillingAt: null }, { nextBillingAt: { gte: now } }] } } };
  const overdueWhere: Prisma.UserWhereInput = { role: UserRole.STUDENT, active: true, ...searchFilter, subscription: { is: { OR: [{ status: SubscriptionStatus.PAST_DUE }, { nextBillingAt: { lt: now } }] } } };
  const awaitingPaymentWhere: Prisma.UserWhereInput = { role: UserRole.STUDENT, active: true, ...searchFilter, subscription: { is: { status: SubscriptionStatus.INCOMPLETE } }, payments: { none: { status: "PAID" } } };

  const [onTimeTotal, overdueTotal, awaitingPaymentTotal] = await Promise.all([prisma.user.count({ where: onTimeWhere }), prisma.user.count({ where: overdueWhere }), prisma.user.count({ where: awaitingPaymentWhere })]);
  const selectedTotal = status === "overdue" ? overdueTotal : status === "awaiting-payment" ? awaitingPaymentTotal : onTimeTotal;
  const totalPages = Math.max(1, Math.ceil(selectedTotal / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const students = await prisma.user.findMany({
    where: status === "overdue" ? overdueWhere : status === "awaiting-payment" ? awaitingPaymentWhere : onTimeWhere,
    include: { subscription: true },
    orderBy: { name: "asc" },
    skip: (currentPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  return (
    <AppShell user={user} current="analysis">
      <header className="page-heading">
        <div><p className="eyebrow">Análise de dados</p><h1>Saúde das assinaturas.</h1><p>Pesquise e acompanhe os alunos por status sem uma lista interminável.</p></div>
        <div className="date-now">{selectedTotal} resultados</div>
      </header>

      <section className="panel analysis-panel">
        <div className="analysis-tabs" role="tablist" aria-label="Status das assinaturas">
          <Link className={`analysis-tab ${status === "on-time" ? "active" : ""}`} href={buildHref("on-time", 1, query)} role="tab" aria-selected={status === "on-time"}>Em dia <span>{onTimeTotal}</span></Link>
          <Link className={`analysis-tab ${status === "overdue" ? "active" : ""}`} href={buildHref("overdue", 1, query)} role="tab" aria-selected={status === "overdue"}>Em atraso <span>{overdueTotal}</span></Link>
          <Link className={`analysis-tab ${status === "awaiting-payment" ? "active" : ""}`} href={buildHref("awaiting-payment", 1, query)} role="tab" aria-selected={status === "awaiting-payment"}>Aguardando pagamento <span>{awaitingPaymentTotal}</span></Link>
        </div>

        <div className="analysis-toolbar">
          <div><h2>{status === "overdue" ? "Alunos em atraso" : status === "awaiting-payment" ? "Cadastros sem pagamento" : "Alunos em dia"}</h2><p>{status === "awaiting-payment" ? "Cadastros que ainda não tiveram um pagamento confirmado." : `Página ${currentPage} de ${totalPages}, com ${PAGE_SIZE} registros por vez.`}</p></div>
          <form className="student-search" method="get">
            <input type="hidden" name="status" value={status} />
            <label className="sr-only" htmlFor="student-search">Buscar aluno</label>
            <input id="student-search" name="q" type="search" placeholder="Buscar nome ou e-mail" defaultValue={query} />
            <button className="button button-secondary" type="submit">Buscar</button>
          </form>
        </div>

        <div className="students-table-shell">
          <table className="students-table">
            <thead><tr><th>Aluno</th><th>Próxima cobrança</th><th>Status</th></tr></thead>
            <tbody>
              {students.length === 0 ? <tr><td className="table-empty" colSpan={3}>Nenhum aluno encontrado.</td></tr> : students.map((student) => <tr key={student.id}><td><div className="student-primary">{student.name}</div><div className="student-secondary">{student.email}</div></td><td>{status === "awaiting-payment" ? `Cadastrado em ${formatDate(student.joinedAt)}` : <>{status === "overdue" ? "Venceu em " : "Próxima em "}{formatDate(student.subscription?.nextBillingAt)}</>}</td><td><span className={`pill ${status === "overdue" || status === "awaiting-payment" ? "pill-coral" : ""}`}>{status === "awaiting-payment" ? "Aguardando pagamento" : subscriptionLabel(student.subscription?.status ?? "")}</span></td></tr>)}
            </tbody>
          </table>
        </div>

        <nav className="pagination" aria-label="Paginação da lista de alunos">
          {currentPage > 1 ? <Link className="pagination-link" href={buildHref(status, currentPage - 1, query)}>Anterior</Link> : <span className="pagination-link disabled">Anterior</span>}
          <span className="pagination-status">{currentPage} / {totalPages}</span>
          {currentPage < totalPages ? <Link className="pagination-link" href={buildHref(status, currentPage + 1, query)}>Próxima</Link> : <span className="pagination-link disabled">Próxima</span>}
        </nav>
      </section>
    </AppShell>
  );
}
