import Link from "next/link";
import { Brand } from "@/components/brand";
import { PasswordResetRequestForm } from "@/components/password-reset-request-form";

export default function PasswordResetRequestPage() {
  return <main className="login-page"><div className="login-layout"><section className="login-identity"><Brand /><div><p className="eyebrow">Pace Lab</p><h1>Volte para o treino.</h1><p>Vamos ajudar você a recuperar o acesso com segurança.</p></div><small>PACE LAB · ACADEMIA DO CORREDOR</small></section><section className="login-card"><p className="eyebrow">Recuperar acesso</p><h1>Redefina sua senha.</h1><p>Informe seu e-mail para receber um link seguro.</p><PasswordResetRequestForm /><p className="login-helper"><Link href="/login">Voltar para o login</Link></p></section></div></main>;
}
