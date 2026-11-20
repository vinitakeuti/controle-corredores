import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashOpaqueToken } from "@/lib/tokens";

export type FirstAccessState =
  | { kind: "ready"; tokenId: string; user: { id: string; name: string; email: string; role: UserRole } }
  | { kind: "already-active" }
  | { kind: "invalid" };

// Primeiro acesso pelo QR Code do pré-cadastro: só vale para aluno ativo que
// ainda está com a senha temporária, dentro do prazo e uma única vez.
export async function findFirstAccess(token: string): Promise<FirstAccessState> {
  if (!token || token.length > 255) return { kind: "invalid" };
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashOpaqueToken(token) },
    select: { id: true, usedAt: true, expiresAt: true, user: { select: { id: true, name: true, email: true, role: true, active: true, passwordIsTemporary: true } } },
  });
  if (!record || record.usedAt || record.expiresAt <= new Date() || (record.user.role !== UserRole.STUDENT && record.user.role !== UserRole.PARTNER) || !record.user.active) return { kind: "invalid" };
  if (!record.user.passwordIsTemporary) return { kind: "already-active" };
  return { kind: "ready", tokenId: record.id, user: { id: record.user.id, name: record.user.name, email: record.user.email, role: record.user.role } };
}
