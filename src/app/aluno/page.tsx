import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { CheckoutPayment } from "@/components/checkout-payment";
import { LiabilityTermAcceptance } from "@/components/liability-term-acceptance";
import { PasswordChangeForm } from "@/components/password-change-form";
import { StudentPlanPicker } from "@/components/student-plan-picker";
import { StudentSubscriptionFlow } from "@/components/student-subscription-flow";
import { requireRole } from "@/lib/auth";
import { formatCurrency, formatDate, paymentLabel, paymentMethodLabel, subscriptionLabel } from "@/lib/format";
import { getPaymentCheckoutConfig } from "@/lib/payment-gateway";
import { periodMonths, planTotalCents } from "@/lib/plan-billing";
import { getActivePlans } from "@/lib/plans";
import { prisma } from "@/lib/prisma";

export default async function StudentPage() {
  const user = await requireRole(UserRole.STUDENT);
  const account = await prisma.user.findUnique({
    where: { id: user.id },
    include: { subscription: true, payments: { orderBy: { createdAt: "desc" }, take: 6 } },
  });
  const subscription = account?.subscription;
  const gateway = await getPaymentCheckoutConfig();
  const plans = await getActivePlans();

  if (subscription?.status === "ACTIVE" && account?.liabilityTermRequiredAt && !account.liabilityTermAcceptedAt) {
    return <AppShell user={user} current="student"><LiabilityTermAcceptance name={account.name} cpf={account.cpf} birthDate={formatDate(account.birthDate)} phone={account.phone} email={account.email} joinedAt={formatDate(account.joinedAt)} planName={subscription.planName} /></AppShell>;
  }

  if (!subscription || !subscription.planId || subscription.status !== "ACTIVE") {
    return <AppShell user={user} current="student"><header className="page-heading student-page-heading" data-tutorial-anchor="student-heading"><div><p className="eyebrow">Área do aluno</p><h1>Olá, {user.name.split(" ")[0]}.</h1><p>{subscription?.hasCustomPrice ? "Sua condição comercial já está definida. Escolha como pagar." : "Escolha seu plano e conclua seu primeiro pagamento."}</p></div></header>{subscription?.hasCustomPrice ? <p className="student-exclusive-price">Você recebeu um valor exclusivo definido pela Pace Lab para esta assinatura.</p> : null}{plans.length && subscription ? <StudentSubscriptionFlow plans={plans} initialPlanId={subscription.planId} name={account?.name ?? user.name} cpf={account?.cpf ?? ""} gatewayEnabled={gateway.enabled} activeProvider={gateway.activeProvider} appmaxExternalId={gateway.appmaxExternalId} recurrenceEnabled={gateway.recurrenceEnabled} allowedMethods={subscription.allowedMethods} automaticPixEnabled={subscription.automaticPixEnabled} customPriceCents={subscription.hasCustomPrice ? subscription.priceCents : null} lockPlan={subscription.hasCustomPrice && Boolean(subscription.planId)} /> : <section className="panel empty-state"><strong>Os planos estarão disponíveis em breve.</strong><p>A assessoria ainda não publicou opções de assinatura para escolha.</p></section>}</AppShell>;
  }

  return (
    <AppShell user={user} current="student">
      <header className="page-heading student-page-heading" data-tutorial-anchor="student-heading">
        <div><p className="eyebrow">Área do aluno</p><h1>Olá, {user.name.split(" ")[0]}.</h1><p>Veja sua assinatura e escolha como pagar.</p></div>
      </header>

      <section className="subscription-card">
        <div><p className="eyebrow">Minha assinatura</p><h2>{subscription?.planName ?? "Assinatura ainda não configurada"}</h2></div>
        <div className="subscription-meta">
          <div><small>Status</small><strong>{subscriptionLabel(subscription?.status ?? "INCOMPLETE")}</strong></div>
          <div><small>Próxima cobrança</small><strong>{formatDate(subscription?.nextBillingAt)}</strong></div>
          <div><small>{subscription.hasCustomPrice ? "Valor exclusivo por mês" : "Valor por mês"}</small><strong>{subscription ? formatCurrency(subscription.priceCents) : "—"}</strong></div>
          <div><small>Valor total do plano</small><strong>{subscription ? formatCurrency(planTotalCents(subscription.priceCents, subscription.billingPeriod)) : "—"}</strong></div>
        </div>
      </section>

      {subscription.hasCustomPrice ? <p className="student-exclusive-price">Sua assinatura possui um valor exclusivo definido pela Pace Lab.</p> : null}

      {plans.length && !subscription.hasCustomPrice ? <section className="panel student-plan-panel"><StudentPlanPicker plans={plans} currentPlanId={subscription.planId} compact /></section> : null}

      <section className="panel student-payment-panel" data-tutorial-anchor="student-payment">
        <CheckoutPayment
          name={account?.name ?? user.name}
          cpf={account?.cpf ?? ""}
          amountCents={planTotalCents(subscription.priceCents, subscription.billingPeriod)}
          gatewayEnabled={gateway.enabled}
          activeProvider={gateway.activeProvider}
          appmaxExternalId={gateway.appmaxExternalId}
          recurrenceEnabled={gateway.recurrenceEnabled}
          allowedMethods={subscription.allowedMethods}
          automaticPixEnabled={subscription.automaticPixEnabled}
          installmentLimit={periodMonths[subscription.billingPeriod]}
          embedded
        />
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panel-heading"><div><h2>Histórico de pagamentos</h2><p>Seus últimos lançamentos.</p></div></div>
        {account?.payments.length ? <div className="table-scroll"><table className="payments-table"><thead><tr><th>Data</th><th>Método</th><th>Status</th><th>Valor</th></tr></thead><tbody>{account.payments.map((payment) => <tr key={payment.id}><td>{formatDate(payment.createdAt)}</td><td>{paymentMethodLabel(payment.method)}</td><td><span className={`pill ${payment.status === "PAID" ? "" : "pill-coral"}`}>{paymentLabel(payment.status)}</span></td><td>{formatCurrency(payment.amountCents)}</td></tr>)}</tbody></table></div> : <div className="empty-state">Nenhum pagamento registrado ainda.</div>}
      </section>
      <section className="panel security-panel" data-tutorial-anchor="security"><div className="panel-heading"><div><h2>Segurança</h2><p>A senha temporária não expira. Altere-a quando quiser.</p></div></div><PasswordChangeForm /></section>
    </AppShell>
  );
}
