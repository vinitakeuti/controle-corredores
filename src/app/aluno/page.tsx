import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { CheckoutPayment } from "@/components/checkout-payment";
import { LiabilityTermAcceptance } from "@/components/liability-term-acceptance";
import { PasswordChangeForm } from "@/components/password-change-form";
import { StudentPlanPicker } from "@/components/student-plan-picker";
import { StudentSubscriptionFlow } from "@/components/student-subscription-flow";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill, toneForLabel } from "@/components/ui/status-pill";
import { requireRole } from "@/lib/auth";
import { formatCurrency, formatDate, paymentLabel, paymentMethodLabel, subscriptionLabel } from "@/lib/format";
import { getPaymentCheckoutConfig } from "@/lib/payment-gateway";
import { periodMonths, subscriptionChargeCents } from "@/lib/plan-billing";
import { getPlansForStudent } from "@/lib/plans";
import { StudentCouponBox } from "@/components/student-coupon-box";
import { firstPaymentDiscount, hasPaidBefore } from "@/lib/influencers";
import { prisma } from "@/lib/prisma";

export default async function StudentPage({ searchParams }: { searchParams: Promise<{ termDownloadError?: string; etapa?: string }> }) {
  const { termDownloadError, etapa } = await searchParams;
  const user = await requireRole(UserRole.STUDENT, { allowInactiveStudent: true });
  if (!user.active) {
    return <AppShell user={user} current="student"><section className="blocked" role="status">
      <PageHeader context={{ label: "Área do aluno" }} title="Sua conta está inativa." lead="Entre em contato com o suporte da Pace Lab para regularizar seu acesso à assessoria." />
      <p className="message" data-tone="neutral"><Icon name="store" /><span>Você pode continuar acessando a loja pelo menu.</span></p>
    </section></AppShell>;
  }
  const account = await prisma.user.findUnique({
    where: { id: user.id },
    include: { subscription: { include: { plan: { select: { isHidden: true } } } }, payments: { orderBy: { createdAt: "desc" }, take: 6 }, referredBy: { select: { couponCode: true } } },
  });
  const subscription = account?.subscription;
  const gateway = await getPaymentCheckoutConfig();
  const plans = await getPlansForStudent(subscription?.planId);
  // Plano oculto aplicado pela equipe: o aluno paga, mas não troca de plano sozinho.
  const specialCondition = Boolean(subscription?.plan?.isHidden);
  const selectingPlan = Boolean(subscription && !subscription.hasCustomPrice && !subscription.manualMonthlyBilling && !specialCondition);

  if (subscription?.status === "ACTIVE" && account?.liabilityTermRequiredAt && account.liabilityTermStatus !== "APPROVED") {
    const termStatus = account.liabilityTermStatus === "SUBMITTED" || account.liabilityTermStatus === "REJECTED" ? account.liabilityTermStatus : "PENDING";
    return <AppShell user={user} current="student"><LiabilityTermAcceptance status={termStatus} reviewNote={account.liabilityTermReviewNote} downloadError={termDownloadError === "1"} /></AppShell>;
  }

  if (!subscription || !subscription.planId || subscription.status !== "ACTIVE") {
    const exclusive = subscription?.hasCustomPrice || subscription?.manualMonthlyBilling || specialCondition;
    // Cupom de Expert/Creator: aparece até o primeiro pagamento.
    const [paidBefore, discount] = await Promise.all([hasPaidBefore(prisma, user.id), firstPaymentDiscount(user.id)]);
    const couponBox = subscription && !subscription.isCourtesy && !paidBefore ? <StudentCouponBox appliedCode={account?.referredBy?.couponCode ?? null} discountPercent={discount?.percent ?? 0} /> : null;
    return <AppShell user={user} current="student">
      <PageHeader tutorialAnchor="student-heading" context={{ label: "Área do aluno" }} title={selectingPlan ? "Escolha seu plano." : `Olá, ${user.name.split(" ")[0]}.`} lead={selectingPlan ? "Selecione o serviço e a duração que fazem sentido para sua rotina." : exclusive ? "Sua condição comercial já está definida. Escolha como pagar." : "Escolha seu plano e conclua seu primeiro pagamento."} />
      {subscription?.status === "PAST_DUE" ? <div className="message student-note" data-tone="warning" role="status"><Icon name="alert" /><div><strong>Vamos colocar sua assinatura em dia?</strong><p>{subscription.nextBillingAt ? `Sua mensalidade venceu em ${formatDate(subscription.nextBillingAt)}. ` : ""}Escolha como pagar abaixo e siga no ritmo.</p></div></div> : null}
      {couponBox}
      {exclusive ? <p className="message student-note" data-tone="info"><Icon name="info" /><span>{subscription?.manualMonthlyBilling ? "Sua cobrança é manual e mensal, conforme a condição definida pela Pace Lab." : specialCondition && !subscription?.hasCustomPrice ? "Você recebeu uma condição especial da Pace Lab para esta assinatura." : "Você recebeu um valor exclusivo definido pela Pace Lab para esta assinatura."}</span></p> : null}
      {plans.length && subscription ? <StudentSubscriptionFlow plans={plans} initialPlanId={subscription.planId} name={account?.name ?? user.name} cpf={account?.cpf ?? ""} gatewayEnabled={gateway.enabled} activeProvider={gateway.activeProvider} appmaxExternalId={gateway.appmaxExternalId} recurrenceEnabled={gateway.recurrenceEnabled} allowedMethods={subscription.allowedMethods} automaticPixEnabled={subscription.automaticPixEnabled} customPriceCents={subscription.hasCustomPrice ? subscription.priceCents : null} manualMonthlyBilling={subscription.manualMonthlyBilling} lockPlan={(subscription.hasCustomPrice || subscription.manualMonthlyBilling || specialCondition) && Boolean(subscription.planId)} specialCondition={specialCondition} startAtPayment={etapa === "pagamento"} coupon={discount ? { code: discount.couponCode, percent: discount.percent } : null} /> : <div className="state-empty"><strong>Os planos estarão disponíveis em breve.</strong><p>A assessoria ainda não publicou opções de assinatura para escolha.</p></div>}
    </AppShell>;
  }

  // Assinatura ativa com vencimento já passado: a equipe já a conta como atrasada; para o aluno, mostramos que a confirmação está pendente.
  const paymentOverdue = !subscription.isCourtesy && Boolean(subscription.nextBillingAt && subscription.nextBillingAt < new Date());
  const statusText = paymentOverdue ? "Pagamento pendente" : subscriptionLabel(subscription?.status ?? "INCOMPLETE");

  return (
    <AppShell user={user} current="student">
      <PageHeader tutorialAnchor="student-heading" context={{ label: "Área do aluno" }} title={`Olá, ${user.name.split(" ")[0]}.`} lead={subscription.isCourtesy ? "Sua cortesia está ativa. Bons treinos!" : "Veja sua assinatura e escolha como pagar."} />

      <section className="subscription-panel brand-surface" aria-labelledby="subscription-title">
        <p className="subscription-kicker">Minha assinatura</p>
        <h2 id="subscription-title">{subscription?.planName ?? "Assinatura ainda não configurada"}</h2>
        <dl className="subscription-facts">
          <div><dt>Status</dt><dd><StatusPill tone={toneForLabel(statusText)}>{statusText}</StatusPill></dd></div>
          <div><dt>{subscription.isCourtesy ? "Condição" : "Próxima cobrança"}</dt><dd>{subscription.isCourtesy ? "Cortesia ativa" : formatDate(subscription?.nextBillingAt)}</dd></div>
          <div><dt>{subscription.isCourtesy ? "Plano" : subscription.hasCustomPrice ? "Valor exclusivo por mês" : "Valor por mês"}</dt><dd>{subscription.isCourtesy ? subscription.planName : subscription ? formatCurrency(subscription.priceCents) : "—"}</dd></div>
          <div><dt>{subscription.isCourtesy ? "Pagamento" : subscription.manualMonthlyBilling ? "Cobrança mensal manual" : "Valor total do plano"}</dt><dd>{subscription.isCourtesy ? "Isento" : subscription ? formatCurrency(subscriptionChargeCents(subscription.priceCents, subscription.billingPeriod, subscription.manualMonthlyBilling)) : "—"}</dd></div>
        </dl>
      </section>

      {paymentOverdue ? <p className="message student-note" data-tone="warning" role="status"><Icon name="alert" /><span>A mensalidade de {formatDate(subscription.nextBillingAt)} ainda não foi confirmada. Se você usa Pix Automático ou cartão recorrente, a confirmação pode levar alguns dias.</span></p> : null}
      {subscription.isCourtesy || subscription.hasCustomPrice || subscription.manualMonthlyBilling || specialCondition ? <p className="message student-note" data-tone="info"><Icon name="info" /><span>{subscription.isCourtesy ? "Você recebeu uma cortesia da Pace Lab. Não há pagamento pendente para esta assinatura." : subscription.manualMonthlyBilling ? "Sua cobrança é manual e mensal. A cada mês, gere o pagamento do valor indicado acima." : subscription.hasCustomPrice ? "Sua assinatura possui um valor exclusivo definido pela Pace Lab." : "Sua assinatura é uma condição especial da Pace Lab."}</span></p> : null}

      {!subscription.isCourtesy ? <section className="section-block student-payment" data-tutorial-anchor="student-payment">
        <CheckoutPayment
          name={account?.name ?? user.name}
          cpf={account?.cpf ?? ""}
          amountCents={subscriptionChargeCents(subscription.priceCents, subscription.billingPeriod, subscription.manualMonthlyBilling)}
          gatewayEnabled={gateway.enabled}
          activeProvider={gateway.activeProvider}
          appmaxExternalId={gateway.appmaxExternalId}
          recurrenceEnabled={subscription.manualMonthlyBilling ? false : gateway.recurrenceEnabled}
          allowedMethods={subscription.allowedMethods}
          automaticPixEnabled={subscription.manualMonthlyBilling ? false : subscription.automaticPixEnabled}
          installmentLimit={subscription.manualMonthlyBilling ? 1 : periodMonths[subscription.billingPeriod]}
          embedded
        />
      </section> : null}

      {plans.length && !subscription.isCourtesy && !subscription.hasCustomPrice && !subscription.manualMonthlyBilling && !specialCondition ? <details className="disclosure student-change-plan">
        <summary><span><span className="section-title">Trocar plano</span><span className="section-lead disclosure-lead">Selecione o serviço e a duração que fazem sentido para sua rotina.</span></span><Icon name="chevronRight" /></summary>
        <div className="disclosure-body"><StudentPlanPicker plans={plans} currentPlanId={subscription.planId} compact /></div>
      </details> : null}

      <section className="section-block" aria-labelledby="student-history-title">
        <div className="section-head"><div><h2 className="section-title" id="student-history-title">Histórico de pagamentos</h2><p className="section-lead">Seus últimos lançamentos.</p></div></div>
        {account?.payments.length ? <ul className="ledger">{account.payments.map((payment) => <li className="ledger-row" key={payment.id}><div className="ledger-row-content">
          <span className="ledger-copy"><strong>{formatCurrency(payment.amountCents)}</strong><small>{formatDate(payment.createdAt)} · {paymentMethodLabel(payment.method)}</small></span>
          <StatusPill tone={toneForLabel(paymentLabel(payment.status))}>{paymentLabel(payment.status)}</StatusPill>
        </div></li>)}</ul> : <div className="state-empty"><p>Nenhum pagamento registrado ainda.</p></div>}
      </section>

      <section className="section-block" data-tutorial-anchor="security" aria-labelledby="student-security-title">
        <div className="section-head"><div><h2 className="section-title" id="student-security-title">Segurança</h2><p className="section-lead">A senha temporária não expira. Altere-a quando quiser.</p></div></div>
        <PasswordChangeForm />
      </section>
    </AppShell>
  );
}
