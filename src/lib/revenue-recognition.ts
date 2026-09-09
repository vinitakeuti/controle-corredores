import { PlanPeriod } from "@prisma/client";
import { subscriptionCycleMonths } from "@/lib/plan-billing";

type SubscriptionCycle = { billingPeriod: PlanPeriod; manualMonthlyBilling: boolean } | null | undefined;
type ContractPayment = { amountCents: number; paidAt: Date | null; subscription?: SubscriptionCycle };

function addMonths(date: Date, count: number) {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + count);
  result.setDate(Math.min(day, new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate()));
  return result;
}

function allocationForMonth(totalCents: number, monthCount: number, monthIndex: number) {
  const base = Math.floor(totalCents / monthCount);
  return base + (monthIndex < totalCents % monthCount ? 1 : 0);
}

export function monthlyEquivalentCents(payment: ContractPayment) {
  if (!payment.subscription) return 0;
  const months = subscriptionCycleMonths(payment.subscription.billingPeriod, payment.subscription.manualMonthlyBilling);
  return allocationForMonth(payment.amountCents, months, 0);
}

/**
 * Recognizes a paid contract evenly through the plan cycle. A R$ 1.800 annual
 * payment therefore contributes R$ 150 to each covered month, while the cash
 * receipt itself remains available separately through Payment.amountCents.
 */
export function recognizedRevenueCents(payments: ContractPayment[], from: Date, to: Date) {
  return payments.reduce((total, payment) => {
    if (!payment.paidAt || !payment.subscription) return total;
    const months = subscriptionCycleMonths(payment.subscription.billingPeriod, payment.subscription.manualMonthlyBilling);
    let recognized = 0;
    for (let index = 0; index < months; index += 1) {
      const sliceStart = addMonths(payment.paidAt, index);
      const sliceEnd = addMonths(payment.paidAt, index + 1);
      if (sliceStart <= to && sliceEnd > from) recognized += allocationForMonth(payment.amountCents, months, index);
    }
    return total + recognized;
  }, 0);
}
