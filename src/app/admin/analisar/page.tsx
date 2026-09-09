import { Prisma, SubscriptionStatus, UserRole } from "@prisma/client";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireStaff } from "@/lib/auth";
import { formatCurrency, formatDate, subscriptionLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type AnalyzeSearchParams = { status?: string; page?: string; q?: string };
type ListStatus = "on-time" | "overdue" | "awaiting-payment" | "special-price" | "courtesy" | "manual-pix" | "verification";
const PAGE_SIZE = 12;

const paymentTabs: { id: ListStatus; label: string }[] = [
  { id: "on-time", label: "Em dia" },
  { id: "overdue", label: "Em atraso" },
  { id: "awaiting-payment", label: "Aguardando pagamento" },
];
const conditionTabs: { id: ListStatus; label: string }[] = [
  { id: "special-price", label: "Valor exclusivo" },
  { id: "courtesy", label: "Cortesias" },
  { id: "manual-pix", label: "Pix manual" },
  { id: "verification", label: "Verificação" },
];

function getListStatus(value?: string): ListStatus {
  if (value === "overdue" || value === "awaiting-payment" || value === "special-price" || value === "courtesy" || value === "manual-pix" || value === "verification") return value;
  return "on-time";
}

function buildHref(status: ListStatus, page: number, query: string) {
  const search = new URLSearchParams({ status });
  if (page > 1) search.set("page", String(page));
  if (query) search.set("q", query);
  return `/admin/analisar?${search.toString()}`;
}

function verificationLabel(status: string, requiredAt: Date | null) {
  if (!requiredAt) return { label: "Não exigido", tone: "muted" };
  if (status === "APPROVED") return { label: "Validado", tone: "ok" };
  if (status === "SUBMITTED") return { label: "Aguardando validação", tone: "pending" };
  if (status === "REJECTED") return { label: "Novo envio solicitado", tone: "alert" };
  return { label: "Aguardando envio", tone: "muted" };
}

export default async function AnalyzePage({ searchParams }: { searchParams: Promise<AnalyzeSearchParams> }) {
  const user = await requireStaff();
  const params = await searchParams;
  const now = new Date();
  const status = getListStatus(params.status);
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  const requestedPage = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const searchFilter: Prisma.UserWhereInput = query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { email: { contains: query, mode: "insensitive" } }] } : {};
  const base: Prisma.UserWhereInput = { role: UserRole.STUDENT, active: true, ...searchFilter };
  const filters: Record<ListStatus, Prisma.UserWhereInput> = {
    "on-time": { ...base, subscription: { is: { status: SubscriptionStatus.ACTIVE, OR: [{ nextBillingAt: null }, { nextBillingAt: { gte: now } }] } } },
    overdue: { ...base, subscription: { is: { OR: [{ status: SubscriptionStatus.PAST_DUE }, { nextBillingAt: { lt: now } }] } } },
    "awaiting-payment": { ...base, subscription: { is: { status: SubscriptionStatus.INCOMPLETE } }, payments: { none: { status: "PAID" } } },
    "special-price": { ...base, subscription: { is: { hasCustomPrice: true } } },
    courtesy: { ...base, subscription: { is: { isCourtesy: true } } },
    "manual-pix": { ...base, subscription: { is: { manualMonthlyBilling: true } } },
    verification: { ...base, liabilityTermStatus: "SUBMITTED" },
  };
  const totalsList = await Promise.all((Object.keys(filters) as ListStatus[]).map((key) => prisma.user.count({ where: filters[key] })));
  const totals = (Object.keys(filters) as ListStatus[]).reduce((items, key, index) => ({ ...items, [key]: totalsList[index] }), {} as Record<ListStatus, number>);
  const selectedTotal = totals[status];
  const totalPages = Math.max(1, Math.ceil(selectedTotal / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const students = await prisma.user.findMany({
    where: filters[status],
    include: { subscription: true },
    orderBy: { name: "asc" },
    skip: (currentPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const titles: Record<ListStatus, { title: string; description: string }> = {
    "on-time": { title: "Alunos em dia", description: "Assinaturas ativas sem cobrança vencida." },
    overdue: { title: "Alunos em atraso", description: "Assinaturas com vencimento pendente ou status em atraso." },
    "awaiting-payment": { title: "Cadastros sem pagamento", description: "Pessoas que criaram a conta, mas ainda não tiveram pagamento confirmado." },
    "special-price": { title: "Valores exclusivos", description: "Alunos com uma condição de preço definida individualmente." },
    courtesy: { title: "Cortesias ativas", description: "Alunos liberados sem necessidade de cobrança." },
    "manual-pix": { title: "Cobrança manual via Pix", description: "Condições especiais cobradas mensalmente via Pix." },
    verification: { title: "Termos aguardando validação", description: "PDFs enviados pelo aluno e pendentes de conferência da administração." },
  };

  return <AppShell user={user} current="analysis">
    <header className="page-heading"><div><p className="eyebrow">Análise de dados</p><h1>Saúde das assinaturas.</h1><p>Organize pagamentos, condições comerciais e validações em uma só visão.</p></div><div className="date-now">{selectedTotal} resultados</div></header>

    <section className="panel analysis-panel">
      <div className="analysis-tab-groups">
        <div className="analysis-tab-group"><p>Status de pagamento</p><div className="analysis-tabs" role="tablist" aria-label="Status das assinaturas">{paymentTabs.map((tab) => <Link className={`analysis-tab ${status === tab.id ? "active" : ""}`} href={buildHref(tab.id, 1, query)} role="tab" aria-selected={status === tab.id} key={tab.id}>{tab.label} <span>{totals[tab.id]}</span></Link>)}</div></div>
        <div className="analysis-tab-group"><p>Condições e verificação</p><div className="analysis-tabs analysis-condition-tabs" role="tablist" aria-label="Condições comerciais e termo">{conditionTabs.map((tab) => <Link className={`analysis-tab ${status === tab.id ? "active" : ""}`} href={buildHref(tab.id, 1, query)} role="tab" aria-selected={status === tab.id} key={tab.id}>{tab.label} <span>{totals[tab.id]}</span></Link>)}</div></div>
      </div>

      <div className="analysis-toolbar"><div><h2>{titles[status].title}</h2><p>{titles[status].description} Página {currentPage} de {totalPages}.</p></div><form className="student-search" method="get"><input type="hidden" name="status" value={status} /><label className="sr-only" htmlFor="student-search">Buscar aluno</label><input id="student-search" name="q" type="search" placeholder="Buscar nome ou e-mail" defaultValue={query} /><button className="button button-secondary" type="submit">Buscar</button></form></div>

      <div className="students-table-shell"><table className="students-table analysis-table"><thead><tr><th>Aluno</th><th>Plano</th><th>Condição</th><th>Valor mensal</th><th>Pagamento</th><th>Verificação</th></tr></thead><tbody>
        {students.length === 0 ? <tr><td className="table-empty" colSpan={6}>Nenhum aluno encontrado.</td></tr> : students.map((student) => {
          const subscription = student.subscription;
          const verification = verificationLabel(student.liabilityTermStatus, student.liabilityTermRequiredAt);
          const paymentStatus = !subscription ? "Sem assinatura" : subscription.isCourtesy ? "Cortesia ativa" : subscription.status === SubscriptionStatus.INCOMPLETE ? "Aguardando pagamento" : subscriptionLabel(subscription.status);
          const paymentTone = subscription?.status === SubscriptionStatus.PAST_DUE || subscription?.status === SubscriptionStatus.INCOMPLETE ? "pill-coral" : "";
          return <tr key={student.id}><td><Link className="student-primary student-profile-link" href={`/admin/alunos/${student.id}`}>{student.name}</Link><div className="student-secondary">{student.email}</div></td><td><div className="analysis-plan-name">{subscription?.planName ?? "Ainda não definido"}</div><div className="student-secondary">{subscription?.isCourtesy ? "Cortesia" : subscription?.manualMonthlyBilling ? "Cobrança mensal" : subscription?.nextBillingAt ? `Próxima: ${formatDate(subscription.nextBillingAt)}` : "Sem cobrança agendada"}</div></td><td><div className="analysis-condition-pills">{subscription?.isCourtesy ? <span className="pill">Cortesia</span> : null}{subscription?.hasCustomPrice ? <span className="pill pill-coral">Valor exclusivo</span> : null}{subscription?.manualMonthlyBilling ? <span className="pill pill-manual">Pix manual</span> : null}{!subscription?.isCourtesy && !subscription?.hasCustomPrice && !subscription?.manualMonthlyBilling ? <span className="pill pill-muted">Padrão</span> : null}</div></td><td><strong className="analysis-price">{subscription?.isCourtesy ? "Isento" : subscription ? formatCurrency(subscription.priceCents) : "—"}</strong></td><td><span className={`pill ${paymentTone}`}>{paymentStatus}</span></td><td><span className={`pill verification-pill verification-${verification.tone}`}>{verification.label}</span></td></tr>;
        })}
      </tbody></table></div>

      <nav className="pagination" aria-label="Paginação da lista de alunos">{currentPage > 1 ? <Link className="pagination-link" href={buildHref(status, currentPage - 1, query)}>Anterior</Link> : <span className="pagination-link disabled">Anterior</span>}<span className="pagination-status">{currentPage} / {totalPages}</span>{currentPage < totalPages ? <Link className="pagination-link" href={buildHref(status, currentPage + 1, query)}>Próxima</Link> : <span className="pagination-link disabled">Próxima</span>}</nav>
    </section>
  </AppShell>;
}
