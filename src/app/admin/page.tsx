import Link from "next/link";
import { FinancialEntryType, PaymentStatus, SubscriptionStatus, UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { FinancialValues, FinancialVisibilityToggle, HideableMoney } from "@/components/overview-financial-privacy";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { canAccessFeature } from "@/lib/access-control";
import { requireFeature } from "@/lib/auth";
import { currentMonthInMaceio, formatCurrency, formatDate, formatTime, greetingForDate, maceioDateParts, paymentMethodLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { contractedMonthlyRevenueCents } from "@/lib/revenue-recognition";
import { getStoreSalesSummary } from "@/lib/store-finance";

const numberFormat = new Intl.NumberFormat("pt-BR");
const UPCOMING_LIMIT = 6;
const weekdayFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Maceio", weekday: "short" });
const monthShortFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Maceio", month: "short" });
const dayKey = (date: Date) => { const { year, month, day } = maceioDateParts(date); return Date.UTC(year, month - 1, day); };
const firstName = (name: string) => name.split(" ")[0];
const joinNames = (names: string[]) => names.length > 1 ? `${names.slice(0, -1).join(", ")} e ${names.at(-1)}` : names[0] ?? "";

// Bloco de data do compromisso: Hoje / Amanhã / dia da semana, no calendário de Maceió.
function upcomingDay(date: Date, now: Date) {
  const diff = Math.round((dayKey(date) - dayKey(now)) / 86_400_000);
  const label = diff === 0 ? "Hoje" : diff === 1 ? "Amanhã" : weekdayFormat.format(date).replace(".", "");
  return { label, day: maceioDateParts(date).day, month: monthShortFormat.format(date).replace(".", ""), today: diff === 0 };
}

function Metric({ label, value, note, href, tone }: { label: string; value: React.ReactNode; note: string; href?: string; tone?: "danger" | "positive" }) {
  const content = <>
    <span className="metric-label">{label}</span>
    <strong className="metric-value">{value}</strong>
    <span className="metric-note">{note}{href ? <Icon name="chevronRight" className="icon-sm" /> : null}</span>
  </>;
  return href ? <Link className="metric" data-tone={tone} href={href}>{content}</Link> : <div className="metric" data-tone={tone}>{content}</div>;
}

export default async function AdminPage() {
  const user = await requireFeature("overview");
  const now = new Date();
  const { name: currentMonth, startsAt: monthStart } = currentMonthInMaceio(now);
  const storeMonth = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, "0")}`;
  // Próximos compromissos: mesma regra de visibilidade da agenda de Demandas (só áreas de que a pessoa participa).
  const canSeeDemands = canAccessFeature(user, "demands");
  const upcomingWhere = { archivedAt: null, completedAt: null, scheduledAt: { gte: now }, workArea: { members: { some: { userId: user.id } } } };
  const [totalStudents, activeStudents, overdueStudents, pendingStudents, cashPayments, activeSubscriptions, recentPayments, recentStudents, manualRevenue, storeSales, upcoming, upcomingWeek] = await Promise.all([
    prisma.user.count({ where: { role: UserRole.STUDENT } }),
    prisma.user.count({ where: { role: UserRole.STUDENT, active: true, subscription: { is: { status: SubscriptionStatus.ACTIVE } } } }),
    prisma.user.count({ where: { role: UserRole.STUDENT, active: true, subscription: { is: { OR: [{ status: SubscriptionStatus.PAST_DUE }, { nextBillingAt: { lt: now } }] } } } }),
    prisma.user.count({ where: { role: UserRole.STUDENT, active: true, subscription: { is: { status: SubscriptionStatus.INCOMPLETE } } } }),
    prisma.payment.aggregate({ where: { status: PaymentStatus.PAID, paidAt: { gte: monthStart, lte: now } }, _sum: { amountCents: true }, _count: true }),
    prisma.subscription.findMany({ where: { status: SubscriptionStatus.ACTIVE, isCourtesy: false, user: { is: { active: true } } }, select: { priceCents: true, isCourtesy: true } }),
    prisma.payment.findMany({ where: { status: PaymentStatus.PAID, paidAt: { gte: monthStart, lte: now } }, include: { user: true }, orderBy: { paidAt: "desc" }, take: 8 }),
    prisma.user.findMany({ where: { role: UserRole.STUDENT, createdAt: { gte: monthStart, lte: now } }, include: { saleOwner: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.financialEntry.aggregate({ where: { type: FinancialEntryType.REVENUE, occurredAt: { gte: monthStart, lte: now } }, _sum: { amountCents: true } }),
    getStoreSalesSummary(storeMonth),
    canSeeDemands ? prisma.demand.findMany({ where: upcomingWhere, select: { id: true, title: true, scheduledAt: true, workArea: { select: { id: true, name: true } }, assignees: { select: { user: { select: { name: true } } }, orderBy: { createdAt: "asc" } } }, orderBy: { scheduledAt: "asc" }, take: UPCOMING_LIMIT }) : Promise.resolve([]),
    canSeeDemands ? prisma.demand.count({ where: { ...upcomingWhere, scheduledAt: { gte: now, lt: new Date(now.getTime() + 7 * 86_400_000) } } }) : Promise.resolve(0),
  ]);
  const contractedRevenue = contractedMonthlyRevenueCents(activeSubscriptions);
  const receivedCents = (cashPayments._sum.amountCents ?? 0) + (manualRevenue._sum.amountCents ?? 0) + storeSales.totalCents;
  const isAdmin = user.role === UserRole.ADMIN;
  const canSeeStudents = user.role === UserRole.OPERATOR || canAccessFeature(user, "students");
  const canSeeAnalysis = user.role === UserRole.OPERATOR || canAccessFeature(user, "analysis");

  return (
    <AppShell user={user} current="admin">
      <FinancialValues>
        <PageHeader
          context={{ label: "Visão geral" }}
          title={`${greetingForDate(now)}, ${user.name.split(" ")[0]}.`}
          lead="Um retrato financeiro e operacional da Pace Lab."
          actions={<><span className="overview-updated">Atualizado agora</span><FinancialVisibilityToggle /></>}
        />

        <section className="section-block overview-results" aria-labelledby="overview-results-title">
          <div className="section-head">
            <div><h2 className="section-title" id="overview-results-title">Resultados de {currentMonth}</h2><p className="section-lead">Compare o que entrou no caixa com o valor mensal dos contratos ativos no período.</p></div>
          </div>
          <div className="metric-strip" data-count={isAdmin ? 2 : 1}>
            {isAdmin ? <Metric label={`Recebido em ${currentMonth}`} value={<HideableMoney value={formatCurrency(receivedCents)} />} note="Planos, loja e lançamentos manuais confirmados no mês" /> : null}
            <Metric label={`Receita contratada de ${currentMonth}`} value={<HideableMoney value={formatCurrency(contractedRevenue)} />} note="Mensalidades de todos os contratos ativos, já consideradas no mês inteiro" tone="positive" />
          </div>
        </section>

        <section className="section-block overview-status" aria-labelledby="overview-status-title">
          <div className="section-head"><div><h2 className="section-title" id="overview-status-title">Saúde da base</h2><p className="section-lead">Situação das assinaturas dos alunos ativos.</p></div></div>
          <div className="metric-strip" data-count={3}>
            <Metric label="Alunos ativos" value={numberFormat.format(activeStudents)} note={`${numberFormat.format(totalStudents)} cadastros no total`} href={canSeeStudents ? "/admin/alunos" : undefined} />
            <Metric label="Em atraso" value={numberFormat.format(overdueStudents)} note="Precisam de atenção" href={canSeeAnalysis ? "/admin/analisar?status=overdue" : undefined} tone="danger" />
            <Metric label="Aguardando pagamento" value={numberFormat.format(pendingStudents)} note="Possíveis vendas em aberto" href={canSeeStudents ? "/admin/alunos?status=pendentes" : undefined} />
          </div>
        </section>

        {canSeeDemands ? <section className="section-block overview-upcoming" aria-labelledby="overview-upcoming-title">
          <div className="section-head">
            <div><h2 className="section-title" id="overview-upcoming-title">Próximos compromissos</h2><p className="section-lead">{upcomingWeek ? `${numberFormat.format(upcomingWeek)} ${upcomingWeek === 1 ? "demanda agendada" : "demandas agendadas"} nos próximos 7 dias nas suas áreas.` : "Nenhuma demanda agendada nos próximos 7 dias nas suas áreas."}</p></div>
            <Link className="btn btn-secondary" href="/admin/demandas"><Icon name="calendar" />Ver agenda</Link>
          </div>
          {upcoming.length ? <ol className="upcoming-list" style={{ "--upcoming-rows": Math.ceil(upcoming.length / 2) } as React.CSSProperties}>{upcoming.map((demand) => {
            const when = demand.scheduledAt ?? now;
            const day = upcomingDay(when, now);
            const people = joinNames(demand.assignees.map((assignee) => firstName(assignee.user.name)));
            return <li key={demand.id}><Link className="upcoming-item" href={`/admin/demandas/${demand.workArea.id}`}>
              <span className="upcoming-date" data-today={day.today || undefined}><span>{day.label}</span><strong>{day.day}</strong><span>{day.month}</span></span>
              <span className="upcoming-copy"><strong>{demand.title}</strong><span>{demand.workArea.name}{people ? ` · com ${people}` : ""}</span></span>
              <time className="upcoming-time" dateTime={when.toISOString()}>{formatTime(when)}</time>
            </Link></li>;
          })}</ol> : <div className="state-empty"><p>Nada agendado a partir de agora. As demandas com data e horário aparecem aqui.</p></div>}
        </section> : null}

        <div className="overview-columns">
          {isAdmin ? <section className="section-block" aria-labelledby="overview-payments-title">
            <div className="section-head"><div><h2 className="section-title" id="overview-payments-title">Pagamentos de {currentMonth}</h2><p className="section-lead">Confirmações registradas neste mês.</p></div></div>
            {recentPayments.length ? <ul className="activity-list">{recentPayments.map((payment) => <li key={payment.id}>
              <span className="activity-mark" aria-hidden="true"><Icon name="check" className="icon-sm" /></span>
              <span className="activity-copy"><strong>{payment.user.name}</strong><span>{paymentMethodLabel(payment.method)} · <HideableMoney value={formatCurrency(payment.amountCents)} /></span></span>
              <time className="activity-time" dateTime={(payment.paidAt ?? payment.createdAt).toISOString()}>{formatTime(payment.paidAt ?? payment.createdAt)}</time>
            </li>)}</ul> : <div className="state-empty"><p>Ainda não há pagamentos confirmados neste mês.</p></div>}
          </section> : <section className="section-block" aria-labelledby="overview-revenue-title">
            <div className="section-head"><div><h2 className="section-title" id="overview-revenue-title">Receita de {currentMonth}</h2><p className="section-lead">O valor mensal das parcelas ativas no período.</p></div></div>
            <div className="state-empty"><p>A receita do mês está disponível no resumo acima.</p></div>
          </section>}

          <section className="section-block" aria-labelledby="overview-new-title">
            <div className="section-head">
              <div><h2 className="section-title" id="overview-new-title">Novos cadastros</h2><p className="section-lead">Entradas registradas em {currentMonth}.</p></div>
              <span className="count-label">{recentStudents.length} no mês</span>
            </div>
            {recentStudents.length ? <ul className="activity-list">{recentStudents.map((student) => <li key={student.id}>
              <span className="activity-copy"><strong>{student.name}</strong><span>{student.saleOwner?.name ? `Venda: ${student.saleOwner.name}` : "Sem vendedor definido"}</span></span>
              <time className="activity-time" dateTime={student.createdAt.toISOString()}>{formatDate(student.createdAt)}</time>
            </li>)}</ul> : <div className="state-empty"><p>Nenhum cadastro neste mês.</p></div>}
          </section>
        </div>
      </FinancialValues>
    </AppShell>
  );
}
