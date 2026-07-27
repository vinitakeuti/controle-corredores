import { PaymentStatus, SubscriptionStatus, UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";
import { formatCurrency, formatDate, formatTime, paymentMethodLabel, toDateEnd, toDateStart } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type AdminSearchParams = { from?: string; to?: string };
type Notification = { kind: "paid" | "overdue" | "generated" | "expired"; mark: string; title: string; description: string; eventAt: Date };

function inputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<AdminSearchParams> }) {
  const user = await requireRole(UserRole.ADMIN);
  const params = await searchParams;
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const fromValue = params.from ?? inputDate(defaultFrom);
  const toValue = params.to ?? inputDate(now);
  const from = toDateStart(fromValue) ?? defaultFrom;
  const to = toDateEnd(toValue) ?? now;

  const [totalStudents, upToDate, overdue, newStudents, dropouts, paidToday, overdueToday, generatedToday, expiredToday] = await Promise.all([
    prisma.user.count({ where: { role: UserRole.STUDENT } }),
    prisma.user.count({ where: { role: UserRole.STUDENT, active: true, subscription: { is: { status: SubscriptionStatus.ACTIVE, OR: [{ nextBillingAt: null }, { nextBillingAt: { gte: now } }] } } } }),
    prisma.user.count({ where: { role: UserRole.STUDENT, active: true, subscription: { is: { OR: [{ status: SubscriptionStatus.PAST_DUE }, { nextBillingAt: { lt: now } }] } } } }),
    prisma.user.count({ where: { role: UserRole.STUDENT, joinedAt: { gte: from, lte: to } } }),
    prisma.user.count({ where: { role: UserRole.STUDENT, leftAt: { not: null, gte: from, lte: to } } }),
    prisma.payment.findMany({ where: { status: PaymentStatus.PAID, paidAt: { gte: dayStart, lte: now } }, include: { user: true }, orderBy: { paidAt: "desc" }, take: 12 }),
    prisma.user.findMany({ where: { role: UserRole.STUDENT, active: true, subscription: { is: { status: SubscriptionStatus.PAST_DUE, nextBillingAt: { gte: dayStart, lte: now } } } }, include: { subscription: true }, orderBy: { name: "asc" }, take: 12 }),
    prisma.payment.findMany({ where: { createdAt: { gte: dayStart, lte: now } }, include: { user: true }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.payment.findMany({ where: { OR: [{ status: PaymentStatus.EXPIRED, updatedAt: { gte: dayStart, lte: now } }, { status: PaymentStatus.PENDING, expiresAt: { gte: dayStart, lte: now } }] }, include: { user: true }, orderBy: { expiresAt: "desc" }, take: 12 }),
  ]);

  const notifications: Notification[] = [
    ...paidToday.map((payment) => ({ kind: "paid" as const, mark: "OK", title: "Pagamento recebido", description: `${payment.user.name} · ${formatCurrency(payment.amountCents)}`, eventAt: payment.paidAt ?? payment.createdAt })),
    ...overdueToday.map((student) => ({ kind: "overdue" as const, mark: "ATR", title: "Pagamento em atraso", description: `${student.name} · vencimento ${formatDate(student.subscription?.nextBillingAt)}`, eventAt: student.subscription?.nextBillingAt ?? now })),
    ...generatedToday.map((payment) => ({ kind: "generated" as const, mark: payment.method === "BOLETO" ? "BOL" : payment.method === "CARD" ? "CAR" : "PIX", title: `${paymentMethodLabel(payment.method)} gerado`, description: `${payment.user.name} · ${formatCurrency(payment.amountCents)}`, eventAt: payment.createdAt })),
    ...expiredToday.map((payment) => ({ kind: "expired" as const, mark: "EXP", title: `${paymentMethodLabel(payment.method)} expirado`, description: `${payment.user.name} · cobrança não utilizada`, eventAt: payment.expiresAt ?? payment.updatedAt })),
  ].sort((a, b) => b.eventAt.getTime() - a.eventAt.getTime()).slice(0, 12);

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
          <div className="panel-heading"><div><h2>Notificações relevantes</h2><p>Eventos registrados somente hoje.</p></div><span className="pill">{notifications.length} hoje</span></div>
          {notifications.length === 0 ? <div className="empty-state">Nenhum evento relevante registrado hoje.</div> : <div className="notification-list">{notifications.map((notification, index) => <div className="notification-item" key={`${notification.kind}-${notification.eventAt.toISOString()}-${index}`}><span className="notification-mark">{notification.mark}</span><div><div className="notification-title">{notification.title}</div><div className="notification-description">{notification.description}</div></div><time className="notification-time">{formatTime(notification.eventAt)}</time></div>)}</div>}
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
