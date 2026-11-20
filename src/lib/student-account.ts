import bcrypt from "bcryptjs";
import { PaymentLinkStatus, SubscriptionStatus, UserRole } from "@prisma/client";
import { paymentLinkTermsForPlan, subscriptionTermsForPlan, type PlanWithService } from "@/lib/plans";
import { portalUrl } from "@/lib/portal";
import { prisma } from "@/lib/prisma";
import { isValidCpf, isValidPhone, normalizeCpf, normalizePhone, parseBirthDate } from "@/lib/student-input";
import { createOpaqueToken, generateTemporaryPassword, hashOpaqueToken } from "@/lib/tokens";

export type NewStudentData = { name: string; email: string; phone: string; cpf: string; birthDate: Date | null };
type Validation = { ok: true; data: NewStudentData } | { ok: false; error: string };

// Mesmas regras do cadastro manual (tela Alunos) e do assistente.
export function validateNewStudent(body: Record<string, unknown>): Validation {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : null;
  const cpf = typeof body.cpf === "string" ? normalizeCpf(body.cpf) : null;
  const birthDate = typeof body.birthDate === "string" ? parseBirthDate(body.birthDate) : null;

  if (name.length < 2 || name.length > 120) return { ok: false, error: "Informe um nome válido" };
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return { ok: false, error: "Informe um e-mail válido" };
  if (!phone || !isValidPhone(phone)) return { ok: false, error: "Informe um telefone válido" };
  if (!cpf || !isValidCpf(cpf)) return { ok: false, error: "Informe um CPF válido" };
  if (body.birthDate && !birthDate) return { ok: false, error: "Informe uma data de nascimento válida" };
  return { ok: true, data: { name, email, phone, cpf, birthDate } };
}

export async function findStudentConflict(data: Pick<NewStudentData, "email" | "cpf">) {
  const [existingEmail, existingCpf] = await Promise.all([
    prisma.user.findUnique({ where: { email: data.email }, select: { id: true } }),
    prisma.user.findUnique({ where: { cpf: data.cpf }, select: { id: true } }),
  ]);
  if (existingEmail) return "Já existe um usuário com este e-mail";
  if (existingCpf) return "Já existe um usuário com este CPF";
  return null;
}

// QR Code de primeiro acesso: vale o mesmo que um link de redefinição de senha
// gerado pela equipe, mas só existe no momento do cadastro.
export const FIRST_ACCESS_TTL_MS = 24 * 60 * 60 * 1000;

// Cria o aluno com senha temporária, assinatura pendente e link de pagamento.
// A senha e os links só existem nesta resposta: não ficam salvos em lugar nenhum.
// Com plano escolhido pela equipe, o aluno já entra nele; cortesia nasce ativa
// e o link fica concluído, servindo só de acesso. Com firstAccess, também sai
// um link de primeiro acesso (para o QR Code): o aluno cria a própria senha e entra.
export async function createStudentAccount(data: NewStudentData, createdById: string, plan: PlanWithService | null = null, options: { firstAccess?: boolean } = {}) {
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);
  const rawToken = createOpaqueToken();
  const firstAccessToken = options.firstAccess ? createOpaqueToken() : null;
  const student = await prisma.$transaction(async (transaction) => {
    const created = await transaction.user.create({
      data: { name: data.name, email: data.email, phone: data.phone, cpf: data.cpf, birthDate: data.birthDate, passwordHash, passwordIsTemporary: true, role: UserRole.STUDENT, saleOwnerId: createdById, liabilityTermRequiredAt: new Date() },
    });
    await transaction.subscription.create({ data: { userId: created.id, ...(plan ? subscriptionTermsForPlan(plan) : { status: SubscriptionStatus.INCOMPLETE }) } });
    await transaction.paymentLink.create({ data: { tokenHash: hashOpaqueToken(rawToken), userId: created.id, createdById, ...(plan ? paymentLinkTermsForPlan(plan) : {}), ...(plan?.isCourtesy ? { status: PaymentLinkStatus.COMPLETED, completedAt: new Date() } : {}) } });
    if (firstAccessToken) await transaction.passwordResetToken.create({ data: { tokenHash: hashOpaqueToken(firstAccessToken), userId: created.id, expiresAt: new Date(Date.now() + FIRST_ACCESS_TTL_MS) } });
    return created;
  });
  return { studentId: student.id, name: student.name, email: student.email, temporaryPassword, paymentUrl: portalUrl("STUDENT", `/pagamento/${rawToken}`), firstAccessUrl: firstAccessToken ? portalUrl("STUDENT", `/primeiro-acesso/${firstAccessToken}`) : null, isCourtesy: Boolean(plan?.isCourtesy) };
}
