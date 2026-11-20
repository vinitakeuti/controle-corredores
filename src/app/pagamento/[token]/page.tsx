import Link from "next/link";
import { notFound } from "next/navigation";
import { PaymentLinkStatus, UserRole } from "@prisma/client";
import { Brand } from "@/components/brand";
import { CheckoutAccessForm } from "@/components/checkout-access-form";
import { CheckoutPayment } from "@/components/checkout-payment";
import { StudentSubscriptionFlow } from "@/components/student-subscription-flow";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth";
import { getPaymentCheckoutConfig } from "@/lib/payment-gateway";
import { getPlansForStudent } from "@/lib/plans";
import { firstPaymentDiscount } from "@/lib/influencers";
import { prisma } from "@/lib/prisma";
import { hashOpaqueToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export default async function PaymentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await prisma.paymentLink.findUnique({ where: { tokenHash: hashOpaqueToken(token) }, include: { plan: { include: { service: true } }, user: { include: { subscription: { include: { plan: { select: { isHidden: true } } } } } } } });
  if (!link || link.status === PaymentLinkStatus.REVOKED) notFound();

  const currentUser = await getCurrentUser();
  const isLinkedUser = Boolean(currentUser && link.userId === currentUser.id);
  const isForeignUser = Boolean(currentUser && !isLinkedUser);
  const gateway = await getPaymentCheckoutConfig();
  const subscription = link.user?.subscription;
  const plans = await getPlansForStudent(subscription?.planId);
  // Link com plano escolhido pela equipe (oculto ou cortesia) e ainda sem aluno.
  const linkPlan = !link.userId ? link.plan : null;
  const conditionClosed = Boolean(!link.userId && link.planId && (!link.plan?.active || !link.plan.service.active));
  const courtesyActive = Boolean(subscription?.isCourtesy);
  const specialCondition = Boolean(subscription?.plan?.isHidden);
  const discount = isLinkedUser && link.userId ? await firstPaymentDiscount(link.userId) : null;
  const registerLead = linkPlan?.isCourtesy ? `Você recebeu uma cortesia da Pace Lab (${link.planName}). Preencha seus dados para ativá-la.` : linkPlan?.isHidden ? `Sua condição especial (${link.planName}) já está reservada neste link. Preencha seus dados para continuar.` : "Preencha seus dados para continuar e escolha seu plano antes do pagamento.";

  return (
    <main className="checkout" id="conteudo">
      <header className="checkout-bar brand-surface">
        <Brand className="shell-wordmark" href="/" label="Pace Lab, página inicial" size={72} />
        <span className="checkout-secure"><Icon name="check" className="icon-sm" />Ambiente seguro</span>
      </header>
      <div className="checkout-body">
        {link.status === PaymentLinkStatus.COMPLETED || (isLinkedUser && courtesyActive) ? <section className="checkout-done">
          <PageHeader context={{ label: courtesyActive ? "Cortesia ativa" : "Pagamento confirmado" }} title={courtesyActive ? "Sua cortesia está ativa." : "Sua assinatura está ativa."} lead={courtesyActive ? "Não há pagamento a fazer. Entre na área do aluno para continuar." : "Você já pode acessar a área do aluno."} />
          <Link className="btn btn-primary" href="/aluno">Acessar área do aluno<Icon name="arrowRight" /></Link>
        </section> : isForeignUser ? <PageHeader context={{ label: "Link individual" }} title="Este link pertence a outro acesso." lead="Abra o link usando a conta que foi cadastrada para este pagamento." /> : conditionClosed ? <PageHeader context={{ label: "Condição encerrada" }} title="Este link não está mais disponível." lead="A condição deste link foi encerrada. Fale com a equipe da Pace Lab para receber um novo link." /> : !link.userId ? <>
          <PageHeader context={{ label: linkPlan?.isCourtesy ? "Cortesia" : linkPlan?.isHidden ? "Condição especial" : "Primeiro acesso" }} title="Crie seu acesso." lead={registerLead} />
          <CheckoutAccessForm token={token} mode="register" />
        </> : !currentUser ? <>
          <PageHeader context={{ label: "Pagamento reservado" }} title="Entre para continuar." lead="Use o e-mail e a senha enviados pela assessoria." />
          <CheckoutAccessForm token={token} mode="login" initialEmail={link.user?.email ?? ""} />
        </> : isLinkedUser && currentUser.role === UserRole.STUDENT ? <>{plans.length ? <StudentSubscriptionFlow token={token} plans={plans} initialPlanId={subscription?.planId ?? null} name={link.user?.name ?? currentUser.name} cpf={link.user?.cpf ?? ""} gatewayEnabled={gateway.enabled} activeProvider={gateway.activeProvider} appmaxExternalId={gateway.appmaxExternalId} recurrenceEnabled={gateway.recurrenceEnabled} allowedMethods={subscription?.allowedMethods ?? link.allowedMethods} automaticPixEnabled={subscription?.automaticPixEnabled} customPriceCents={subscription?.hasCustomPrice ? subscription.priceCents : null} manualMonthlyBilling={subscription?.manualMonthlyBilling} lockPlan={Boolean(subscription?.planId) && (specialCondition || Boolean(subscription?.hasCustomPrice) || Boolean(subscription?.manualMonthlyBilling))} specialCondition={specialCondition} coupon={discount ? { code: discount.couponCode, percent: discount.percent } : null} /> : link.user?.subscription?.planId ? <CheckoutPayment token={token} name={link.user?.name ?? currentUser.name} cpf={link.user?.cpf ?? ""} amountCents={link.amountCents} gatewayEnabled={gateway.enabled} activeProvider={gateway.activeProvider} appmaxExternalId={gateway.appmaxExternalId} recurrenceEnabled={gateway.recurrenceEnabled} allowedMethods={link.user?.subscription?.allowedMethods ?? link.allowedMethods} automaticPixEnabled={link.user?.subscription?.automaticPixEnabled} /> : <PageHeader context={{ label: "Planos indisponíveis" }} title="Estamos preparando os planos." lead="Aguarde a assessoria publicar as opções para continuar." />}</> : <PageHeader context={{ label: "Acesso restrito" }} title="Não foi possível abrir este checkout." lead="Use a conta do aluno vinculada ao link." />}
      </div>
      <p className="checkout-foot">Ambiente seguro para cadastro e pagamento.</p>
    </main>
  );
}
