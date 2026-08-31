import { PlanPeriod, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const PLAN_PERIODS = ["MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL"] as const satisfies readonly PlanPeriod[];

export const planPeriodLabel: Record<PlanPeriod, string> = {
  MONTHLY: "Mensal",
  QUARTERLY: "Trimestral",
  SEMIANNUAL: "Semestral",
  ANNUAL: "Anual",
};

export type PlanWithService = Prisma.PlanGetPayload<{ include: { service: true } }>;

export function planDisplayName(plan: Pick<PlanWithService, "period" | "service">) {
  return `${plan.service.name} · ${planPeriodLabel[plan.period]}`;
}

export async function getActivePlans() {
  return prisma.plan.findMany({
    where: { active: true, service: { active: true } },
    include: { service: true },
    orderBy: [{ service: { name: "asc" } }, { priceCents: "asc" }],
  });
}

export function parsePlanPeriod(value: unknown) {
  return typeof value === "string" && PLAN_PERIODS.includes(value as PlanPeriod) ? value as PlanPeriod : null;
}
