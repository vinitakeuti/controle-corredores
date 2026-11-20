import Link from "next/link";
import { UserRole } from "@prisma/client";
import { AuthHeading, AuthLayout } from "@/components/auth-layout";
import { FirstAccessForm } from "@/components/first-access-form";
import { firstName, initials, maskEmail } from "@/lib/account-display";
import { findFirstAccess } from "@/lib/first-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Aberto pelo QR Code do pré-cadastro: o aluno só cria a senha e segue para pagar.
export default async function FirstAccessPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const access = await findFirstAccess(token);
  const brandTitle = "Seu próximo treino começa aqui.";
  const brandLead = "Crie sua senha e conclua sua entrada na Pace Lab.";

  if (access.kind !== "ready") {
    return <AuthLayout brandTitle={brandTitle} brandLead={brandLead}>
      {access.kind === "already-active"
        ? <AuthHeading context="Conta ativa" title="Você já criou sua senha." lead="Entre com seu e-mail e a senha que você criou." />
        : <AuthHeading context="QR Code indisponível" title="Este QR Code não vale mais." lead="Ele expirou ou já foi usado. Entre com o e-mail e a senha temporária enviados pela equipe, ou peça um novo acesso." />}
      <Link className="btn btn-primary btn-block" href="/login">Ir para o login</Link>
    </AuthLayout>;
  }

  const subscription = await prisma.subscription.findUnique({ where: { userId: access.user.id }, select: { isCourtesy: true, planId: true, planName: true } });
  const lead = access.user.role === UserRole.PARTNER
    ? "Crie sua senha para entrar no programa Experts & Creators da Pace Lab."
    : subscription?.isCourtesy
    ? "Sua cortesia já está ativa. Crie sua senha para entrar."
    : subscription?.planId
      ? `Crie sua senha e, em seguida, conclua o pagamento de ${subscription.planName}.`
      : "Crie sua senha e, em seguida, escolha seu plano e a forma de pagamento.";

  return <AuthLayout brandTitle={brandTitle} brandLead={brandLead}>
    <AuthHeading context="Primeiro acesso" title={`Olá, ${firstName(access.user.name)}.`} lead={lead} />
    <div className="reset-identity" aria-label="Sua conta">
      <span className="avatar reset-identity-avatar" aria-hidden="true">{initials(access.user.name)}</span>
      <div className="activity-copy"><span className="reset-identity-kind">{access.user.role === UserRole.PARTNER ? "Sua conta do programa" : "Sua conta de aluno"}</span><strong>{access.user.name}</strong><span>{maskEmail(access.user.email)}</span></div>
    </div>
    <FirstAccessForm token={token} email={access.user.email} />
    <p className="auth-helper">Não é você? <Link className="link" href="/login">Ir para o login</Link></p>
  </AuthLayout>;
}
