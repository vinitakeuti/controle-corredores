import { PaymentStatus, SubscriptionStatus, UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";
import { formatCurrency, formatDate, formatTime, greetingForDate, paymentMethodLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { recognizedRevenueCents } from "@/lib/revenue-recognition";

export default async function AdminPage() {
  const user = await requireRole(UserRole.ADMIN);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const recognitionStart = new Date(now.getFullYear(), now.getMonth() - 12, 1);
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const [totalStudents, activeStudents, overdueStudents, pendingStudents, cashPayments, recognizedPayments, recentPayments, recentStudents] = await Promise.all([
    prisma.user.count({ where: { role: UserRole.STUDENT } }),
    prisma.user.count({ where: { role: UserRole.STUDENT, active: true, subscription: { is: { status: SubscriptionStatus.ACTIVE } } } }),
    prisma.user.count({ where: { role: UserRole.STUDENT, active: true, subscription: { is: { OR: [{ status: SubscriptionStatus.PAST_DUE }, { nextBillingAt: { lt: now } }] } } } }),
    prisma.user.count({ where: { role: UserRole.STUDENT, active: true, subscription: { is: { status: SubscriptionStatus.INCOMPLETE } } } }),
    prisma.payment.aggregate({ where: { status: PaymentStatus.PAID, paidAt: { gte: monthStart, lte: now } }, _sum: { amountCents: true }, _count: true }),
    prisma.payment.findMany({ where: { status: PaymentStatus.PAID, paidAt: { gte: recognitionStart, lte: now } }, select: { amountCents: true, paidAt: true, subscription: { select: { billingPeriod: true, manualMonthlyBilling: true } } } }),
    prisma.payment.findMany({ where: { status: PaymentStatus.PAID }, include: { user: true }, orderBy: { paidAt: "desc" }, take: 8 }),
    prisma.user.findMany({ where: { role: UserRole.STUDENT, createdAt: { gte: todayStart, lte: now } }, include: { saleOwner: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const recognizedRevenue = recognizedRevenueCents(recognizedPayments, monthStart, now);

  return <AppShell user={user} current="admin"><header className="page-heading"><div><p className="eyebrow">Visão geral</p><h1>{greetingForDate(now)}, {user.name.split(" ")[0]}.</h1><p>Um retrato financeiro e operacional da Pace Lab.</p></div><div className="date-now">Atualizado agora</div></header><section className="overview-financial"><div className="overview-financial-heading"><p className="eyebrow">Financeiro no mês</p><p>Compare o que entrou no caixa com o valor mensal dos contratos ativos no período.</p></div><div className="overview-financial-grid"><article className="metric-card"><p>Recebido no mês</p><strong>{formatCurrency(cashPayments._sum.amountCents ?? 0)}</strong><small>{cashPayments._count} pagamento(s) confirmado(s) · valor efetivamente recebido</small></article><article className="metric-card"><p>Receita mensal</p><strong>{formatCurrency(recognizedRevenue)}</strong><small>parcela correspondente a este mês, sem antecipações</small></article></div></section><section className="metric-grid overview-status-grid" aria-label="Indicadores operacionais"><article className="metric-card"><p>Alunos ativos</p><strong>{activeStudents}</strong><small>{totalStudents} cadastros no total</small></article><article className="metric-card alert"><p>Em atraso</p><strong>{overdueStudents}</strong><small>precisam de atenção</small></article><article className="metric-card"><p>Aguardando pagamento</p><strong>{pendingStudents}</strong><small>possíveis vendas em aberto</small></article></section><div className="section-grid"><section className="panel"><div className="panel-heading"><div><h2>Últimos pagamentos</h2><p>Confirmações mais recentes.</p></div></div>{recentPayments.length ? <div className="notification-list">{recentPayments.map((payment) => <div className="notification-item" key={payment.id}><span className="notification-mark">OK</span><div><div className="notification-title">{payment.user.name}</div><div className="notification-description">{paymentMethodLabel(payment.method)} · {formatCurrency(payment.amountCents)}</div></div><time className="notification-time">{formatTime(payment.paidAt ?? payment.createdAt)}</time></div>)}</div> : <div className="empty-state">Ainda não há pagamentos confirmados.</div>}</section><aside><section className="panel"><div className="panel-heading"><div><h2>Novos cadastros</h2><p>Entradas registradas hoje.</p></div><span className="pill">{recentStudents.length} hoje</span></div>{recentStudents.length ? <div className="summary-list">{recentStudents.map((student) => <div className="summary-item" key={student.id}><span>{student.name}<small>{student.saleOwner?.name ? "Venda: " + student.saleOwner.name : "Sem vendedor definido"}</small></span><strong>{formatDate(student.createdAt)}</strong></div>)}</div> : <div className="empty-state">Nenhum cadastro hoje.</div>}</section></aside></div></AppShell>;
}
