import Link from "next/link";
import { notFound } from "next/navigation";
import { PaymentLinkStatus, UserRole } from "@prisma/client";
import { Brand } from "@/components/brand";
import { CheckoutAccessForm } from "@/components/checkout-access-form";
import { CheckoutPayment } from "@/components/checkout-payment";
import { getAppmaxCheckoutConfig } from "@/lib/appmax";
import { getCurrentUser } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
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
  const appmax = await getAppmaxCheckoutConfig();

  return (
    <main className="checkout-page">
      <div className="checkout-shell">
        <Brand href="/" />
        <div className="checkout-frame">
          {link.status === PaymentLinkStatus.COMPLETED ? <div className="checkout-success"><p className="eyebrow">Pagamento confirmado</p><h1>Sua assinatura está ativa.</h1><p>Você já pode acessar a área do aluno.</p><Link className="button button-primary" href="/aluno">Acessar área do aluno</Link></div> : isForeignUser ? <div className="checkout-message"><p className="eyebrow">Link individual</p><h1>Este link pertence a outro acesso.</h1><p>Abra o link usando a conta que foi cadastrada para este pagamento.</p></div> : !link.userId ? <><div className="checkout-intro"><p className="eyebrow">Primeiro acesso</p><h1>Crie seu acesso.</h1><p>Preencha seus dados para continuar para o pagamento de {formatCurrency(link.amountCents)} por mês.</p></div><CheckoutAccessForm token={token} mode="register" /></> : !currentUser ? <><div className="checkout-intro"><p className="eyebrow">Pagamento reservado</p><h1>Entre para continuar.</h1><p>Use o e-mail e a senha enviados pela assessoria.</p></div><CheckoutAccessForm token={token} mode="login" initialEmail={link.user?.email ?? ""} /></> : isLinkedUser && currentUser.role === UserRole.STUDENT ? <CheckoutPayment token={token} name={link.user?.name ?? currentUser.name} cpf={link.user?.cpf ?? ""} amountCents={link.amountCents} gatewayEnabled={appmax.enabled} appmaxExternalId={appmax.externalId} recurrenceEnabled={appmax.recurrenceEnabled} /> : <div className="checkout-message"><p className="eyebrow">Acesso restrito</p><h1>Não foi possível abrir este checkout.</h1><p>Use a conta do aluno vinculada ao link.</p></div>}
        </div>
        <p className="checkout-footer">Ambiente seguro para cadastro e pagamento.</p>
      </div>
    </main>
  );
}
