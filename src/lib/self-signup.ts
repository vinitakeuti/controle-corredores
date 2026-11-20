import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { formatCurrency } from "@/lib/format";
import { setReferral } from "@/lib/influencers";
import { periodMonths, planTotalCents } from "@/lib/plan-billing";
import { planDisplayName, planPeriodLabel, subscriptionTermsForPlan, type PlanWithService } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { validateNewStudent, type NewStudentData } from "@/lib/student-account";

// Cadastro feito pela própria pessoa (QR de evento e link de indicação): ela
// escolhe o plano, cria a senha e entra direto para pagar.

export type SelfSignupCheck = { ok: true; data: NewStudentData; password: string } | { ok: false; error: string; status: number };

export async function validateSelfSignup(input: Record<string, unknown>): Promise<SelfSignupCheck> {
  const validation = validateNewStudent(input);
  if (!validation.ok) return { ok: false, error: validation.error, status: 400 };
  const password = typeof input.password === "string" ? input.password : "";
  if (password.length < 8 || password.length > 128) return { ok: false, error: "A senha deve ter pelo menos 8 caracteres", status: 400 };
  const [emailTaken, cpfTaken] = await Promise.all([
    prisma.user.findUnique({ where: { email: validation.data.email }, select: { id: true } }),
    prisma.user.findUnique({ where: { cpf: validation.data.cpf }, select: { id: true } }),
  ]);
  if (emailTaken) return { ok: false, error: "Já existe uma conta com este e-mail. Entre com sua senha na área do aluno.", status: 409 };
  if (cpfTaken) return { ok: false, error: "Já existe uma conta com este CPF. Entre com sua senha na área do aluno.", status: 409 };
  return { ok: true, data: validation.data, password };
}

// A indicação é uma só, gravada no aluno: link e cupom do mesmo influenciador nunca viram duas vendas.
export async function createSelfSignupStudent(input: { data: NewStudentData; password: string; plan: PlanWithService; saleOwnerId: string | null; salesCardId?: string | null; influencerId?: string | null }) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  const { data } = input;
  const student = await prisma.$transaction(async (transaction) => {
    const created = await transaction.user.create({ data: { name: data.name, email: data.email, phone: data.phone, cpf: data.cpf, birthDate: data.birthDate, passwordHash, role: UserRole.STUDENT, saleOwnerId: input.saleOwnerId, salesCardId: input.salesCardId ?? null, passwordIsTemporary: false, liabilityTermRequiredAt: new Date() } });
    await transaction.subscription.create({ data: { userId: created.id, ...subscriptionTermsForPlan(input.plan) } });
    return created;
  });
  if (input.influencerId) await setReferral({ studentId: student.id, influencerId: input.influencerId, by: "student" });
  return student;
}

// Opções de plano para o formulário de cadastro próprio.
export function signupPlanOptions(plans: PlanWithService[]) {
  return plans.map((plan) => ({
    id: plan.id,
    title: planDisplayName(plan),
    price: plan.isCourtesy ? "Cortesia" : formatCurrency(plan.priceCents),
    per: plan.isCourtesy ? null : "por mês",
    detail: plan.isCourtesy ? "Sem cobrança" : periodMonths[plan.period] === 1 ? "Plano mensal" : `${planPeriodLabel[plan.period]}: ${formatCurrency(planTotalCents(plan.priceCents, plan.period))} no total`,
    isFeatured: plan.isFeatured && !plan.isHidden,
  }));
}
