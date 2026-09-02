import { Prisma, SubscriptionStatus, UserRole } from "@prisma/client";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireStaff } from "@/lib/auth";
import { formatDate, subscriptionLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type StudentsSearchParams = { q?: string; page?: string };
const PAGE_SIZE = 20;

function buildHref(page: number, query: string) {
  const search = new URLSearchParams();
  if (page > 1) search.set("page", String(page));
  if (query) search.set("q", query);
  const queryString = search.toString();
  return `/admin/alunos${queryString ? `?${queryString}` : ""}`;
}

function getStudentStatus(active: boolean, leftAt: Date | null, subscriptionStatus?: SubscriptionStatus) {
  if (!active || leftAt) return "Desistente";
  if (subscriptionStatus === SubscriptionStatus.INCOMPLETE) return "Pendente";
  return subscriptionStatus ? subscriptionLabel(subscriptionStatus) : "Sem assinatura";
}

export default async function StudentsPage({ searchParams }: { searchParams: Promise<StudentsSearchParams> }) {
  const user = await requireStaff();
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  const requestedPage = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const searchConditions: Prisma.UserWhereInput[] = [{ name: { contains: query, mode: "insensitive" } }, { email: { contains: query, mode: "insensitive" } }];
  const normalizedCpfQuery = query.replace(/\D/g, "");
  if (normalizedCpfQuery) searchConditions.push({ cpf: { contains: normalizedCpfQuery } });
  const searchFilter: Prisma.UserWhereInput = query ? { OR: searchConditions } : {};
  const where: Prisma.UserWhereInput = { role: UserRole.STUDENT, ...searchFilter };
  const total = await prisma.user.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const students = await prisma.user.findMany({ where, include: { subscription: true, payments: { where: { status: "PAID" }, orderBy: { paidAt: "desc" }, take: 1 } }, orderBy: { name: "asc" }, skip: (currentPage - 1) * PAGE_SIZE, take: PAGE_SIZE });

  return (
    <AppShell user={user} current="students">
      <header className="page-heading"><div><p className="eyebrow">Base histórica</p><h1>Alunos.</h1><p>Todos os alunos que já fizeram parte da assessoria.</p></div><Link className="directory-action" href="/admin/alunos/novo"><span aria-hidden="true">+</span> Novo aluno</Link></header>
      <section className="students-directory">
        <div className="directory-heading"><div><h2>Diretório de alunos</h2><p>{total} registros no histórico.</p></div><form className="student-search" method="get"><label className="sr-only" htmlFor="directory-search">Buscar aluno</label><input id="directory-search" name="q" type="search" placeholder="Buscar nome, e-mail ou CPF" defaultValue={query} /><button className="button button-secondary" type="submit">Buscar</button></form></div>
        <div className="students-table-shell"><table className="students-table directory-table"><thead><tr><th>Aluno</th><th>Contato</th><th>Ingresso</th><th>Último pagamento</th><th>Status</th></tr></thead><tbody>{students.length === 0 ? <tr><td className="table-empty" colSpan={5}>Nenhum aluno encontrado.</td></tr> : students.map((student) => { const status = getStudentStatus(student.active, student.leftAt, student.subscription?.status); return <tr key={student.id}><td><Link className="student-table-link" href={`/admin/alunos/${student.id}`}><div className="student-primary">{student.name}</div><div className="student-secondary">Abrir perfil</div></Link></td><td><div>{student.email}</div><div className="student-secondary">{student.phone ?? "Telefone não informado"}</div></td><td>{formatDate(student.joinedAt)}</td><td>{formatDate(student.payments[0]?.paidAt)}</td><td><span className={`pill ${status === "Em atraso" || status === "Desistente" ? "pill-coral" : ""}`}>{status}</span></td></tr>; })}</tbody></table></div>
        <nav className="pagination" aria-label="Paginação do diretório de alunos">{currentPage > 1 ? <Link className="pagination-link" href={buildHref(currentPage - 1, query)}>Anterior</Link> : <span className="pagination-link disabled">Anterior</span>}<span className="pagination-status">{currentPage} / {totalPages}</span>{currentPage < totalPages ? <Link className="pagination-link" href={buildHref(currentPage + 1, query)}>Próxima</Link> : <span className="pagination-link disabled">Próxima</span>}</nav>
      </section>
    </AppShell>
  );
}
