import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { CheckoutPayment } from "@/components/checkout-payment";
import { PasswordChangeForm } from "@/components/password-change-form";
import { requireRole } from "@/lib/auth";
import { formatCurrency, formatDate, paymentLabel, paymentMethodLabel, subscriptionLabel } from "@/lib/format";
import { getPaymentCheckoutConfig } from "@/lib/payment-gateway";
import { prisma } from "@/lib/prisma";

export default async function StudentPage() {
  const user = await requireRole(UserRole.STUDENT);
  const account = await prisma.user.findUnique({
    where: { id: user.id },
    include: { subscription: true, payments: { orderBy: { createdAt: "desc" }, take: 6 } },
  });
  const subscription = account?.subscription;
  const gateway = await getPaymentCheckoutConfig();

  if (!subscription || subscription.status !== "ACTIVE") {
    return <AppShell user={user} current="student"><header className="page-heading"><div><p className="eyebrow">Acesso pendente</p><h1>Finalize seu pagamento.</h1><p>A área do aluno será liberada depois que o pagamento for confirmado.</p></div></header><section className="panel checkout-message"><h2>Seu cadastro está reservado.</h2><p>Use o link de pagamento enviado pela assessoria para concluir sua inscrição.</p></section><section className="panel security-panel"><div className="panel-heading"><div><h2>Segurança</h2><p>A senha temporária não expira. Altere-a quando quiser.</p></div></div><PasswordChangeForm /></section></AppShell>;
  }

  return (
    <AppShell user={user} current="student">
      <header className="page-heading">
        <div><p className="eyebrow">Área do aluno</p><h1>Olá, {user.name.split(" ")[0]}.</h1><p>Veja sua assinatura e escolha como pagar.</p></div>
      </header>

      <section className="subscription-card">
        <div><p className="eyebrow">Minha assinatura</p><h2>{subscription?.planName ?? "Assinatura ainda não configurada"}</h2></div>
        <div className="subscription-meta">
          <div><small>Status</small><strong>{subscriptionLabel(subscription?.status ?? "INCOMPLETE")}</strong></div>
          <div><small>Próxima cobrança</small><strong>{formatDate(subscription?.nextBillingAt)}</strong></div>
          <div><small>Valor mensal</small><strong>{subscription ? formatCurrency(subscription.priceCents) : "—"}</strong></div>
        </div>
      </section>

      <section className="panel student-payment-panel">
        <CheckoutPayment
          name={account?.name ?? user.name}
          cpf={account?.cpf ?? ""}
          amountCents={subscription.priceCents}
          gatewayEnabled={gateway.enabled}
          activeProvider={gateway.activeProvider}
          appmaxExternalId={gateway.appmaxExternalId}
          recurrenceEnabled={gateway.recurrenceEnabled}
          allowedMethods={subscription.allowedMethods}
          embedded
        />
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panel-heading"><div><h2>Histórico de pagamentos</h2><p>Seus últimos lançamentos.</p></div></div>
        {account?.payments.length ? <div className="table-scroll"><table className="payments-table"><thead><tr><th>Data</th><th>Método</th><th>Status</th><th>Valor</th></tr></thead><tbody>{account.payments.map((payment) => <tr key={payment.id}><td>{formatDate(payment.createdAt)}</td><td>{paymentMethodLabel(payment.method)}</td><td><span className={`pill ${payment.status === "PAID" ? "" : "pill-coral"}`}>{paymentLabel(payment.status)}</span></td><td>{formatCurrency(payment.amountCents)}</td></tr>)}</tbody></table></div> : <div className="empty-state">Nenhum pagamento registrado ainda.</div>}
      </section>
      <section className="panel security-panel"><div className="panel-heading"><div><h2>Segurança</h2><p>A senha temporária não expira. Altere-a quando quiser.</p></div></div><PasswordChangeForm /></section>
    </AppShell>
  );
}
