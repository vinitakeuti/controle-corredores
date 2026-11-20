import { Prisma } from "@prisma/client";
import { portalUrl } from "@/lib/portal";
import { prisma } from "@/lib/prisma";

// Prazo máximo de um cartão: o QR fica exposto em evento e pode circular depois.
export const SALES_CARD_MAX_DAYS = 30;
const MAX_PLANS = 20;

export type SalesCardStatus = "active" | "expired" | "closed";

export function salesCardStatus(card: { expiresAt: Date; closedAt: Date | null }, now = new Date()): SalesCardStatus {
  if (card.expiresAt > now) return "active";
  return card.closedAt ? "closed" : "expired";
}

export function salesCardUrl(code: string) {
  return portalUrl("STUDENT", `/cadastro/${code}`);
}

const activePlan = { active: true, service: { active: true } } satisfies Prisma.PlanWhereInput;

type CardInput = { name?: string; expiresAt?: Date; planIds?: string[] };

// Valida nome, prazo e planos. Em edição, só o que veio no corpo.
export async function parseSalesCardInput(body: Record<string, unknown>, partial: boolean): Promise<{ ok: true; data: CardInput } | { ok: false; error: string }> {
  const data: CardInput = {};
  if (!partial || body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
    if (name.length < 2 || name.length > 80) return { ok: false, error: "Dê um nome ao cartão (de 2 a 80 caracteres), como o nome do evento." };
    data.name = name;
  }
  if (!partial || body.expiresAt !== undefined) {
    const expiresAt = typeof body.expiresAt === "string" ? new Date(body.expiresAt) : null;
    const now = Date.now();
    if (!expiresAt || Number.isNaN(expiresAt.getTime())) return { ok: false, error: "Informe até quando o QR Code vale." };
    if (expiresAt.getTime() <= now + 60_000) return { ok: false, error: "A validade precisa ser no futuro." };
    if (expiresAt.getTime() > now + SALES_CARD_MAX_DAYS * 24 * 60 * 60 * 1000) return { ok: false, error: `A validade pode ser de no máximo ${SALES_CARD_MAX_DAYS} dias.` };
    data.expiresAt = expiresAt;
  }
  if (!partial || body.planIds !== undefined) {
    const planIds = Array.isArray(body.planIds) ? [...new Set(body.planIds.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 100))] : [];
    if (!planIds.length || planIds.length > MAX_PLANS || planIds.length !== (Array.isArray(body.planIds) ? body.planIds.length : 0)) return { ok: false, error: "Escolha pelo menos um plano para o cartão." };
    const found = await prisma.plan.count({ where: { ...activePlan, id: { in: planIds } } });
    if (found !== planIds.length) return { ok: false, error: "Algum plano escolhido não está mais disponível. Atualize a página." };
    data.planIds = planIds;
  }
  return { ok: true, data };
}

// Cartão aberto ao público pelo código do QR, com os planos que ainda estão ativos.
export async function findSalesCardByCode(code: string) {
  if (!code || code.length > 100) return null;
  return prisma.salesCard.findUnique({
    where: { code },
    include: { plans: { where: activePlan, include: { service: true }, orderBy: [{ service: { name: "asc" } }, { isHidden: "asc" }, { priceCents: "asc" }] } },
  });
}
