import Link from "next/link";
import { FinancialEntryType, PaymentStatus, SubscriptionStatus, UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { FinancialValues, FinancialVisibilityToggle, HideableMoney } from "@/components/overview-financial-privacy";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { canAccessFeature } from "@/lib/access-control";
import { requireFeature } from "@/lib/auth";
import { currentMonthInMaceio, formatCurrency, formatDate, formatTime, greetingForDate, paymentMethodLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { contractedMonthlyRevenueCents } from "@/lib/revenue-recognition";
import { getStoreSalesSummary } from "@/lib/store-finance";

const numberFormat = new Intl.NumberFormat("pt-BR");

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
  const [totalStudents, activeStudents, overdueStudents, pendingStudents, cashPayments, activeSubscriptions, recentPayments, recentStudents, manualRevenue, storeSales] = await Promise.all([
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

        <div className="overview-columns">
          {isAdmin ? <section className="section-block" aria-labelledby="overview-payments-title">
            <div className="section-head"><div><h2 className="section-title" id="overview-payments-title">Pagamentos de {currentMonth}</h2><p className="section-lead">Confirmações registradas neste mês.</p></div></div>
            {recentPayments.length ? <ul className="activity-list">{recentPayments.map((payment) => <li key={payment.id}>
              <span className="activity-mark" aria-hidden="true"><Icon name="check" className="icon-sm" /></span>
              <span className="activity-copy"><strong>{payment.user.name}</strong><span>{paymentMethodLabel(payment.method)} · <HideableMoney value={formatCurrency(payment.amountCents)} /></span></span>
              <time className="activity-time" dateTime={(payment.paidAt ?? payment.createdAt).toISOString()}>{formatTime(payment.paidAt ?? payment.createdAt)}</time>
            </li>)}</ul> : <div className="state-empty"><strong>Ainda não há pagamentos confirmados neste mês.</strong></div>}
          </section> : <section className="section-block" aria-labelledby="overview-revenue-title">
            <div className="section-head"><div><h2 className="section-title" id="overview-revenue-title">Receita de {currentMonth}</h2><p className="section-lead">O valor mensal das parcelas ativas no período.</p></div></div>
            <div className="state-empty"><p>A receita do mês está disponível no resumo acima.</p></div>
          </section>}

          <section className="section-block" aria-labelledby="overview-new-title">
            <div className="section-head">
              <div><h2 className="section-title" id="overview-new-title">Novos cadastros</h2><p className="section-lead">Entradas registradas em {currentMonth}.</p></div>
              <StatusPill tone="neutral">{recentStudents.length} no mês</StatusPill>
            </div>
            {recentStudents.length ? <ul className="activity-list">{recentStudents.map((student) => <li key={student.id}>
              <span className="activity-copy"><strong>{student.name}</strong><span>{student.saleOwner?.name ? `Venda: ${student.saleOwner.name}` : "Sem vendedor definido"}</span></span>
              <time className="activity-time" dateTime={student.createdAt.toISOString()}>{formatDate(student.createdAt)}</time>
            </li>)}</ul> : <div className="state-empty"><strong>Nenhum cadastro neste mês.</strong></div>}
          </section>
        </div>
      </FinancialValues>
    </AppShell>
  );
}
