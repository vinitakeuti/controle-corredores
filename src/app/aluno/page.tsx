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
  const account = await prisma.user.findUnique({ where: { id: user.id }, include: { subscriptions: { orderBy: { createdAt: "asc" } }, payments: { orderBy: { createdAt: "desc" }, take: 6 } } });
  const subscriptions = account?.subscriptions ?? [];
  const activeSubscriptions = subscriptions.filter((subscription) => subscription.status === "ACTIVE");
  const pendingSubscriptions = subscriptions.filter((subscription) => subscription.planId && subscription.status !== "ACTIVE");
  const gateway = await getPaymentCheckoutConfig();
  const plans = await getActivePlans();

  if (activeSubscriptions.length && account?.liabilityTermRequiredAt && !account.liabilityTermAcceptedAt) {
    return <AppShell user={user} current="student"><LiabilityTermAcceptance name={account.name} cpf={account.cpf} birthDate={formatDate(account.birthDate)} phone={account.phone} email={account.email} joinedAt={formatDate(account.joinedAt)} planName={activeSubscriptions.map((subscription) => subscription.planName).join(" + ")} /></AppShell>;
  }

  if (!activeSubscriptions.length) {
    return <AppShell user={user} current="student"><header className="page-heading student-page-heading" data-tutorial-anchor="student-heading"><div><p className="eyebrow">Área do aluno</p><h1>Olá, {user.name.split(" ")[0]}.</h1><p>Escolha seus produtos e conclua o primeiro pagamento.</p></div></header>{plans.length ? <StudentSubscriptionFlow plans={plans} initialPlanIds={pendingSubscriptions.map((subscription) => subscription.planId!).filter(Boolean)} name={account?.name ?? user.name} cpf={account?.cpf ?? ""} gatewayEnabled={gateway.enabled} activeProvider={gateway.activeProvider} appmaxExternalId={gateway.appmaxExternalId} recurrenceEnabled={gateway.recurrenceEnabled} allowedMethods={pendingSubscriptions[0]?.allowedMethods ?? ["PIX", "CARD", "BOLETO"]} automaticPixEnabled={pendingSubscriptions.length === 1 && pendingSubscriptions[0]?.automaticPixEnabled} /> : <section className="panel empty-state"><strong>Os planos estarão disponíveis em breve.</strong><p>A assessoria ainda não publicou opções de assinatura para escolha.</p></section>}</AppShell>;
  }

  return <AppShell user={user} current="student">
    <header className="page-heading student-page-heading" data-tutorial-anchor="student-heading"><div><p className="eyebrow">Área do aluno</p><h1>Olá, {user.name.split(" ")[0]}.</h1><p>Veja seus produtos e acompanhe cada cobrança.</p></div></header>
    <section className="subscription-card"><div><p className="eyebrow">Meus produtos</p><h2>{activeSubscriptions.length} {activeSubscriptions.length === 1 ? "produto ativo" : "produtos ativos"}</h2></div><div className="subscription-meta">{activeSubscriptions.map((subscription) => <div key={subscription.id}><small>{subscription.planName}</small><strong>{formatDate(subscription.nextBillingAt)}</strong><span>{subscription.hasCustomPrice ? "Valor exclusivo" : formatCurrency(subscription.priceCents)}</span></div>)}</div></section>
    {activeSubscriptions.some((subscription) => subscription.hasCustomPrice) ? <p className="student-exclusive-price">Um ou mais produtos possuem valor exclusivo definido pela Pace Lab.</p> : null}
    {plans.length ? <section className="panel student-plan-panel"><StudentPlanPicker plans={plans} currentPlanIds={subscriptions.filter((subscription) => subscription.planId).map((subscription) => subscription.planId!)} /></section> : null}
    {pendingSubscriptions.length && plans.length ? <section className="panel student-payment-panel"><div className="panel-heading"><div><h2>Conclua os novos produtos</h2><p>Os produtos selecionados serão cobrados juntos neste primeiro pagamento.</p></div></div><StudentSubscriptionFlow plans={plans} initialPlanIds={pendingSubscriptions.map((subscription) => subscription.planId!)} name={account?.name ?? user.name} cpf={account?.cpf ?? ""} gatewayEnabled={gateway.enabled} activeProvider={gateway.activeProvider} appmaxExternalId={gateway.appmaxExternalId} recurrenceEnabled={gateway.recurrenceEnabled} allowedMethods={pendingSubscriptions[0]?.allowedMethods ?? ["PIX", "CARD", "BOLETO"]} automaticPixEnabled={pendingSubscriptions.length === 1 && pendingSubscriptions[0]?.automaticPixEnabled} /></section> : null}
    <section className="panel student-payment-panel" data-tutorial-anchor="student-payment"><div className="panel-heading"><div><h2>Pagamentos</h2><p>Escolha o produto que deseja pagar agora.</p></div></div>{activeSubscriptions.map((subscription) => <section className="student-product-payment" key={subscription.id}><div><strong>{subscription.planName}</strong><p>Próxima cobrança: {formatDate(subscription.nextBillingAt)} · {formatCurrency(planTotalCents(subscription.priceCents, subscription.billingPeriod))}</p></div><CheckoutPayment name={account?.name ?? user.name} cpf={account?.cpf ?? ""} amountCents={planTotalCents(subscription.priceCents, subscription.billingPeriod)} subscriptionIds={[subscription.id]} gatewayEnabled={gateway.enabled} activeProvider={gateway.activeProvider} appmaxExternalId={gateway.appmaxExternalId} recurrenceEnabled={gateway.recurrenceEnabled} allowedMethods={subscription.allowedMethods} automaticPixEnabled={subscription.automaticPixEnabled} installmentLimit={periodMonths[subscription.billingPeriod]} embedded /></section>)}</section>
    <section className="panel" style={{ marginTop: 18 }}><div className="panel-heading"><div><h2>Histórico de pagamentos</h2><p>Seus últimos lançamentos.</p></div></div>{account?.payments.length ? <div className="table-scroll"><table className="payments-table"><thead><tr><th>Data</th><th>Método</th><th>Status</th><th>Valor</th></tr></thead><tbody>{account.payments.map((payment) => <tr key={payment.id}><td>{formatDate(payment.createdAt)}</td><td>{paymentMethodLabel(payment.method)}</td><td><span className={`pill ${payment.status === "PAID" ? "" : "pill-coral"}`}>{paymentLabel(payment.status)}</span></td><td>{formatCurrency(payment.amountCents)}</td></tr>)}</tbody></table></div> : <div className="empty-state">Nenhum pagamento registrado ainda.</div>}</section>
    <section className="panel security-panel" data-tutorial-anchor="security"><div className="panel-heading"><div><h2>Segurança</h2><p>A senha temporária não expira. Altere-a quando quiser.</p></div></div><PasswordChangeForm /></section>
  </AppShell>;
}
