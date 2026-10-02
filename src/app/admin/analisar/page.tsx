import { Prisma, SubscriptionStatus, UserRole } from "@prisma/client";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireFeature } from "@/lib/auth";
import { formatCurrency, formatDate, subscriptionLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type AnalyzeSearchParams = { status?: string; page?: string; q?: string; due?: string };
type ListStatus = "on-time" | "overdue" | "awaiting-payment" | "due-date" | "special-price" | "courtesy" | "manual-pix" | "verification" | "term-missing";
const PAGE_SIZE = 12;

const paymentTabs: { id: ListStatus; label: string }[] = [
  { id: "on-time", label: "Em dia" },
  { id: "overdue", label: "Em atraso" },
  { id: "awaiting-payment", label: "Aguardando pagamento" },
  { id: "due-date", label: "Por vencimento" },
];
const conditionTabs: { id: ListStatus; label: string }[] = [
  { id: "special-price", label: "Valor exclusivo" },
  { id: "courtesy", label: "Cortesias" },
  { id: "manual-pix", label: "Pix manual" },
];
const termTabs: { id: ListStatus; label: string }[] = [
  { id: "term-missing", label: "Sem termo enviado" },
  { id: "verification", label: "Aguardando validação" },
];

function getListStatus(value?: string): ListStatus {
  if (value === "overdue" || value === "awaiting-payment" || value === "due-date" || value === "special-price" || value === "courtesy" || value === "manual-pix" || value === "verification" || value === "term-missing") return value;
  return "on-time";
}

function buildHref(status: ListStatus, page: number, query: string, due?: string) {
  const search = new URLSearchParams({ status });
  if (page > 1) search.set("page", String(page));
  if (query) search.set("q", query);
  if (status === "due-date" && due) search.set("due", due);
  return `/admin/analisar?${search.toString()}`;
}

function dueDateRange(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day, 3));
  if (start.getUTCFullYear() !== year || start.getUTCMonth() !== month - 1 || start.getUTCDate() !== day) return null;
  return { value, start, end: new Date(Date.UTC(year, month - 1, day + 1, 3)) };
}

function verificationLabel(status: string, requiredAt: Date | null) {
  if (!requiredAt) return { label: "Não exigido", tone: "muted" };
  if (status === "APPROVED") return { label: "Validado", tone: "ok" };
  if (status === "SUBMITTED") return { label: "Aguardando validação", tone: "pending" };
  if (status === "REJECTED") return { label: "Novo envio solicitado", tone: "alert" };
  return { label: "Aguardando envio", tone: "muted" };
}

