import { PlanPeriod } from "@prisma/client";

export const periodMonths: Record<PlanPeriod, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMIANNUAL: 6,
  ANNUAL: 12,
};

export function planTotalCents(monthlyPriceCents: number, period: PlanPeriod) {
  return monthlyPriceCents * periodMonths[period];
}

export function subscriptionChargeCents(monthlyPriceCents: number, period: PlanPeriod, manualMonthlyBilling = false) {
  return manualMonthlyBilling ? monthlyPriceCents : planTotalCents(monthlyPriceCents, period);
}

export function subscriptionCycleMonths(period: PlanPeriod, manualMonthlyBilling = false) {
  return manualMonthlyBilling ? 1 : periodMonths[period];
}

export function planPaymentDescription(monthlyPriceCents: number, period: PlanPeriod) {
  const months = periodMonths[period];
  return { months, totalCents: planTotalCents(monthlyPriceCents, period) };
}

export const asaasFrequencyForPeriod: Record<PlanPeriod, "MONTHLY" | "QUARTERLY" | "SEMIANNUALLY" | "ANNUALLY"> = {
  MONTHLY: "MONTHLY",
  QUARTERLY: "QUARTERLY",
  SEMIANNUAL: "SEMIANNUALLY",
  ANNUAL: "ANNUALLY",
};
