import { PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const DEFAULT_BILLING_PRICE_CENTS = 15_000;
export const DEFAULT_ALLOWED_METHODS = [PaymentMethod.PIX, PaymentMethod.CARD, PaymentMethod.BOLETO] as const;

export function parseAmountCents(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 10_000_000
    ? value
    : null;
}

export function parseAllowedMethods(value: unknown) {
  if (!Array.isArray(value)) return null;
  const methods = [...new Set(value.filter((item): item is PaymentMethod => item === "PIX" || item === "CARD" || item === "BOLETO"))];
  return methods.length === value.length && methods.length > 0 ? methods : null;
}

export async function getBillingSettings() {
  const stored = await prisma.billingSettings.findUnique({ where: { id: "platform" } });
  return stored ?? {
    id: "platform",
    basePriceCents: DEFAULT_BILLING_PRICE_CENTS,
    defaultAllowedMethods: [...DEFAULT_ALLOWED_METHODS],
  };
}
