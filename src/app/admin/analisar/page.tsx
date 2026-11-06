import { Prisma, SubscriptionStatus, UserRole } from "@prisma/client";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { StatusPill, toneForLabel, type Tone } from "@/components/ui/status-pill";
import { requireFeature } from "@/lib/auth";
import { formatCurrency, formatDate, formatShortDate, subscriptionLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type AnalyzeSearchParams = { status?: string; page?: string; q?: string; due?: string };
type ListStatus = "on-time" | "overdue" | "awaiting-payment" | "due-date" | "special-price" | "courtesy" | "manual-pix" | "verification" | "term-missing";
const PAGE_SIZE = 12;
const numberFormat = new Intl.NumberFormat("pt-BR");

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

function verificationLabel(status: string, requiredAt: Date | null): { label: string; tone: Tone } {
  if (!requiredAt) return { label: "Não exigido", tone: "neutral" };
  if (status === "APPROVED") return { label: "Validado", tone: "positive" };
  if (status === "SUBMITTED") return { label: "Aguardando validação", tone: "warning" };
  if (status === "REJECTED") return { label: "Novo envio solicitado", tone: "danger" };
  return { label: "Aguardando envio", tone: "warning" };
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
  const due = selectedDueDate?.value;

  const priorities: { id: ListStatus; label: string; note: string; tone?: "danger" | "positive" }[] = [
    { id: "on-time", label: "Em dia", note: "Assinaturas regulares", tone: "positive" },
    { id: "overdue", label: "Em atraso", note: "Cobranças para acompanhar", tone: "danger" },
    { id: "awaiting-payment", label: "Sem pagamento", note: "Cadastros ainda não convertidos" },
    { id: "term-missing", label: "Sem termo enviado", note: "Envio pendente do aluno" },
    { id: "verification", label: "Validar termo", note: "PDFs aguardando conferência" },
  ];

  return (
    <AppShell user={user} current="analysis">
      <PageHeader
        context={{ label: "Análise de dados" }}
        title="Saúde da base."
        lead="Priorize pendências, acompanhe condições comerciais e mantenha os termos em dia."
        actions={<StatusPill tone={attentionTotal ? "warning" : "positive"}>{numberFormat.format(attentionTotal)} {attentionTotal === 1 ? "item pede" : "itens pedem"} atenção</StatusPill>}
      />

      <section className="section-block analysis-priorities" aria-labelledby="analysis-overview-title">
        <div className="section-head"><div><h2 className="section-title" id="analysis-overview-title">O que precisa acontecer agora?</h2><p className="section-lead">Use os atalhos para abrir as listas prioritárias. Os números consideram apenas alunos ativos.</p></div></div>
        <nav className="metric-strip analysis-strip" data-count={5} aria-label="Listas prioritárias">
          {priorities.map((item) => (
            <Link key={item.id} className="metric" data-tone={item.tone} href={buildHref(item.id, 1, query, due)} aria-current={status === item.id ? "page" : undefined}>
              <span className="metric-label">{item.label}</span>
              <strong className="metric-value">{numberFormat.format(totals[item.id])}</strong>
              <span className="metric-note">{item.note}</span>
            </Link>
          ))}
        </nav>
      </section>

      <section className="section-block analysis-filters" aria-labelledby="analysis-filters-title">
        <div className="section-head"><div><h2 className="section-title" id="analysis-filters-title">Explore a base por situação</h2></div></div>
        <div className="analysis-filter-grid">
          <FilterGroup title="Pagamento" tabs={paymentTabs} status={status} totals={totals} query={query} due={due} />
          <FilterGroup title="Condições comerciais" tabs={conditionTabs} status={status} totals={totals} query={query} due={due} />
          <FilterGroup title="Termo de responsabilidade" tabs={termTabs} status={status} totals={totals} query={query} due={due} />
        </div>
      </section>

      <section className="section-block analysis-list" aria-labelledby="analysis-results-title">
        <div className="section-head">
          <div>
            <h2 className="section-title" id="analysis-results-title">{titles[status].title}</h2>
            <p className="section-lead">{titles[status].description}{selectedDueDate ? ` Filtrando ${formatDate(selectedDueDate.start)}.` : ""}</p>
          </div>
        </div>

        <div className="toolbar">
          <form className="toolbar-search" method="get" role="search" aria-label="Buscar na lista selecionada">
            <input type="hidden" name="status" value={status} />
            {isDueDateView && selectedDueDate ? <input type="hidden" name="due" value={selectedDueDate.value} /> : null}
            <div className="search-field">
              <label className="visually-hidden" htmlFor="student-search">Buscar aluno</label>
              <Icon name="search" />
              <input className="control" id="student-search" name="q" type="search" placeholder="Buscar nome ou e-mail" defaultValue={query} />
            </div>
            <button className="btn btn-secondary" type="submit">Buscar</button>
          </form>
          {isDueDateView ? <form className="analysis-due-filter" method="get">
            <input type="hidden" name="status" value="due-date" />
            {query ? <input type="hidden" name="q" value={query} /> : null}
            <div className="form-field">
              <label htmlFor="analysis-due-date">Vencimento em</label>
              <input className="control" id="analysis-due-date" name="due" type="date" defaultValue={selectedDueDate?.value ?? ""} />
            </div>
            <button className="btn btn-secondary" type="submit"><Icon name="calendar" />Filtrar data</button>
            {selectedDueDate ? <Link className="btn btn-quiet" href={buildHref("due-date", 1, query)}>Ver todos</Link> : null}
          </form> : null}
        </div>

        {students.length === 0 ? <div className="state-empty">
          <strong>Nenhum aluno encontrado.</strong>
          <p>{query ? `Nada corresponde a “${query}” nesta lista.` : "Esta lista está vazia no momento."}</p>
          {query || selectedDueDate ? <Link className="btn btn-secondary" href={buildHref(status, 1, "")}>Limpar busca</Link> : null}
        </div> : <>
          <div className="data-table-wrap responsive-table">
            <table className="data-table analysis-list-table">
              <caption className="visually-hidden">{titles[status].title}, página {currentPage} de {totalPages}</caption>
              <thead><tr><th scope="col">Aluno</th><th scope="col">Plano</th>{isDueDateView ? <th scope="col">Vencimento</th> : null}<th scope="col">Condição</th><th scope="col" className="num">Valor mensal</th><th scope="col">Pagamento</th><th scope="col">Termo</th></tr></thead>
              <tbody>{students.map((student) => {
                const row = describe(student, now);
                return <tr key={student.id}>
                  <td><Link className="row-link" href={`/admin/alunos/${student.id}`}><span className="cell-primary">{student.name}</span><span className="cell-secondary analysis-email">{student.email}</span></Link></td>
                  <td><span className="cell-primary analysis-plan">{row.planName}</span><span className="cell-secondary">{row.planNote}</span></td>
                  {isDueDateView ? <td><span className="cell-primary">{row.nextBilling ? formatShortDate(row.nextBilling) : "—"}</span><span className="cell-secondary">{row.dueNote}</span></td> : null}
                  <td><span className="pill-group">{row.conditions.map((condition) => <StatusPill key={condition.label} tone={condition.tone}>{condition.label}</StatusPill>)}</span></td>
                  <td className="num">{row.price}</td>
                  <td><StatusPill tone={row.paymentTone}>{row.paymentStatus}</StatusPill></td>
                  <td><StatusPill tone={row.verification.tone}>{row.verification.label}</StatusPill></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          <ul className="data-rows responsive-rows" aria-label={`${titles[status].title}, página ${currentPage} de ${totalPages}`}>
            {students.map((student) => {
              const row = describe(student, now);
              return <li key={student.id}><Link className="data-row-link" href={`/admin/alunos/${student.id}`}>
                <span className="row-title">{student.name}</span>
                <StatusPill tone={row.paymentTone}>{row.paymentStatus}</StatusPill>
                <span className="row-meta">
                  <span>{row.planName}</span>
                  <span>{row.price}</span>
                  <span>{isDueDateView && row.nextBilling ? `Vence ${formatDate(row.nextBilling)}` : row.planNote}</span>
                </span>
                <span className="row-meta analysis-row-pills">
                  {row.conditions.map((condition) => <StatusPill key={condition.label} tone={condition.tone}>{condition.label}</StatusPill>)}
                  <StatusPill tone={row.verification.tone}>Termo: {row.verification.label}</StatusPill>
                </span>
              </Link></li>;
            })}
          </ul>
        </>}

        <Pagination page={currentPage} totalPages={totalPages} total={selectedTotal} pageSize={PAGE_SIZE} itemLabel="alunos" label="Paginação da lista de alunos" hrefFor={(page) => buildHref(status, page, query, due)} />
      </section>
    </AppShell>
  );
}

type StudentRow = Prisma.UserGetPayload<{ include: { subscription: true } }>;

// Mesma regra do filtro "Em atraso": status em atraso ou vencimento já passado.
// Sem isso, uma assinatura ainda marcada como ativa, mas vencida, aparecia como "Em dia".
function isOverdue(subscription: StudentRow["subscription"], now: Date) {
  return Boolean(subscription && (subscription.status === SubscriptionStatus.PAST_DUE || (subscription.nextBillingAt && subscription.nextBillingAt < now)));
}

function describe(student: StudentRow, now: Date) {
  const subscription = student.subscription;
  const overdue = !subscription?.isCourtesy && subscription?.status !== SubscriptionStatus.INCOMPLETE && isOverdue(subscription, now);
  const paymentStatus = !subscription ? "Sem assinatura" : subscription.isCourtesy ? "Cortesia ativa" : subscription.status === SubscriptionStatus.INCOMPLETE ? "Aguardando pagamento" : overdue ? subscriptionLabel(SubscriptionStatus.PAST_DUE) : subscriptionLabel(subscription.status);
  const paymentTone: Tone = overdue ? "danger" : subscription?.status === SubscriptionStatus.INCOMPLETE ? "warning" : subscription?.isCourtesy ? "info" : toneForLabel(paymentStatus);
  const conditions: { label: string; tone: Tone }[] = [];
  if (subscription?.isCourtesy) conditions.push({ label: "Cortesia", tone: "info" });
  if (subscription?.hasCustomPrice) conditions.push({ label: "Valor exclusivo", tone: "info" });
  if (subscription?.manualMonthlyBilling) conditions.push({ label: "Pix manual", tone: "info" });
  if (!conditions.length) conditions.push({ label: "Padrão", tone: "neutral" });
  return {
    planName: subscription?.planName ?? "Ainda não definido",
    planNote: subscription?.isCourtesy ? "Cortesia" : overdue && subscription?.nextBillingAt ? `Venceu em ${formatShortDate(subscription.nextBillingAt)}` : subscription?.manualMonthlyBilling ? "Cobrança mensal" : subscription?.nextBillingAt ? `Próxima: ${formatDate(subscription.nextBillingAt)}` : "Sem cobrança agendada",
    nextBilling: subscription?.nextBillingAt ?? null,
    dueNote: subscription?.manualMonthlyBilling ? "Cobrança mensal manual" : "Próxima cobrança",
    price: subscription?.isCourtesy ? "Isento" : subscription ? formatCurrency(subscription.priceCents) : "—",
    paymentStatus,
    paymentTone,
    conditions,
    verification: verificationLabel(student.liabilityTermStatus, student.liabilityTermRequiredAt),
  };
}

function FilterGroup({ title, tabs, status, totals, query, due }: { title: string; tabs: { id: ListStatus; label: string }[]; status: ListStatus; totals: Record<ListStatus, number>; query: string; due?: string }) {
  return <div className="analysis-filter-set">
    <p className="analysis-filter-label">{title}</p>
    <nav className="chips" aria-label={title}>
      {tabs.map((tab) => <Link className="chip" href={buildHref(tab.id, 1, query, due)} key={tab.id} aria-current={status === tab.id ? "true" : undefined}>{tab.label}<span className="chip-count">{numberFormat.format(totals[tab.id])}</span></Link>)}
    </nav>
  </div>;
}
