import { PlanPeriod, Prisma, SubscriptionStatus } from "@prisma/client";
import { planTotalCents } from "@/lib/plan-billing";
import { prisma } from "@/lib/prisma";

export const PLAN_PERIODS = ["MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL"] as const satisfies readonly PlanPeriod[];

export const planPeriodLabel: Record<PlanPeriod, string> = {
  MONTHLY: "Mensal",
  QUARTERLY: "Trimestral",
  SEMIANNUAL: "Semestral",
  ANNUAL: "Anual",
};

export type PlanWithService = Prisma.PlanGetPayload<{ include: { service: true } }>;

type NamedPlan = Pick<PlanWithService, "period"> & { name?: string | null; isCourtesy?: boolean; service: { name: string } };

// Público: "Corrida · Mensal". Oculto: "Corrida · Parceria X · Mensal".
// Cortesia não tem cobrança, então o período não entra no nome.
export function planDisplayName(plan: NamedPlan) {
  if (!plan.name) return `${plan.service.name} · ${planPeriodLabel[plan.period]}`;
  return plan.isCourtesy ? `${plan.service.name} · ${plan.name}` : `${plan.service.name} · ${plan.name} · ${planPeriodLabel[plan.period]}`;
}

const activePlan = { active: true, service: { active: true } } satisfies Prisma.PlanWhereInput;
const planOrder = [{ service: { name: "asc" } }, { isHidden: "asc" }, { priceCents: "asc" }] satisfies Prisma.PlanOrderByWithRelationInput[];

// Planos que alunos e leads podem ver e contratar sozinhos.
export async function getPublicPlans() {
  return prisma.plan.findMany({ where: { ...activePlan, isHidden: false }, include: { service: true }, orderBy: planOrder });
}

// Planos que a equipe pode aplicar: os públicos e os ocultos.
export async function getStaffPlans() {
  return prisma.plan.findMany({ where: activePlan, include: { service: true }, orderBy: planOrder });
}

// O que o aluno vê: os planos públicos e, se a equipe deu a ele um plano
// oculto, também esse (só ele, nunca os ocultos de outros alunos).
export async function getPlansForStudent(currentPlanId: string | null | undefined) {
  const plans = await getPublicPlans();
  if (!currentPlanId || plans.some((plan) => plan.id === currentPlanId)) return plans;
  const own = await prisma.plan.findFirst({ where: { ...activePlan, id: currentPlanId, isHidden: true }, include: { service: true } });
  return own ? [...plans, own] : plans;
}

// Plano que a equipe pode aplicar a um aluno ou colocar num link.
export async function findStaffPlan(planId: string) {
  return planId ? prisma.plan.findFirst({ where: { ...activePlan, id: planId }, include: { service: true } }) : null;
}

// Assinatura de quem entra por um plano escolhido pela equipe. Cortesia já
// nasce ativa e isenta; os demais aguardam o primeiro pagamento.
export function subscriptionTermsForPlan(plan: PlanWithService) {
  const base = { planId: plan.id, planName: planDisplayName(plan), billingPeriod: plan.period, allowedMethods: plan.allowedMethods, hasCustomPrice: false, manualMonthlyBilling: false };
  return plan.isCourtesy
    ? { ...base, priceCents: 0, isCourtesy: true, automaticPixEnabled: false, status: SubscriptionStatus.ACTIVE, nextBillingAt: null }
    : { ...base, priceCents: plan.priceCents, isCourtesy: false, automaticPixEnabled: plan.automaticPixEnabled, status: SubscriptionStatus.INCOMPLETE };
}

// Dados do link de cadastro que já leva um plano.
export function paymentLinkTermsForPlan(plan: PlanWithService) {
  return { planId: plan.id, planName: planDisplayName(plan), amountCents: plan.isCourtesy ? 0 : planTotalCents(plan.priceCents, plan.period), allowedMethods: plan.allowedMethods };
}

export function parsePlanPeriod(value: unknown) {
  return typeof value === "string" && PLAN_PERIODS.includes(value as PlanPeriod) ? value as PlanPeriod : null;
}

export function parsePlanName(value: unknown) {
  const name = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  return name.length >= 2 && name.length <= 60 ? name : null;
}
