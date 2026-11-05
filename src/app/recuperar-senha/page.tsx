import Link from "next/link";
import { AuthHeading, AuthLayout } from "@/components/auth-layout";
import { PasswordResetRequestForm } from "@/components/password-reset-request-form";

export default function PasswordResetRequestPage() {
  return <AuthLayout brandTitle="Volte para o treino." brandLead="Vamos ajudar você a recuperar o acesso com segurança.">
    <AuthHeading context="Recuperar acesso" title="Redefina sua senha." lead="Informe seu e-mail para receber um link seguro." />
    <PasswordResetRequestForm />
    <p className="auth-helper"><Link className="link" href="/login">Voltar para o login</Link></p>
  </AuthLayout>;
}
