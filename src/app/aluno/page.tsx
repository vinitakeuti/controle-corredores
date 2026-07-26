import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { PixGenerator } from "@/components/pix-generator";
import { requireRole } from "@/lib/auth";
import { formatCurrency, formatDate, paymentLabel, subscriptionLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function StudentPage() {
  const user = await requireRole(UserRole.STUDENT);
  const account = await prisma.user.findUnique({
    where: { id: user.id },
    include: { subscription: true, payments: { orderBy: { createdAt: "desc" }, take: 6 } },
  });
  const subscription = account?.subscription;

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

      <section className="student-actions">
        <article className="panel action-card"><h3>Pagamento via PIX</h3><p>Gere um código PIX para quitar sua próxima mensalidade.</p><PixGenerator /></article>
        <article className="panel action-card"><h3>Cartão recorrente</h3><p>Em breve você poderá cadastrar um cartão para cobrança automática.</p><div className="card-placeholder"><span>Integração do gateway</span><span className="pill">Em breve</span></div></article>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panel-heading"><div><h2>Histórico de pagamentos</h2><p>Seus últimos lançamentos.</p></div></div>
        {account?.payments.length ? <div className="table-scroll"><table className="payments-table"><thead><tr><th>Data</th><th>Método</th><th>Status</th><th>Valor</th></tr></thead><tbody>{account.payments.map((payment) => <tr key={payment.id}><td>{formatDate(payment.createdAt)}</td><td>{payment.method === "PIX" ? "PIX" : "Cartão"}</td><td><span className={`pill ${payment.status === "PAID" ? "" : "pill-coral"}`}>{paymentLabel(payment.status)}</span></td><td>{formatCurrency(payment.amountCents)}</td></tr>)}</tbody></table></div> : <div className="empty-state">Nenhum pagamento registrado ainda.</div>}
      </section>
    </AppShell>
  );
}
