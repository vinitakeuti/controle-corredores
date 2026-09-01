import Link from "next/link";
import { Brand } from "@/components/brand";
import { PasswordResetConfirmForm } from "@/components/password-reset-confirm-form";

export default async function PasswordResetConfirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <main className="login-page"><div className="login-layout"><section className="login-identity"><Brand /><div><p className="eyebrow">Pace Lab</p><h1>Seu próximo treino começa aqui.</h1><p>Escolha uma nova senha e retome sua jornada.</p></div><small>PACE LAB · ACADEMIA DO CORREDOR</small></section><section className="login-card"><p className="eyebrow">Nova senha</p><h1>Proteja seu acesso.</h1><p>Use pelo menos oito caracteres.</p><PasswordResetConfirmForm token={token} /><p className="login-helper"><Link href="/login">Voltar para o login</Link></p></section></div></main>;
}