export default async function AnalyzePage({ searchParams }: { searchParams: Promise<AnalyzeSearchParams> }) {
  const user = await requireFeature("analysis");
  const params = await searchParams;
  const now = new Date();
  const status = getListStatus(params.status);
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  const selectedDueDate = dueDateRange(params.due);
  const requestedPage = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const searchFilter: Prisma.UserWhereInput = query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { email: { contains: query, mode: "insensitive" } }] } : {};
  const base: Prisma.UserWhereInput = { role: UserRole.STUDENT, active: true, ...searchFilter };
  const scheduledSubscription: Prisma.SubscriptionWhereInput = { status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] }, isCourtesy: false, nextBillingAt: { not: null } };
  const filters: Record<ListStatus, Prisma.UserWhereInput> = {
    "on-time": { ...base, subscription: { is: { status: SubscriptionStatus.ACTIVE, OR: [{ nextBillingAt: null }, { nextBillingAt: { gte: now } }] } } },
    overdue: { ...base, subscription: { is: { OR: [{ status: SubscriptionStatus.PAST_DUE }, { nextBillingAt: { lt: now } }] } } },
    "awaiting-payment": { ...base, subscription: { is: { status: SubscriptionStatus.INCOMPLETE } }, payments: { none: { status: "PAID" } } },
    "due-date": { ...base, subscription: { is: scheduledSubscription } },
    "special-price": { ...base, subscription: { is: { hasCustomPrice: true } } },
    courtesy: { ...base, subscription: { is: { isCourtesy: true } } },
    "manual-pix": { ...base, subscription: { is: { manualMonthlyBilling: true } } },
    "term-missing": { ...base, liabilityTermRequiredAt: { not: null }, liabilityTermStatus: "PENDING" },
    verification: { ...base, liabilityTermRequiredAt: { not: null }, liabilityTermStatus: "SUBMITTED" },
  };
  const statusKeys = Object.keys(filters) as ListStatus[];
  const totalsList = await Promise.all(statusKeys.map((key) => prisma.user.count({ where: filters[key] })));
  const totals = statusKeys.reduce((items, key, index) => ({ ...items, [key]: totalsList[index] }), {} as Record<ListStatus, number>);
  const selectedFilter: Prisma.UserWhereInput = status === "due-date" && selectedDueDate
    ? { ...base, subscription: { is: { ...scheduledSubscription, nextBillingAt: { gte: selectedDueDate.start, lt: selectedDueDate.end } } } }
    : filters[status];
  const selectedTotal = status === "due-date" && selectedDueDate ? await prisma.user.count({ where: selectedFilter }) : totals[status];
  const totalPages = Math.max(1, Math.ceil(selectedTotal / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const students = await prisma.user.findMany({
    where: selectedFilter,
    include: { subscription: true },
    orderBy: status === "due-date" ? [{ subscription: { nextBillingAt: "asc" } }, { name: "asc" }] : { name: "asc" },
    skip: (currentPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const titles: Record<ListStatus, { title: string; description: string }> = {
    "on-time": { title: "Alunos em dia", description: "Assinaturas ativas sem cobrança vencida." },
    overdue: { title: "Alunos em atraso", description: "Assinaturas com vencimento pendente ou status em atraso." },
    "awaiting-payment": { title: "Cadastros sem pagamento", description: "Pessoas que criaram a conta, mas ainda não tiveram pagamento confirmado." },
    "due-date": { title: "Vencimentos agendados", description: "Lista em ordem cronológica pela próxima cobrança de cada plano." },
    "special-price": { title: "Valores exclusivos", description: "Alunos com uma condição de preço definida individualmente." },
    courtesy: { title: "Cortesias ativas", description: "Alunos liberados sem necessidade de cobrança." },
    "manual-pix": { title: "Cobrança manual via Pix", description: "Condições especiais cobradas mensalmente via Pix." },
    "term-missing": { title: "Termos ainda não enviados", description: "Alunos que precisam enviar o termo de responsabilidade." },
    verification: { title: "Termos aguardando validação", description: "PDFs enviados pelo aluno e pendentes de conferência da administração." },
  };
  const attentionTotal = totals.overdue + totals["awaiting-payment"] + totals["term-missing"] + totals.verification;
  const isDueDateView = status === "due-date";

  return (
    <AppShell user={user} current="analysis">
      <header className="page-heading analysis-page-heading">
        <div><p className="eyebrow">Análise de dados</p><h1>Saúde da base.</h1><p>Priorize pendências, acompanhe condições comerciais e mantenha os termos em dia.</p></div>
        <div className="date-now">{attentionTotal} item(ns) pedem atenção</div>
      </header>

      <section className="analysis-overview" aria-labelledby="analysis-overview-title">
        <div className="analysis-overview-copy">
          <p className="eyebrow">Panorama</p>
          <h2 id="analysis-overview-title">O que precisa acontecer agora?</h2>
          <p>Use os atalhos para abrir as listas prioritárias. Os números consideram apenas alunos ativos.</p>
        </div>
        <div className="analysis-health-cards">
          <Link className={`analysis-health-card is-good ${status === "on-time" ? "is-selected" : ""}`} href={buildHref("on-time", 1, query, selectedDueDate?.value)}><span>Em dia</span><strong>{totals["on-time"]}</strong><small>assinaturas regulares</small></Link>
          <Link className={`analysis-health-card is-alert ${status === "overdue" ? "is-selected" : ""}`} href={buildHref("overdue", 1, query, selectedDueDate?.value)}><span>Em atraso</span><strong>{totals.overdue}</strong><small>cobranças para acompanhar</small></Link>
          <Link className={`analysis-health-card ${status === "awaiting-payment" ? "is-selected" : ""}`} href={buildHref("awaiting-payment", 1, query, selectedDueDate?.value)}><span>Sem pagamento</span><strong>{totals["awaiting-payment"]}</strong><small>cadastros ainda não convertidos</small></Link>
          <Link className={`analysis-health-card is-term ${status === "term-missing" ? "is-selected" : ""}`} href={buildHref("term-missing", 1, query, selectedDueDate?.value)}><span>Sem termo enviado</span><strong>{totals["term-missing"]}</strong><small>envio pendente do aluno</small></Link>
          <Link className={`analysis-health-card is-term ${status === "verification" ? "is-selected" : ""}`} href={buildHref("verification", 1, query, selectedDueDate?.value)}><span>Validar termo</span><strong>{totals.verification}</strong><small>PDFs aguardando conferência</small></Link>
        </div>
      </section>

      <section className="analysis-filter-bar" aria-label="Filtros da análise">
        <div className="analysis-filter-title"><p className="eyebrow">Filtros</p><h2>Explore a base por situação</h2></div>
        <div className="analysis-filter-groups">
          <FilterGroup title="Pagamento" tabs={paymentTabs} status={status} totals={totals} query={query} due={selectedDueDate?.value} />
          <FilterGroup title="Condições comerciais" tabs={conditionTabs} status={status} totals={totals} query={query} due={selectedDueDate?.value} />
          <FilterGroup title="Termo de responsabilidade" tabs={termTabs} status={status} totals={totals} query={query} due={selectedDueDate?.value} />
        </div>
      </section>

      <section className="analysis-results">
        <div className="analysis-toolbar">
          <div><p className="eyebrow">Lista selecionada</p><h2>{titles[status].title}</h2><p>{titles[status].description}{selectedDueDate ? ` Filtrando ${formatDate(selectedDueDate.start)}.` : ""} Página {currentPage} de {totalPages}.</p></div>
          <div className="analysis-toolbar-actions">
            {isDueDateView ? <form className="analysis-due-date-filter" method="get"><input type="hidden" name="status" value="due-date" />{query ? <input type="hidden" name="q" value={query} /> : null}<label htmlFor="analysis-due-date"><span>Vencimento em</span><input id="analysis-due-date" name="due" type="date" defaultValue={selectedDueDate?.value ?? ""} /></label><button className="button button-secondary" type="submit">Filtrar data</button>{selectedDueDate ? <Link href={buildHref("due-date", 1, query)} className="analysis-due-date-clear">Ver todos</Link> : null}</form> : null}
            <form className="student-search" method="get"><input type="hidden" name="status" value={status} />{isDueDateView && selectedDueDate ? <input type="hidden" name="due" value={selectedDueDate.value} /> : null}<label className="sr-only" htmlFor="student-search">Buscar aluno</label><input id="student-search" name="q" type="search" placeholder="Buscar nome ou e-mail" defaultValue={query} /><button className="button button-secondary" type="submit">Buscar</button></form>
          </div>
        </div>

        <div className="students-table-shell"><p className="analysis-table-hint">Deslize a tabela para ver todos os detalhes.</p><table className="students-table analysis-table"><thead><tr><th>Aluno</th><th>Plano</th>{isDueDateView ? <th>Vencimento</th> : null}<th>Condição</th><th>Valor mensal</th><th>Pagamento</th><th>Termo</th></tr></thead><tbody>
          {students.length === 0 ? <tr><td className="table-empty" colSpan={isDueDateView ? 7 : 6}>Nenhum aluno encontrado.</td></tr> : students.map((student) => {
            const subscription = student.subscription;
            const verification = verificationLabel(student.liabilityTermStatus, student.liabilityTermRequiredAt);
            const paymentStatus = !subscription ? "Sem assinatura" : subscription.isCourtesy ? "Cortesia ativa" : subscription.status === SubscriptionStatus.INCOMPLETE ? "Aguardando pagamento" : subscriptionLabel(subscription.status);
            const paymentTone = subscription?.status === SubscriptionStatus.PAST_DUE || subscription?.status === SubscriptionStatus.INCOMPLETE ? "pill-coral" : "";
            return <tr key={student.id}>
              <td data-label="Aluno"><Link className="student-primary student-profile-link" href={`/admin/alunos/${student.id}`}>{student.name}</Link><div className="student-secondary">{student.email}</div></td>
              <td data-label="Plano"><div className="analysis-plan-name">{subscription?.planName ?? "Ainda não definido"}</div><div className="student-secondary">{subscription?.isCourtesy ? "Cortesia" : subscription?.manualMonthlyBilling ? "Cobrança mensal" : subscription?.nextBillingAt ? `Próxima: ${formatDate(subscription.nextBillingAt)}` : "Sem cobrança agendada"}</div></td>
              {isDueDateView ? <td data-label="Vencimento"><div className="analysis-due-date"><strong>{subscription?.nextBillingAt ? formatDate(subscription.nextBillingAt) : "—"}</strong><small>{subscription?.manualMonthlyBilling ? "Cobrança mensal manual" : "Próxima cobrança"}</small></div></td> : null}
              <td data-label="Condição"><div className="analysis-condition-pills">{subscription?.isCourtesy ? <span className="pill">Cortesia</span> : null}{subscription?.hasCustomPrice ? <span className="pill pill-coral">Valor exclusivo</span> : null}{subscription?.manualMonthlyBilling ? <span className="pill pill-manual">Pix manual</span> : null}{!subscription?.isCourtesy && !subscription?.hasCustomPrice && !subscription?.manualMonthlyBilling ? <span className="pill pill-muted">Padrão</span> : null}</div></td>
              <td data-label="Valor mensal"><strong className="analysis-price">{subscription?.isCourtesy ? "Isento" : subscription ? formatCurrency(subscription.priceCents) : "—"}</strong></td>
              <td data-label="Pagamento"><span className={`pill ${paymentTone}`}>{paymentStatus}</span></td>
              <td data-label="Termo"><span className={`pill verification-pill verification-${verification.tone}`}>{verification.label}</span></td>
            </tr>;
          })}
        </tbody></table></div>

        <nav className="pagination" aria-label="Paginação da lista de alunos">{currentPage > 1 ? <Link className="pagination-link" href={buildHref(status, currentPage - 1, query, selectedDueDate?.value)}>Anterior</Link> : <span className="pagination-link disabled">Anterior</span>}<span className="pagination-status">{currentPage} / {totalPages}</span>{currentPage < totalPages ? <Link className="pagination-link" href={buildHref(status, currentPage + 1, query, selectedDueDate?.value)}>Próxima</Link> : <span className="pagination-link disabled">Próxima</span>}</nav>
      </section>
    </AppShell>
  );
}

function FilterGroup({ title, tabs, status, totals, query, due }: { title: string; tabs: { id: ListStatus; label: string }[]; status: ListStatus; totals: Record<ListStatus, number>; query: string; due?: string }) {
  return <div className="analysis-filter-group"><p>{title}</p><div>{tabs.map((tab) => <Link className={status === tab.id ? "active" : ""} href={buildHref(tab.id, 1, query, due)} key={tab.id}><span>{tab.label}</span><b>{totals[tab.id]}</b></Link>)}</div></div>;
}
