import Link from "next/link";
import { UserRole } from "@prisma/client";
import { AuthHeading, AuthLayout } from "@/components/auth-layout";
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
  const brandTitle = "Seu próximo treino começa aqui.";
  const brandLead = "Escolha uma nova senha e retome sua jornada.";

  if (!account) {
    return <AuthLayout brandTitle={brandTitle} brandLead={brandLead}>
      <AuthHeading context="Link indisponível" title="Este link não vale mais." lead="Ele expirou ou já foi utilizado. Peça um novo link à equipe Pace Lab ou solicite outro pelo seu e-mail." />
      <Link className="btn btn-primary btn-block" href="/recuperar-senha">Solicitar novo link</Link>
      <p className="auth-helper"><Link className="link" href="/login">Voltar para o login</Link></p>
    </AuthLayout>;
  }

  return <AuthLayout brandTitle={brandTitle} brandLead={brandLead}>
    <AuthHeading context="Nova senha" title={`Olá, ${firstName(account.name)}.`} lead="Defina uma nova senha para acessar sua conta. Use pelo menos oito caracteres." />
    <div className="reset-identity" aria-label="Conta que terá a senha redefinida">
      <span className="avatar reset-identity-avatar" aria-hidden="true">{initials(account.name)}</span>
      <div className="activity-copy"><span className="reset-identity-kind">{account.role === UserRole.STUDENT ? "Sua conta de aluno" : "Sua conta da equipe"}</span><strong>{account.name}</strong><span>{maskEmail(account.email)}</span></div>
    </div>
    <PasswordResetConfirmForm token={token} email={account.email} />
    <p className="auth-helper">Não é você? <Link className="link" href="/login">Voltar para o login</Link></p>
  </AuthLayout>;
}
