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
const UPCOMING_LIMIT = 3;
const upcomingDateFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Maceio", weekday: "short", day: "numeric", month: "short" });
const dayKey = (date: Date) => { const { year, month, day } = maceioDateParts(date); return Date.UTC(year, month - 1, day); };

// Dia do compromisso no calendário de Maceió: Hoje, Amanhã ou "Seg., 9 de nov."
function upcomingDay(date: Date, now: Date) {
  const diff = Math.round((dayKey(date) - dayKey(now)) / 86_400_000);
  if (diff === 0) return { label: "Hoje", today: true };
  if (diff === 1) return { label: "Amanhã", today: false };
  const text = upcomingDateFormat.format(date);
  return { label: text.charAt(0).toUpperCase() + text.slice(1), today: false };
}

function Metric({ label, value, note, href, tone, money = false }: { label: string; value: React.ReactNode; note: string; href?: string; tone?: "danger" | "positive"; money?: boolean }) {
  const content = <>
    <span className="metric-label">{label}</span>
    <strong className="metric-value">{value}</strong>
    <span className="metric-note">{note}{href ? <Icon name="chevronRight" className="icon-sm" /> : null}</span>
  </>;
  const size = money ? "money" : undefined;
  return href ? <Link className="metric" data-tone={tone} data-size={size} href={href}>{content}</Link> : <div className="metric" data-tone={tone} data-size={size}>{content}</div>;
}

export default async function AdminPage() {
  const user = await requireFeature("overview");
  const now = new Date();
  const { name: currentMonth, startsAt: monthStart } = currentMonthInMaceio(now);
  const storeMonth = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, "0")}`;
  // Próximos compromissos: mesma regra de visibilidade da agenda de Demandas (só áreas de que a pessoa participa).
  const canSeeDemands = canAccessFeature(user, "demands");
  const upcomingWhere = { archivedAt: null, completedAt: null, scheduledAt: { gte: now }, workArea: { members: { some: { userId: user.id } } } };
  const [totalStudents, activeStudents, overdueStudents, pendingStudents, cashPayments, activeSubscriptions, recentPayments, recentStudents, manualRevenue, storeSales, upcoming] = await Promise.all([
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
    canSeeDemands ? prisma.demand.findMany({ where: upcomingWhere, select: { id: true, title: true, scheduledAt: true, workArea: { select: { id: true, name: true } } }, orderBy: { scheduledAt: "asc" }, take: UPCOMING_LIMIT }) : Promise.resolve([]),
  ]);
  const contractedRevenue = contractedMonthlyRevenueCents(activeSubscriptions);
  const receivedCents = (cashPayments._sum.amountCents ?? 0) + (manualRevenue._sum.amountCents ?? 0) + storeSales.totalCents;
  const isAdmin = user.role === UserRole.ADMIN;
  const canSeeStudents = user.role === UserRole.OPERATOR || canAccessFeature(user, "students");
  const canSeeAnalysis = user.role === UserRole.OPERATOR || canAccessFeature(user, "analysis");

  return (
    <AppShell user={user} current="admin">
      <FinancialValues>
        <PageHeader context={{ label: "Visão geral" }} title={`${greetingForDate(now)}, ${user.name.split(" ")[0]}.`} lead="Um retrato financeiro e operacional da Pace Lab." />

        {/* Números do mês num bloco só: dinheiro em cima, situação dos alunos embaixo. O olho fica junto dos valores que ele esconde. */}
        <section className="section-block overview-quick" aria-labelledby="overview-quick-title">
          <div className="section-head overview-quick-head">
            <h2 className="section-title" id="overview-quick-title">Números de {currentMonth}</h2>
            <div className="overview-quick-tools"><span className="overview-updated">Atualizado agora</span><FinancialVisibilityToggle /></div>
          </div>
          <div className="metric-strip overview-metrics" data-money={isAdmin ? 2 : 1}>
            {isAdmin ? <Metric money label={`Recebido em ${currentMonth}`} value={<HideableMoney value={formatCurrency(receivedCents)} />} note="Planos, loja e lançamentos manuais confirmados no mês" /> : null}
            <Metric money label={`Receita contratada de ${currentMonth}`} value={<HideableMoney value={formatCurrency(contractedRevenue)} />} note="Mensalidades de todos os contratos ativos, já consideradas no mês inteiro" tone="positive" />
            <Metric label="Alunos ativos" value={numberFormat.format(activeStudents)} note={`${numberFormat.format(totalStudents)} cadastros no total`} href={canSeeStudents ? "/admin/alunos" : undefined} />
            <Metric label="Em atraso" value={numberFormat.format(overdueStudents)} note="Precisam de atenção" href={canSeeAnalysis ? "/admin/analisar?status=overdue" : undefined} tone="danger" />
            <Metric label="Aguardando pagamento" value={numberFormat.format(pendingStudents)} note="Possíveis vendas em aberto" href={canSeeStudents ? "/admin/alunos?status=pendentes" : undefined} />
          </div>
        </section>

        {/* Prévia da agenda: só os 3 próximos, num cartão; a agenda completa fica em Demandas. */}
        {canSeeDemands ? <section className="upcoming-card" aria-labelledby="overview-upcoming-title">
          <div className="upcoming-head">
            <h2 className="upcoming-heading" id="overview-upcoming-title">Próximos compromissos</h2>
            <Link className="upcoming-more" href="/admin/demandas">Ver agenda<Icon name="arrowRight" className="icon-sm" /></Link>
          </div>
          {upcoming.length ? <ol className="upcoming-list">{upcoming.map((demand) => {
            const when = demand.scheduledAt ?? now;
            const day = upcomingDay(when, now);
            return <li key={demand.id}><Link className="upcoming-item" href={`/admin/demandas/${demand.workArea.id}`}>
              <span className="upcoming-when"><span className="upcoming-day" data-today={day.today || undefined}>{day.label}</span> · <time dateTime={when.toISOString()}>{formatTime(when)}</time></span>
              <span className="upcoming-title">{demand.title}</span>
              <span className="upcoming-area">{demand.workArea.name}</span>
            </Link></li>;
          })}</ol> : <p className="upcoming-empty">Nada agendado a partir de agora.</p>}
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
