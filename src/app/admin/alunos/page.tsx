import { Prisma, SubscriptionStatus, UserRole } from "@prisma/client";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";
import { FilterChips } from "@/components/ui/filter-chips";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { StatusPill, toneForLabel } from "@/components/ui/status-pill";
import { requireFeature } from "@/lib/auth";
import { formatDate, formatPhone, formatShortDate, subscriptionLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type StudentsSearchParams = { q?: string; page?: string; status?: string; ordem?: string };
const PAGE_SIZE = 20;
const DAY = 24 * 60 * 60 * 1000;
const numberFormat = new Intl.NumberFormat("pt-BR");

// "Em atraso" usa a mesma regra da Visão geral e do Analisar dados: status em atraso ou vencimento já passado.
function buildStatusFilters(now: Date) {
  return {
    todos: { label: "Todos", where: {} },
    "em-dia": { label: "Em dia", where: { active: true, leftAt: null, subscription: { status: SubscriptionStatus.ACTIVE, OR: [{ nextBillingAt: null }, { nextBillingAt: { gte: now } }] } } },
    "em-atraso": { label: "Em atraso", where: { active: true, subscription: { OR: [{ status: SubscriptionStatus.PAST_DUE }, { nextBillingAt: { lt: now } }] } } },
    pendentes: { label: "Pendentes", where: { active: true, leftAt: null, subscription: { status: SubscriptionStatus.INCOMPLETE } } },
    inativos: { label: "Inativos", where: { active: false } },
  } satisfies Record<string, { label: string; where: Prisma.UserWhereInput }>;
}
type StatusFilter = keyof ReturnType<typeof buildStatusFilters>;
const statusFilterKeys: StatusFilter[] = ["todos", "em-dia", "em-atraso", "pendentes", "inativos"];

const sortOptions = {
  nome: { label: "Nome (A–Z)", orderBy: [{ name: "asc" }] },
  ingresso: { label: "Ingresso mais recente", orderBy: [{ joinedAt: "desc" }, { name: "asc" }] },
  cobranca: { label: "Próxima cobrança", orderBy: [{ subscription: { nextBillingAt: { sort: "asc", nulls: "last" } } }, { name: "asc" }] },
} satisfies Record<string, { label: string; orderBy: Prisma.UserOrderByWithRelationInput[] }>;
type SortOption = keyof typeof sortOptions;

function buildHref({ page = 1, query = "", status = "todos", sort = "nome" }: { page?: number; query?: string; status?: string; sort?: string }) {
  const search = new URLSearchParams();
  if (query) search.set("q", query);
  if (status !== "todos") search.set("status", status);
  if (sort !== "nome") search.set("ordem", sort);
  if (page > 1) search.set("page", String(page));
  const queryString = search.toString();
  return `/admin/alunos${queryString ? `?${queryString}` : ""}`;
}

function getStudentStatus(active: boolean, leftAt: Date | null, subscriptionStatus?: SubscriptionStatus, overdue = false, courtesy = false) {
  if (!active) return "Inativo";
  if (leftAt) return "Desistente";
  if (subscriptionStatus === SubscriptionStatus.INCOMPLETE) return "Pendente";
  if (subscriptionStatus === SubscriptionStatus.ACTIVE && courtesy) return "Cortesia";
  if (subscriptionStatus === SubscriptionStatus.ACTIVE && overdue) return "Em atraso";
  return subscriptionStatus ? subscriptionLabel(subscriptionStatus) : "Sem assinatura";
}

// Situação da próxima cobrança, para a lista no celular.
function chargeNote(status: string, nextBillingAt: Date | null | undefined, now: number) {
  if (!nextBillingAt || status === "Inativo" || status === "Desistente" || status === "Cortesia") return null;
  const days = Math.floor((now - nextBillingAt.getTime()) / DAY);
  if (days > 0) return { overdue: true, text: `Venceu há ${days} ${days === 1 ? "dia" : "dias"}` };
  if (nextBillingAt.getTime() < now) return { overdue: true, text: "Venceu hoje" };
  return { overdue: false, text: `Próxima cobrança ${formatDate(nextBillingAt)}` };
}

export default async function StudentsPage({ searchParams }: { searchParams: Promise<StudentsSearchParams> }) {
  const user = await requireFeature("students");
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  const now = Date.now();
  const statusFilters = buildStatusFilters(new Date(now));
  const status: StatusFilter = params.status && params.status in statusFilters ? params.status as StatusFilter : "todos";
  const sort: SortOption = params.ordem && params.ordem in sortOptions ? params.ordem as SortOption : "nome";
  const requestedPage = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const searchConditions: Prisma.UserWhereInput[] = [{ name: { contains: query, mode: "insensitive" } }, { email: { contains: query, mode: "insensitive" } }];
  const normalizedCpfQuery = query.replace(/\D/g, "");
  if (normalizedCpfQuery) searchConditions.push({ cpf: { contains: normalizedCpfQuery } });
  const searchFilter: Prisma.UserWhereInput = query ? { OR: searchConditions } : {};
  const baseWhere: Prisma.UserWhereInput = { role: UserRole.STUDENT, ...searchFilter };
  const where: Prisma.UserWhereInput = { AND: [baseWhere, statusFilters[status].where] };

  const filterKeys = statusFilterKeys;
  const counts = await Promise.all(filterKeys.map((key) => prisma.user.count({ where: { AND: [baseWhere, statusFilters[key].where] } })));
  const countByFilter = Object.fromEntries(filterKeys.map((key, index) => [key, counts[index]])) as Record<StatusFilter, number>;

  const total = countByFilter[status];
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const students = await prisma.user.findMany({ where, include: { subscription: true, payments: { where: { status: "PAID" }, orderBy: { paidAt: "desc" }, take: 1 } }, orderBy: sortOptions[sort].orderBy, skip: (currentPage - 1) * PAGE_SIZE, take: PAGE_SIZE });
  const isOverdue = (student: (typeof students)[number]) => Boolean(student.subscription && !student.subscription.isCourtesy && student.subscription.nextBillingAt && student.subscription.nextBillingAt.getTime() < now);

  const sortHeader = (key: SortOption, label: string) => (
    <th scope="col" aria-sort={sort === key ? (key === "ingresso" ? "descending" : "ascending") : undefined}>
      <Link className="sort-link" href={buildHref({ query, status, sort: key })}>{label}<Icon name="sort" /></Link>
    </th>
  );

  return (
    <AppShell user={user} current="students">
      <PageHeader
        context={{ label: "Base histórica" }}
        title="Alunos."
        lead="Todos os alunos que já fizeram parte da assessoria."
        actions={<Link className="btn btn-primary" href="/admin/alunos/novo"><Icon name="plus" />Novo aluno</Link>}
      />

      <section className="section-block directory-section" aria-labelledby="students-directory-title">
        <div className="section-head">
          <div><h2 className="section-title" id="students-directory-title">Diretório de alunos</h2><p className="section-lead">{numberFormat.format(countByFilter.todos)} registros no histórico.</p></div>
        </div>

        <form className="toolbar" method="get" role="search" aria-label="Buscar e ordenar alunos">
          {status !== "todos" ? <input type="hidden" name="status" value={status} /> : null}
          <div className="toolbar-search">
            <div className="search-field">
              <label className="visually-hidden" htmlFor="directory-search">Buscar aluno</label>
              <Icon name="search" />
              <input className="control" id="directory-search" name="q" type="search" placeholder="Buscar nome, e-mail ou CPF" defaultValue={query} />
            </div>
            <button className="btn btn-secondary" type="submit">Buscar</button>
          </div>
          <div className="toolbar-sort">
            <label htmlFor="directory-sort">Ordenar por</label>
            <AutoSubmitSelect id="directory-sort" name="ordem" defaultValue={sort}>
              {(Object.keys(sortOptions) as SortOption[]).map((key) => <option key={key} value={key}>{sortOptions[key].label}</option>)}
            </AutoSubmitSelect>
          </div>
        </form>

        <FilterChips
          label="Filtrar por status"
          active={status}
          chips={filterKeys.map((key) => ({ key, label: statusFilters[key].label, href: buildHref({ query, status: key, sort }), count: countByFilter[key], tone: key === "em-atraso" ? "danger" : undefined }))}
        />

        {students.length === 0 ? <div className="state-empty">
          <strong>Nenhum aluno encontrado.</strong>
          <p>{query ? `Nada corresponde a “${query}”${status !== "todos" ? ` em ${statusFilters[status].label}` : ""}. Confira a grafia ou busque pelo CPF.` : `Não há alunos em ${statusFilters[status].label}.`}</p>
          <Link className="btn btn-secondary" href="/admin/alunos">Limpar busca e filtros</Link>
        </div> : <>
          <div className="data-table-wrap responsive-table">
            <table className="data-table directory-list-table">
              <caption className="visually-hidden">Alunos, página {currentPage} de {totalPages}</caption>
              <thead><tr>
                {sortHeader("nome", "Aluno")}
                <th scope="col">Contato</th>
                {sortHeader("ingresso", "Ingresso")}
                <th scope="col">Último pagamento</th>
                {sortHeader("cobranca", "Próxima cobrança")}
                <th scope="col">Status</th>
              </tr></thead>
              <tbody>{students.map((student) => {
                const label = getStudentStatus(student.active, student.leftAt, student.subscription?.status, isOverdue(student), Boolean(student.subscription?.isCourtesy));
                const note = chargeNote(label, student.subscription?.nextBillingAt, now);
                return <tr key={student.id}>
                  <td><Link className="row-link" href={`/admin/alunos/${student.id}`}><span className="cell-primary">{student.name}</span><span className="cell-secondary">Abrir perfil</span></Link></td>
                  <td><span className="cell-primary students-email">{student.email}</span><span className="cell-secondary">{student.phone ? formatPhone(student.phone) : "Telefone não informado"}</span></td>
                  <td>{formatShortDate(student.joinedAt)}</td>
                  <td>{formatShortDate(student.payments[0]?.paidAt)}</td>
                  <td>{student.subscription?.nextBillingAt ? <span className={note?.overdue ? "cell-danger" : undefined}>{formatShortDate(student.subscription.nextBillingAt)}</span> : "—"}</td>
                  <td><StatusPill tone={toneForLabel(label)}>{label}</StatusPill></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          <ul className="data-rows responsive-rows" aria-label={`Alunos, página ${currentPage} de ${totalPages}`}>
            {students.map((student) => {
              const label = getStudentStatus(student.active, student.leftAt, student.subscription?.status, isOverdue(student), Boolean(student.subscription?.isCourtesy));
              const note = chargeNote(label, student.subscription?.nextBillingAt, now);
              return <li key={student.id}><Link className="data-row-link" href={`/admin/alunos/${student.id}`}>
                <span className="row-title">{student.name}</span>
                <StatusPill tone={toneForLabel(label)}>{label}</StatusPill>
                <span className="row-meta">
                  {note ? <span className={note.overdue ? "cell-danger" : undefined}>{note.text}</span> : null}
                  <span>{student.phone ? formatPhone(student.phone) : "Telefone não informado"}</span>
                </span>
              </Link></li>;
            })}
          </ul>
        </>}

        <Pagination page={currentPage} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} itemLabel="alunos" label="Paginação do diretório de alunos" hrefFor={(page) => buildHref({ page, query, status, sort })} />
      </section>
    </AppShell>
  );
}
