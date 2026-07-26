import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";
import { formatDate, toDateEnd, toDateStart, subscriptionLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type AdminSearchParams = { from?: string; to?: string };

function inputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<AdminSearchParams> }) {
  const user = await requireRole(UserRole.ADMIN);
  const params = await searchParams;
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const fromValue = params.from ?? inputDate(defaultFrom);
  const toValue = params.to ?? inputDate(now);
  const from = toDateStart(fromValue) ?? defaultFrom;
  const to = toDateEnd(toValue) ?? now;

  const [totalStudents, upToDate, overdue, newStudents, dropouts, overdueList] = await Promise.all([
    prisma.user.count({ where: { role: UserRole.STUDENT } }),
    prisma.user.count({ where: { role: UserRole.STUDENT, active: true, subscription: { is: { status: "ACTIVE", OR: [{ nextBillingAt: null }, { nextBillingAt: { gte: now } }] } } } }),
    prisma.user.count({ where: { role: UserRole.STUDENT, active: true, subscription: { is: { OR: [{ status: "PAST_DUE" }, { nextBillingAt: { lt: now } }] } } } }),
    prisma.user.count({ where: { role: UserRole.STUDENT, joinedAt: { gte: from, lte: to } } }),
    prisma.user.count({ where: { role: UserRole.STUDENT, leftAt: { not: null, gte: from, lte: to } } }),
    prisma.user.findMany({
      where: { role: UserRole.STUDENT, active: true, subscription: { is: { OR: [{ status: "PAST_DUE" }, { nextBillingAt: { lt: now } }] } } },
      include: { subscription: true },
      take: 20,
    }),
  ]);

  overdueList.sort((a, b) => (a.subscription?.nextBillingAt?.getTime() ?? 0) - (b.subscription?.nextBillingAt?.getTime() ?? 0));

  return (
    <AppShell user={user} current="admin">
      <header className="page-heading">
        <div><p className="eyebrow">Visão geral</p><h1>Bom dia, {user.name.split(" ")[0]}.</h1><p>Acompanhe a saúde das assinaturas da equipe.</p></div>
        <div className="date-now">Atualizado hoje</div>
      </header>

      <section className="metric-grid" aria-label="Indicadores principais">
        <article className="metric-card"><p>Total de alunos</p><strong>{totalStudents}</strong><small>cadastros na equipe</small></article>
        <article className="metric-card"><p>Pagantes em dia</p><strong>{upToDate}</strong><small>assinaturas ativas</small></article>
        <article className="metric-card alert"><p>Pagamentos atrasados</p><strong>{overdue}</strong><small>precisam de atenção</small></article>
        <article className="metric-card"><p>Novos no período</p><strong>{newStudents}</strong><small>filtro aplicado abaixo</small></article>
      </section>

      <div className="section-grid">
        <section className="panel">
          <div className="panel-heading"><div><h2>Alunos em atraso</h2><p>Inspecione quem precisa ser contatado.</p></div><span className="pill pill-coral">{overdue} pendentes</span></div>
          <details className="inspector" open={overdueList.length > 0}>
            <summary>Inspecionar lista de atrasos</summary>
            <div className="data-list">
              {overdueList.length === 0 ? <div className="empty-state">Nenhum aluno em atraso.</div> : overdueList.map((student) => (
                <div className="data-row" key={student.id}>
                  <div><div className="person-name">{student.name}</div><div className="person-email">{student.email}</div></div>
                  <div className="row-date">Venceu em {formatDate(student.subscription?.nextBillingAt)}</div>
                  <span className="pill pill-coral">{subscriptionLabel(student.subscription?.status ?? "")}</span>
                </div>
              ))}
            </div>
          </details>
        </section>

        <aside>
          <section className="panel">
            <div className="panel-heading"><div><h2>Movimentação</h2><p>Alunos que entraram ou saíram.</p></div></div>
            <form className="filter-form" method="get">
              <div className="field"><label htmlFor="from">De</label><input className="filter-input" id="from" name="from" type="date" defaultValue={fromValue} /></div>
              <div className="field"><label htmlFor="to">Até</label><input className="filter-input" id="to" name="to" type="date" defaultValue={toValue} /></div>
              <button className="button button-secondary" type="submit">Filtrar</button>
            </form>
            <div className="summary-list">
              <div className="summary-item"><span>Alunos novos</span><strong>{newStudents}</strong></div>
              <div className="summary-item"><span>Desistentes</span><strong>{dropouts}</strong></div>
              <div className="summary-item"><span>Período</span><strong>{fromValue} — {toValue}</strong></div>
            </div>
          </section>
          <div className="notice"><strong>Lembretes por e-mail</strong><p>A estrutura já reserva os lembretes de renovação para conectar o provedor de e-mail depois.</p></div>
        </aside>
      </div>
    </AppShell>
  );
}
