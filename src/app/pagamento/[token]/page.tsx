import Link from "next/link";
import { notFound } from "next/navigation";
import { PaymentLinkStatus, UserRole } from "@prisma/client";
import { CheckoutAccessForm } from "@/components/checkout-access-form";
import { CheckoutPayment } from "@/components/checkout-payment";
import { StudentSubscriptionFlow } from "@/components/student-subscription-flow";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth";
import { getPaymentCheckoutConfig } from "@/lib/payment-gateway";
import { getActivePlans } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { hashOpaqueToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export default async function PaymentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await prisma.paymentLink.findUnique({ where: { tokenHash: hashOpaqueToken(token) }, include: { user: { include: { subscription: true } } } });
  if (!link || link.status === PaymentLinkStatus.REVOKED) notFound();

  const currentUser = await getCurrentUser();
  const isLinkedUser = Boolean(currentUser && link.userId === currentUser.id);
  const isForeignUser = Boolean(currentUser && !isLinkedUser);
  const gateway = await getPaymentCheckoutConfig();
  const plans = await getActivePlans();

  return (
    <main className="checkout" id="conteudo">
      <header className="checkout-bar brand-surface">
        <a className="shell-wordmark" href="/" aria-label="Pace Lab, página inicial"><img src="/assets/images/pace-lab.svg" alt="" width={72} height={72} /></a>
        <span className="checkout-secure"><Icon name="check" className="icon-sm" />Ambiente seguro</span>
      </header>
      <div className="checkout-body">
        {link.status === PaymentLinkStatus.COMPLETED ? <section className="checkout-done">
          <PageHeader context={{ label: "Pagamento confirmado" }} title="Sua assinatura está ativa." lead="Você já pode acessar a área do aluno." />
          <Link className="btn btn-primary" href="/aluno">Acessar área do aluno<Icon name="arrowRight" /></Link>
        </section> : isForeignUser ? <PageHeader context={{ label: "Link individual" }} title="Este link pertence a outro acesso." lead="Abra o link usando a conta que foi cadastrada para este pagamento." /> : !link.userId ? <>
          <PageHeader context={{ label: "Primeiro acesso" }} title="Crie seu acesso." lead="Preencha seus dados para continuar e escolha seu plano antes do pagamento." />
          <CheckoutAccessForm token={token} mode="register" />
        </> : !currentUser ? <>
          <PageHeader context={{ label: "Pagamento reservado" }} title="Entre para continuar." lead="Use o e-mail e a senha enviados pela assessoria." />
          <CheckoutAccessForm token={token} mode="login" initialEmail={link.user?.email ?? ""} />
        </> : isLinkedUser && currentUser.role === UserRole.STUDENT ? <>{plans.length ? <StudentSubscriptionFlow token={token} plans={plans} initialPlanId={link.user?.subscription?.planId ?? null} name={link.user?.name ?? currentUser.name} cpf={link.user?.cpf ?? ""} gatewayEnabled={gateway.enabled} activeProvider={gateway.activeProvider} appmaxExternalId={gateway.appmaxExternalId} recurrenceEnabled={gateway.recurrenceEnabled} allowedMethods={link.user?.subscription?.allowedMethods ?? link.allowedMethods} automaticPixEnabled={link.user?.subscription?.automaticPixEnabled} /> : link.user?.subscription?.planId ? <CheckoutPayment token={token} name={link.user?.name ?? currentUser.name} cpf={link.user?.cpf ?? ""} amountCents={link.amountCents} gatewayEnabled={gateway.enabled} activeProvider={gateway.activeProvider} appmaxExternalId={gateway.appmaxExternalId} recurrenceEnabled={gateway.recurrenceEnabled} allowedMethods={link.user?.subscription?.allowedMethods ?? link.allowedMethods} automaticPixEnabled={link.user?.subscription?.automaticPixEnabled} /> : <PageHeader context={{ label: "Planos indisponíveis" }} title="Estamos preparando os planos." lead="Aguarde a assessoria publicar as opções para continuar." />}</> : <PageHeader context={{ label: "Acesso restrito" }} title="Não foi possível abrir este checkout." lead="Use a conta do aluno vinculada ao link." />}
      </div>
      <p className="checkout-foot">Ambiente seguro para cadastro e pagamento.</p>
    </main>
  );
}
