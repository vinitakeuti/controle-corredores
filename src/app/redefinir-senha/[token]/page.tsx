import Link from "next/link";
import { UserRole } from "@prisma/client";
import { Brand } from "@/components/brand";
import { PasswordResetConfirmForm } from "@/components/password-reset-confirm-form";
import { prisma } from "@/lib/prisma";
import { hashOpaqueToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "corredor";
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)![0] : "")).toUpperCase() || "PL";
}

// Quem recebe o link reconhece a própria conta sem expor o e-mail completo.
function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.length <= 2 ? `${local[0]}•••` : `${local.slice(0, 2)}•••${local.slice(-1)}`;
  return `${visible}@${domain}`;
}

async function findResetAccount(token: string) {
  if (!token || token.length > 255) return null;
  const reset = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashOpaqueToken(token) }, select: { usedAt: true, expiresAt: true, user: { select: { name: true, email: true, role: true } } } });
  if (!reset || reset.usedAt || reset.expiresAt <= new Date()) return null;
  return reset.user;
}

export default async function PasswordResetConfirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const account = await findResetAccount(token);
  const identity = <section className="login-identity"><Brand /><div><p className="eyebrow">Pace Lab</p><h1>Seu próximo treino começa aqui.</h1><p>Escolha uma nova senha e retome sua jornada.</p></div><small>PACE LAB · ACADEMIA DO CORREDOR</small></section>;

  if (!account) {
    return <main className="login-page"><div className="login-layout">{identity}<section className="login-card"><p className="eyebrow">Link indisponível</p><h1>Este link não vale mais.</h1><p>Ele expirou ou já foi utilizado. Peça um novo link à equipe Pace Lab ou solicite outro pelo seu e-mail.</p><Link className="button button-primary reset-unavailable-action" href="/recuperar-senha">Solicitar novo link</Link><p className="login-helper"><Link href="/login">Voltar para o login</Link></p></section></div></main>;
  }

  return <main className="login-page"><div className="login-layout">{identity}<section className="login-card"><p className="eyebrow">Nova senha</p><h1>Olá, {firstName(account.name)}.</h1><p>Defina uma nova senha para acessar sua conta. Use pelo menos oito caracteres.</p><div className="reset-account" aria-label="Conta que terá a senha redefinida"><span className="reset-account-avatar" aria-hidden="true">{initials(account.name)}</span><div><small>{account.role === UserRole.STUDENT ? "Sua conta de aluno" : "Sua conta da equipe"}</small><strong>{account.name}</strong><span>{maskEmail(account.email)}</span></div></div><PasswordResetConfirmForm token={token} email={account.email} /><p className="login-helper">Não é você? <Link href="/login">Voltar para o login</Link></p></section></div></main>;
}
