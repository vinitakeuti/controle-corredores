import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { Brand } from "@/components/brand";
import { SelfSignupForm } from "@/components/self-signup-form";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth";
import { findSalesCardByCode, salesCardStatus } from "@/lib/sales-cards";
import { signupPlanOptions } from "@/lib/self-signup";

export const dynamic = "force-dynamic";

// Aberto pelo QR de evento (cartão de venda). Depois do prazo não mostra
// mais os planos, para o QR não servir a quem o recebeu depois do evento.
export default async function SalesCardSignupPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const card = await findSalesCardByCode(code);
  if (!card) notFound();
  const open = salesCardStatus(card) === "active" && card.plans.length > 0;
  const currentUser = open ? await getCurrentUser() : null;
  const onlyCourtesy = card.plans.every((plan) => plan.isCourtesy);
  const plans = signupPlanOptions(card.plans);

  return (
    <main className="checkout" id="conteudo">
      <header className="checkout-bar brand-surface">
        <Brand className="shell-wordmark" href="/" label="Pace Lab, página inicial" size={72} />
        <span className="checkout-secure"><Icon name="check" className="icon-sm" />Ambiente seguro</span>
      </header>
      <div className="checkout-body">
        {!open ? <PageHeader context={{ label: "QR Code encerrado" }} title="As inscrições por este QR Code terminaram." lead="Fale com a equipe da Pace Lab para se inscrever." />
          : currentUser?.role === UserRole.STUDENT ? <section className="checkout-done">
            <PageHeader context={{ label: "Você já tem conta" }} title="Você já está conectado." lead="Sua assinatura fica na área do aluno." />
            <Link className="btn btn-primary" href="/aluno">Acessar área do aluno<Icon name="arrowRight" /></Link>
          </section>
          : currentUser ? <PageHeader context={{ label: "Acesso da equipe" }} title="Você está conectado como equipe." lead="Para se cadastrar por este QR Code, abra-o no celular do aluno ou numa janela anônima." />
          : <>
            <PageHeader context={{ label: card.name }} title="Crie seu acesso." lead={onlyCourtesy ? "Escolha seu plano e preencha seus dados para ativar sua cortesia." : "Escolha seu plano, preencha seus dados e siga para o pagamento."} />
            <SelfSignupForm endpoint={`/api/checkout/cards/${encodeURIComponent(code)}`} plans={plans} />
          </>}
      </div>
      <p className="checkout-foot">Ambiente seguro para cadastro e pagamento.</p>
    </main>
  );
}
