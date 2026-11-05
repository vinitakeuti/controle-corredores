import { notFound } from "next/navigation";
import { PaymentStatus, UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { StudentBillingControls } from "@/components/student-billing-controls";
import { StudentAccountStatusControl } from "@/components/student-account-status-control";
import { StudentPasswordResetLink } from "@/components/student-password-reset-link";
import { LiabilityTermReview } from "@/components/liability-term-review";
import { liabilityTermStatusLabel } from "@/components/liability-term-labels";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill, toneForLabel } from "@/components/ui/status-pill";
import { canGeneratePasswordResetLink } from "@/lib/access-control";
import { requireFeature } from "@/lib/auth";
import { calculateAge, formatCpf, formatCurrency, formatDate, formatPhone, paymentLabel, paymentMethodLabel, subscriptionLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getActivePlans } from "@/lib/plans";

export default async function StudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireFeature("students");
  const { id } = await params;
  const [student, plans] = await Promise.all([
    prisma.user.findUnique({ where: { id }, include: { subscription: { include: { plan: { include: { service: true } } } }, payments: { where: { status: PaymentStatus.PAID }, orderBy: { paidAt: "asc" } } } }),
    getActivePlans(),
  ]);
  if (!student || student.role !== UserRole.STUDENT) notFound();

  const firstPayment = student.payments[0];
  const lastPayment = student.payments.at(-1);
  const age = calculateAge(student.birthDate);
  // Mesma regra da Visão geral: assinatura ativa com vencimento já passado conta como atraso para a equipe.
  const overdue = Boolean(student.subscription?.status === "ACTIVE" && !student.subscription.isCourtesy && student.subscription.nextBillingAt && student.subscription.nextBillingAt < new Date());
  const status = !student.active ? "Inativo" : student.leftAt ? "Desistente" : overdue ? "Em atraso" : subscriptionLabel(student.subscription?.status ?? "");
  const periodLabel = { MONTHLY: "Mensal", QUARTERLY: "Trimestral", SEMIANNUAL: "Semestral", ANNUAL: "Anual" } as const;
  const termStatus = student.liabilityTermStatus === "SUBMITTED" || student.liabilityTermStatus === "APPROVED" || student.liabilityTermStatus === "REJECTED" ? student.liabilityTermStatus : "PENDING";
  const subscription = student.subscription;
  const nextCharge = subscription?.isCourtesy ? "Cortesia ativa" : formatDate(subscription?.nextBillingAt);
  const currentValue = subscription?.isCourtesy ? "Cortesia" : subscription ? formatCurrency(subscription.priceCents) : "—";
  const priceKind = subscription?.isCourtesy ? "Cortesia" : subscription?.hasCustomPrice ? "Valor exclusivo" : "Valor do plano";
  const paymentsNewestFirst = student.payments.slice().reverse();

  return (
    <AppShell user={user} current="students">
      <PageHeader context={{ label: "Alunos", href: "/admin/alunos", current: "Perfil" }} title={`${student.name}.`} lead="Dados cadastrais e histórico financeiro básico." />

      <dl className="summary-strip profile-summary" aria-label="Resumo do aluno">
        <div><dt>Situação</dt><dd><StatusPill tone={toneForLabel(status)}>{status || "Sem assinatura"}</StatusPill></dd></div>
        <div><dt>Próxima cobrança</dt><dd>{nextCharge}</dd></div>
        <div><dt>Valor vigente</dt><dd className="summary-figure">{currentValue}</dd></div>
        <div><dt>Termo de responsabilidade</dt><dd><StatusPill tone={toneForLabel(liabilityTermStatusLabel[termStatus])}>{liabilityTermStatusLabel[termStatus]}</StatusPill></dd></div>
      </dl>

      <div className="profile-columns">
        <section className="section-block" aria-labelledby="profile-basic">
          <div className="section-head"><div><h2 className="section-title" id="profile-basic">Dados básicos</h2><p className="section-lead">Cadastro e contato do aluno.</p></div></div>
          <dl className="dl-grid">
            <div><dt>Nome</dt><dd>{student.name}</dd></div>
            <div><dt>E-mail</dt><dd>{student.email}</dd></div>
            <div><dt>CPF</dt><dd>{formatCpf(student.cpf)}</dd></div>
            <div><dt>Idade</dt><dd>{age === null ? "—" : `${age} anos`}</dd></div>
            <div><dt>Telefone</dt><dd>{formatPhone(student.phone)}</dd></div>
            <div><dt>Data de ingresso</dt><dd>{formatDate(student.joinedAt)}</dd></div>
          </dl>
        </section>
        <section className="section-block" aria-labelledby="profile-payments-summary">
          <div className="section-head"><div><h2 className="section-title" id="profile-payments-summary">Pagamentos</h2><p className="section-lead">Resumo do histórico confirmado.</p></div></div>
          <dl className="kv-list">
            <div><dt>Primeiro pagamento</dt><dd>{formatDate(firstPayment?.paidAt)}</dd></div>
            <div><dt>Último pagamento</dt><dd>{formatDate(lastPayment?.paidAt)}</dd></div>
            <div><dt>Valor mais recente</dt><dd>{lastPayment ? formatCurrency(lastPayment.amountCents) : "—"}</dd></div>
          </dl>
        </section>
      </div>

      <section className="section-block" aria-labelledby="profile-enrollment">
        <div className="section-head">
          <div><h2 className="section-title" id="profile-enrollment">Plano atual</h2><p className="section-lead">Serviço e condição comercial deste aluno.</p></div>
          <StatusPill tone={subscription?.isCourtesy || subscription?.hasCustomPrice ? "info" : "neutral"}>{priceKind}</StatusPill>
        </div>
        <dl className="dl-grid profile-enrollment-grid">
          <div><dt>Categoria</dt><dd>{subscription?.plan?.service.name ?? "Ainda não definida"}</dd></div>
          <div><dt>Plano</dt><dd>{subscription?.plan ? periodLabel[subscription.plan.period] : "Ainda não escolhido"}</dd></div>
          <div><dt>Cobrança</dt><dd>{subscription?.isCourtesy ? "Isenta" : subscription?.manualMonthlyBilling ? "Mensal manual" : "Por período"}</dd></div>
        </dl>
      </section>

      {subscription && student.active ? <StudentBillingControls studentId={student.id} initialPriceCents={subscription.priceCents} initialPlanId={subscription.planId} initialAllowedMethods={subscription.allowedMethods} initialManualMonthlyBilling={subscription.manualMonthlyBilling} initialIsCourtesy={subscription.isCourtesy} automaticPixActive={subscription.recurringEnabled && subscription.asaasPixAuthorizationStatus === "ACTIVE"} hasCustomPrice={subscription.hasCustomPrice} plans={plans} canDelete={user.role === UserRole.ADMIN} canManageCourtesy={user.role === UserRole.ADMIN} /> : null}

      <LiabilityTermReview studentId={student.id} status={termStatus} fileName={student.liabilityTermFileName} submittedAt={student.liabilityTermSubmittedAt ? formatDate(student.liabilityTermSubmittedAt) : null} reviewedAt={student.liabilityTermReviewedAt ? formatDate(student.liabilityTermReviewedAt) : null} reviewNote={student.liabilityTermReviewNote} hasSignedPdf={Boolean(student.liabilityTermSignedPdf)} />

      <section className="section-block" aria-labelledby="profile-payments">
        <div className="section-head"><div><h2 className="section-title" id="profile-payments">Pagamentos confirmados</h2><p className="section-lead">{student.payments.length} {student.payments.length === 1 ? "lançamento encontrado" : "lançamentos encontrados"}.</p></div></div>
        {student.payments.length ? <>
          <div className="data-table-wrap profile-payments-table">
            <table className="data-table">
              <caption className="visually-hidden">Pagamentos confirmados de {student.name}</caption>
              <thead><tr><th scope="col">Data</th><th scope="col">Método</th><th scope="col" className="num">Valor</th><th scope="col">Status</th></tr></thead>
              <tbody>{paymentsNewestFirst.map((payment) => <tr key={payment.id}><td>{formatDate(payment.paidAt)}</td><td>{paymentMethodLabel(payment.method)}</td><td className="num">{formatCurrency(payment.amountCents)}</td><td><StatusPill tone={toneForLabel(paymentLabel(payment.status))}>{paymentLabel(payment.status)}</StatusPill></td></tr>)}</tbody>
            </table>
          </div>
          <ul className="data-rows profile-payments-rows" aria-label={`Pagamentos confirmados de ${student.name}`}>
            {paymentsNewestFirst.map((payment) => <li key={payment.id}><span className="row-title">{formatCurrency(payment.amountCents)}</span><StatusPill tone={toneForLabel(paymentLabel(payment.status))}>{paymentLabel(payment.status)}</StatusPill><span className="row-meta"><span>{formatDate(payment.paidAt)}</span><span>{paymentMethodLabel(payment.method)}</span></span></li>)}
          </ul>
        </> : <div className="state-empty"><strong>Nenhum pagamento confirmado.</strong><p>Os pagamentos confirmados deste aluno aparecem nesta lista.</p></div>}
      </section>

      <StudentAccountStatusControl studentId={student.id} initialActive={student.active} canManage={user.role === UserRole.ADMIN} />

      {canGeneratePasswordResetLink(user) ? <StudentPasswordResetLink studentId={student.id} studentEmail={student.email} active={student.active} /> : null}
    </AppShell>
  );
}
