import Link from "next/link";
import { UserRole } from "@prisma/client";
import { Brand } from "@/components/brand";
import { SelfSignupForm } from "@/components/self-signup-form";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth";
import { formatShortDate } from "@/lib/format";
import { activeDiscountPercent, findActiveInfluencerByCoupon, influencerTypeLabel, shortName } from "@/lib/influencers";
import { getPublicPlans } from "@/lib/plans";
import { signupPlanOptions } from "@/lib/self-signup";

export const dynamic = "force-dynamic";

// Link de indicação de um Expert/Creator: cadastro com o cupom já aplicado.
export default async function ReferralSignupPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const influencer = await findActiveInfluencerByCoupon(code);
  const [currentUser, plans] = influencer ? await Promise.all([getCurrentUser(), getPublicPlans()]) : [null, []];
  const discount = influencer ? activeDiscountPercent(influencer) : 0;

  return (
    <main className="checkout" id="conteudo">
      <header className="checkout-bar brand-surface">
        <Brand className="shell-wordmark" href="/" label="Pace Lab, página inicial" size={72} />
        <span className="checkout-secure"><Icon name="check" className="icon-sm" />Ambiente seguro</span>
      </header>
      <div className="checkout-body">
        {!influencer ? <PageHeader context={{ label: "Link de indicação" }} title="Este link não está mais ativo." lead="Fale com quem te indicou ou com a equipe da Pace Lab." />
          : currentUser?.role === UserRole.STUDENT ? <section className="checkout-done">
            <PageHeader context={{ label: "Você já tem conta" }} title="Você já está conectado." lead="Sua assinatura fica na área do aluno." />
            <Link className="btn btn-primary" href="/aluno">Acessar área do aluno<Icon name="arrowRight" /></Link>
          </section>
          : currentUser ? <PageHeader context={{ label: "Link de indicação" }} title="Você já está conectado." lead="Para se cadastrar por este link, abra-o no celular de quem vai treinar ou numa janela anônima." />
          : !plans.length ? <PageHeader context={{ label: "Planos indisponíveis" }} title="Estamos preparando os planos." lead="Tente de novo em instantes ou fale com a equipe da Pace Lab." />
          : <>
            <PageHeader context={{ label: `Indicação de ${shortName(influencer.user.name)} · ${influencerTypeLabel[influencer.type]}` }} title="Crie seu acesso." lead="Escolha seu plano, preencha seus dados e siga para o pagamento." />
            <p className="message referral-coupon" data-tone="positive" role="status"><Icon name="ticket" /><span>Cupom <strong>{influencer.couponCode}</strong> aplicado.{discount ? ` Você ganha ${discount}% de desconto no primeiro pagamento${influencer.discountUntil ? ` (até ${formatShortDate(influencer.discountUntil)})` : ""}.` : ""}</span></p>
            <SelfSignupForm endpoint={`/api/checkout/referral/${encodeURIComponent(influencer.couponCode)}`} plans={signupPlanOptions(plans)} lockedCoupon={influencer.couponCode} />
          </>}
      </div>
      <p className="checkout-foot">Ambiente seguro para cadastro e pagamento.</p>
    </main>
  );
}
