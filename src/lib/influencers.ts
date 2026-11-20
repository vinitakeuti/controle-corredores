import { InfluencerSaleSource, InfluencerSaleStatus, InfluencerType, PaymentStatus, Prisma } from "@prisma/client";
import { maceioDateParts, maceioDayStart } from "@/lib/format";
import { subscriptionChargeCents } from "@/lib/plan-billing";
import { portalUrl } from "@/lib/portal";
import { prisma } from "@/lib/prisma";
import { STORE_URL } from "@/lib/store-url";

// Programa Experts & Creators. Regras:
// - cada influenciador tem um cupom fixo; quem usa o cupom fica "indicado" por ele;
// - plano: só o 1º pagamento confirmado do indicado gera comissão;
// - loja: cada pedido pago com o cupom gera comissão;
// - desconto é opcional (por influenciador, com prazo) e vale no 1º pagamento do plano e na loja;
// - comissão é organizada pelo mês da venda (calendário de Maceió).

export const influencerTypeLabel: Record<InfluencerType, string> = { EXPERT: "Expert", CREATOR: "Creator" };
export const MAX_DISCOUNT_PERCENT = 50;
export const MAX_COMMISSION_BPS = 5000;

type Db = Prisma.TransactionClient | typeof prisma;

// ---------- cupom, comissão e desconto ----------

export function normalizeCouponCode(value: unknown) {
  const code = typeof value === "string" ? value.trim().toUpperCase().replace(/\s+/g, "") : "";
  return /^[A-Z0-9]{3,20}$/.test(code) ? code : null;
}

export function commissionFor(amountCents: number, bps: number) {
  return Math.round((amountCents * bps) / 10_000);
}

export function formatPercentFromBps(bps: number) {
  const value = bps / 100;
  return `${Number.isInteger(value) ? value : value.toFixed(1).replace(".", ",")}%`;
}

export function activeDiscountPercent(influencer: { discountPercent: number; discountUntil: Date | null; active: boolean }, now = new Date()) {
  if (!influencer.active || influencer.discountPercent <= 0) return 0;
  if (influencer.discountUntil && influencer.discountUntil <= now) return 0;
  return Math.min(influencer.discountPercent, MAX_DISCOUNT_PERCENT);
}

export function discountedCents(amountCents: number, percent: number) {
  return amountCents - Math.round((amountCents * percent) / 100);
}

export async function findActiveInfluencerByCoupon(code: string, db: Db = prisma) {
  const couponCode = normalizeCouponCode(code);
  if (!couponCode) return null;
  return db.influencer.findFirst({ where: { couponCode, active: true }, include: { user: { select: { id: true, name: true, email: true, active: true } } } });
}

// ---------- meses (calendário de Maceió) ----------

export function monthKey(date: Date) {
  const { year, month } = maceioDateParts(date);
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function currentMonthKey() {
  return monthKey(new Date());
}

export function parseMonthKey(value: unknown) {
  const match = typeof value === "string" ? value.match(/^(\d{4})-(\d{2})$/) : null;
  if (!match) return null;
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? `${match[1]}-${match[2]}` : null;
}

export function monthBounds(key: string) {
  const [year, month] = key.split("-").map(Number);
  return { from: maceioDayStart(year, month, 1), to: maceioDayStart(year, month + 1, 1) };
}

export function shiftMonth(key: string, delta: number) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthName(key: string, withYear = true) {
  const [year, month] = key.split("-").map(Number);
  const name = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 15)));
  return withYear ? `${name} de ${year}` : name;
}

// ---------- configurações ----------

export async function getMarketingSettings(db: Db = prisma) {
  return (await db.marketingSettings.findUnique({ where: { id: "platform" } })) ?? { id: "platform", showCommission: false, planCommissionEnabled: true, storeCommissionEnabled: true, defaultCommissionBps: 1000, storeSyncedAt: null as Date | null, updatedById: null as string | null };
}

// ---------- regras de comissão (programa e individual) ----------

type ProgramRules = { planCommissionEnabled: boolean; storeCommissionEnabled: boolean; defaultCommissionBps: number };
type OwnRules = { commissionBps: number | null; planCommission: boolean | null; storeCommission: boolean | null };

// Cada item do influenciador vale por si: vazio segue o padrão do programa.
export function commissionRule(influencer: OwnRules, program: ProgramRules) {
  return {
    plan: influencer.planCommission ?? program.planCommissionEnabled,
    store: influencer.storeCommission ?? program.storeCommissionEnabled,
    bps: influencer.commissionBps ?? program.defaultCommissionBps,
    custom: influencer.planCommission !== null || influencer.storeCommission !== null || influencer.commissionBps !== null,
  };
}

export type CommissionRule = ReturnType<typeof commissionRule>;

export function ruleSummary(rule: Pick<CommissionRule, "plan" | "store" | "bps">) {
  if ((!rule.plan && !rule.store) || rule.bps === 0) return "sem comissão";
  const where = rule.plan && rule.store ? "no plano e na loja" : rule.plan ? "só no plano" : "só na loja";
  return `${formatPercentFromBps(rule.bps)} ${where}`;
}

// Percentual aplicado a uma venda do canal; 0 quando o canal não tem comissão.
export function saleBps(rule: CommissionRule, source: InfluencerSaleSource) {
  return (source === InfluencerSaleSource.PLAN ? rule.plan : rule.store) ? rule.bps : 0;
}

// ---------- vendas de plano (1º pagamento do indicado) ----------

// Garante a venda do 1º pagamento de um aluno indicado. Idempotente: pode ser
// chamada a cada pagamento confirmado ou quando a equipe define a indicação.
export async function ensurePlanSale(db: Db, studentId: string) {
  const student = await db.user.findUnique({ where: { id: studentId }, select: { id: true, name: true, referredBy: { select: { id: true, userId: true, commissionBps: true, planCommission: true, storeCommission: true, active: true } } } });
  const influencer = student?.referredBy;
  if (!student || !influencer || !influencer.active || influencer.userId === student.id) return null;
  const existing = await db.influencerSale.findFirst({ where: { source: InfluencerSaleSource.PLAN, studentId }, select: { id: true } });
  if (existing) return null;
  // O 1º pagamento é o mais antigo que chegou a ser pago (mesmo que depois estornado).
  const first = await db.payment.findFirst({
    where: { userId: studentId, status: { in: [PaymentStatus.PAID, PaymentStatus.REFUNDED] }, paidAt: { not: null } },
    orderBy: { paidAt: "asc" },
    include: { subscription: { select: { planName: true, priceCents: true, billingPeriod: true, manualMonthlyBilling: true } } },
  });
  if (!first || first.status !== PaymentStatus.PAID) return null;
  // Regra em vigor no momento da venda (fica gravada nela).
  const bps = saleBps(commissionRule(influencer, await getMarketingSettings(db)), InfluencerSaleSource.PLAN);
  const fullCents = first.subscription ? subscriptionChargeCents(first.subscription.priceCents, first.subscription.billingPeriod, first.subscription.manualMonthlyBilling) : first.amountCents;
  return db.influencerSale.create({
    data: {
      influencerId: influencer.id,
      source: InfluencerSaleSource.PLAN,
      externalId: first.id,
      reference: `AS-${first.id.slice(-6).toUpperCase()}`,
      description: first.subscription?.planName ?? "Plano da assessoria",
      customerName: student.name,
      studentId,
      amountCents: first.amountCents,
      discountCents: Math.max(0, fullCents - first.amountCents),
      commissionBps: bps,
      commissionCents: commissionFor(first.amountCents, bps),
      occurredAt: first.paidAt ?? new Date(),
    },
  });
}

// Chamado nas confirmações de pagamento (Asaas, Appmax e Pix Automático).
export async function onPaymentPaid(db: Db, paymentId: string) {
  const payment = await db.payment.findUnique({ where: { id: paymentId }, select: { userId: true } });
  if (payment) await ensurePlanSale(db, payment.userId);
}

// Estorno do 1º pagamento: a venda deixa de contar.
export async function onPaymentRefunded(db: Db, paymentId: string) {
  await db.influencerSale.updateMany({ where: { source: InfluencerSaleSource.PLAN, externalId: paymentId }, data: { status: InfluencerSaleStatus.CANCELED } });
}

export async function hasPaidBefore(db: Db, userId: string) {
  return (await db.payment.count({ where: { userId, status: { in: [PaymentStatus.PAID, PaymentStatus.REFUNDED] } } })) > 0;
}

// Desconto do cupom no 1º pagamento do plano, se o influenciador tiver um ativo.
export async function firstPaymentDiscount(userId: string, db: Db = prisma) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { referredBy: { select: { couponCode: true, discountPercent: true, discountUntil: true, active: true } } } });
  const influencer = user?.referredBy;
  if (!influencer) return null;
  const percent = activeDiscountPercent(influencer);
  if (!percent || await hasPaidBefore(db, userId)) return null;
  return { couponCode: influencer.couponCode, percent };
}

export class ReferralError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

// Vincula um aluno a um influenciador. Pelo aluno: só antes do 1º pagamento.
// Pela equipe: a qualquer momento, desde que o repasse do mês da venda não esteja aprovado.
export async function setReferral(input: { studentId: string; influencerId: string | null; by: "student" | "staff" }) {
  return prisma.$transaction(async (transaction) => {
    const student = await transaction.user.findUnique({ where: { id: input.studentId }, select: { id: true, referredByInfluencerId: true } });
    if (!student) throw new ReferralError("Aluno não encontrado.", 404);
    if (input.by === "student") {
      if (student.referredByInfluencerId) throw new ReferralError("Você já usou um cupom.", 409);
      if (await hasPaidBefore(transaction, student.id)) throw new ReferralError("O cupom vale só para a primeira assinatura.", 409);
    }
    if (input.influencerId) {
      const influencer = await transaction.influencer.findUnique({ where: { id: input.influencerId }, select: { userId: true, active: true } });
      if (!influencer || !influencer.active) throw new ReferralError("Cupom inválido.", 404);
      if (influencer.userId === student.id) throw new ReferralError("Não é possível usar o próprio cupom.", 400);
    }
    if (student.referredByInfluencerId === input.influencerId) return;
    const sale = await transaction.influencerSale.findFirst({ where: { source: InfluencerSaleSource.PLAN, studentId: student.id } });
    if (sale) {
      const payout = await transaction.influencerPayout.findUnique({ where: { influencerId_month: { influencerId: sale.influencerId, month: monthKey(sale.occurredAt) } }, select: { id: true } });
      if (payout) throw new ReferralError("O repasse do mês desta venda já foi aprovado. Desfaça a aprovação para trocar a indicação.", 409);
      await transaction.influencerSale.delete({ where: { id: sale.id } });
    }
    await transaction.user.update({ where: { id: student.id }, data: { referredByInfluencerId: input.influencerId, referredAt: input.influencerId ? new Date() : null } });
    if (input.influencerId) await ensurePlanSale(transaction, student.id);
  });
}

// ---------- loja (pedidos com cupom) ----------

type StoreCouponOrder = { id: string; publicCode: string; influencerId: string; totalCents: number; discountCents: number; status: "CONFIRMED" | "CANCELED" | "PENDING"; paidAt: string | null; items: string; customerName: string };

function storeCouponOrdersUrl() {
  const base = process.env.STORE_FINANCE_SUMMARY_URL;
  if (!base) return null;
  try { return new URL("/api/internal/coupon-orders", base); } catch { return null; }
}

function isStoreOrder(value: unknown): value is StoreCouponOrder {
  if (!value || typeof value !== "object") return false;
  const order = value as Record<string, unknown>;
  return typeof order.id === "string" && typeof order.publicCode === "string" && typeof order.influencerId === "string"
    && Number.isInteger(order.totalCents) && Number.isInteger(order.discountCents)
    && (order.status === "CONFIRMED" || order.status === "CANCELED" || order.status === "PENDING")
    && (order.paidAt === null || typeof order.paidAt === "string") && typeof order.items === "string" && typeof order.customerName === "string";
}

// Busca na loja os pedidos com cupom alterados desde a última vez. Roda ao abrir
// o painel ou o portal, no máximo uma vez por minuto (a não ser que force).
export async function syncStoreCouponSales({ force = false } = {}) {
  const url = storeCouponOrdersUrl();
  const secret = process.env.STORE_AUTH_SHARED_SECRET;
  if (!url || !secret) return { synced: false as const, reason: "not-configured" };
  const settings = await getMarketingSettings();
  const startedAt = new Date();
  if (!force && settings.storeSyncedAt && startedAt.getTime() - settings.storeSyncedAt.getTime() < 60_000) return { synced: false as const, reason: "recent" };
  // Volta um dia para não perder pedidos alterados durante a última sincronização.
  const since = settings.storeSyncedAt ? new Date(settings.storeSyncedAt.getTime() - 24 * 60 * 60 * 1000) : new Date(0);
  url.searchParams.set("updatedSince", since.toISOString());
  try {
    const response = await fetch(url, { cache: "no-store", headers: { "x-store-auth-secret": secret }, signal: AbortSignal.timeout(5_000) });
    if (!response.ok) return { synced: false as const, reason: `http-${response.status}` };
    const payload = await response.json() as { orders?: unknown };
    const orders = Array.isArray(payload.orders) ? payload.orders.filter(isStoreOrder) : [];
    const influencers = new Map((await prisma.influencer.findMany({ where: { id: { in: [...new Set(orders.map((order) => order.influencerId))] } }, select: { id: true, commissionBps: true, planCommission: true, storeCommission: true } })).map((item) => [item.id, { id: item.id, bps: saleBps(commissionRule(item, settings), InfluencerSaleSource.STORE) }]));
    for (const order of orders) {
      const influencer = influencers.get(order.influencerId);
      if (!influencer) continue;
      if (order.status === "CONFIRMED") {
        await prisma.influencerSale.upsert({
          where: { source_externalId: { source: InfluencerSaleSource.STORE, externalId: order.id } },
          update: { status: InfluencerSaleStatus.CONFIRMED },
          create: {
            influencerId: influencer.id,
            source: InfluencerSaleSource.STORE,
            externalId: order.id,
            reference: order.publicCode,
            description: order.items.slice(0, 200) || "Pedido da loja",
            customerName: order.customerName.slice(0, 120),
            amountCents: order.totalCents,
            discountCents: order.discountCents,
            commissionBps: influencer.bps,
            commissionCents: commissionFor(order.totalCents, influencer.bps),
            occurredAt: order.paidAt ? new Date(order.paidAt) : new Date(),
          },
        });
      } else if (order.status === "CANCELED") {
        await prisma.influencerSale.updateMany({ where: { source: InfluencerSaleSource.STORE, externalId: order.id }, data: { status: InfluencerSaleStatus.CANCELED } });
      }
    }
    await prisma.marketingSettings.upsert({ where: { id: "platform" }, update: { storeSyncedAt: startedAt }, create: { id: "platform", storeSyncedAt: startedAt } });
    return { synced: true as const, orders: orders.length };
  } catch (error) {
    console.error("store coupon sync failed", error);
    return { synced: false as const, reason: "error" };
  }
}

// ---------- números ----------

export type MonthTotals = { sales: number; amountCents: number; commissionCents: number };
const emptyTotals = (): MonthTotals => ({ sales: 0, amountCents: 0, commissionCents: 0 });

// Vendas confirmadas por influenciador no mês.
export async function totalsByInfluencer(month: string) {
  const { from, to } = monthBounds(month);
  const rows = await prisma.influencerSale.groupBy({
    by: ["influencerId"],
    where: { status: InfluencerSaleStatus.CONFIRMED, occurredAt: { gte: from, lt: to } },
    _count: { _all: true },
    _sum: { amountCents: true, commissionCents: true },
  });
  return new Map(rows.map((row) => [row.influencerId, { sales: row._count._all, amountCents: row._sum.amountCents ?? 0, commissionCents: row._sum.commissionCents ?? 0 } satisfies MonthTotals]));
}

export function totalsOf(map: Map<string, MonthTotals>, influencerId: string) {
  return map.get(influencerId) ?? emptyTotals();
}

// Mês a mês de um influenciador, do mais recente para o mais antigo.
export async function monthlyTotals(influencerId: string, since: Date) {
  const sales = await prisma.influencerSale.findMany({ where: { influencerId, status: InfluencerSaleStatus.CONFIRMED }, select: { occurredAt: true, amountCents: true, commissionCents: true } });
  const months = new Map<string, MonthTotals>();
  let key = currentMonthKey();
  const first = monthKey(since);
  while (key >= first) { months.set(key, emptyTotals()); key = shiftMonth(key, -1); }
  for (const sale of sales) {
    const bucket = months.get(monthKey(sale.occurredAt)) ?? emptyTotals();
    bucket.sales += 1; bucket.amountCents += sale.amountCents; bucket.commissionCents += sale.commissionCents;
    months.set(monthKey(sale.occurredAt), bucket);
  }
  return [...months.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([month, totals]) => ({ month, ...totals }));
}

export function shortName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? "—";
  return `${parts[0]} ${parts.at(-1)![0].toUpperCase()}.`;
}

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)![0] : "")).toUpperCase() || "PL";
}

// Ranking do mês: 1 venda com o cupom = 1 ponto. Empate divide a posição.
export async function monthRanking(month: string) {
  const [influencers, totals] = await Promise.all([
    prisma.influencer.findMany({ where: { active: true }, select: { id: true, type: true, user: { select: { name: true } } } }),
    totalsByInfluencer(month),
  ]);
  const rows = influencers
    .map((influencer) => ({ influencerId: influencer.id, type: influencer.type, name: shortName(influencer.user.name), initials: initialsOf(influencer.user.name), points: totalsOf(totals, influencer.id).sales }))
    .filter((row) => row.points > 0)
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, "pt-BR"));
  let position = 0;
  return rows.map((row, index) => {
    if (index === 0 || rows[index - 1].points !== row.points) position = index + 1;
    return { ...row, position };
  });
}

export function maskPixKey(hint: string | null) {
  return hint ? `••••${hint}` : null;
}

// ---------- validação do cadastro do influenciador (painel da equipe) ----------

export type InfluencerInput = { type?: InfluencerType; couponCode?: string; commissionBps?: number | null; planCommission?: boolean | null; storeCommission?: boolean | null; discountPercent?: number; discountUntil?: Date | null; active?: boolean };

// Percentual digitado (ex.: 7,5) em pontos-base; vazio/null = segue o programa.
export function parseCommissionPercent(value: unknown): { ok: true; bps: number | null } | { ok: false; error: string } {
  if (value === null || value === undefined || value === "") return { ok: true, bps: null };
  const percent = typeof value === "number" ? value : Number.NaN;
  const bps = Math.round(percent * 100);
  if (!Number.isFinite(percent) || bps < 0 || bps > MAX_COMMISSION_BPS) return { ok: false, error: `A comissão deve ficar entre 0% e ${MAX_COMMISSION_BPS / 100}%.` };
  return { ok: true, bps };
}

function parseOptionalBoolean(value: unknown) {
  return value === true || value === false ? value : value === null || value === undefined ? null : undefined;
}

export function parseInfluencerInput(body: Record<string, unknown>, partial: boolean): { ok: true; data: InfluencerInput } | { ok: false; error: string } {
  const data: InfluencerInput = {};
  if (!partial || body.type !== undefined) {
    if (body.type !== "EXPERT" && body.type !== "CREATOR") return { ok: false, error: "Escolha entre Expert e Creator." };
    data.type = body.type;
  }
  if (!partial || body.couponCode !== undefined) {
    const code = normalizeCouponCode(body.couponCode);
    if (!code) return { ok: false, error: "O cupom deve ter de 3 a 20 letras ou números, sem espaços." };
    data.couponCode = code;
  }
  // Regras individuais: cada uma pode seguir o programa (null) ou ter valor próprio.
  if (!partial || body.commissionPercent !== undefined) {
    const parsed = parseCommissionPercent(body.commissionPercent);
    if (!parsed.ok) return parsed;
    data.commissionBps = parsed.bps;
  }
  for (const key of ["planCommission", "storeCommission"] as const) {
    if (!partial || body[key] !== undefined) {
      const value = parseOptionalBoolean(body[key]);
      if (value === undefined) return { ok: false, error: "Regra de comissão inválida." };
      data[key] = value;
    }
  }
  if (!partial || body.discountPercent !== undefined) {
    const percent = body.discountPercent === undefined || body.discountPercent === null ? 0 : body.discountPercent;
    if (typeof percent !== "number" || !Number.isInteger(percent) || percent < 0 || percent > MAX_DISCOUNT_PERCENT) return { ok: false, error: `O desconto deve ser um número inteiro entre 0% e ${MAX_DISCOUNT_PERCENT}%.` };
    data.discountPercent = percent;
  }
  if (!partial || body.discountUntil !== undefined) {
    if (body.discountUntil === null || body.discountUntil === undefined || body.discountUntil === "") data.discountUntil = null;
    else {
      const until = typeof body.discountUntil === "string" ? new Date(body.discountUntil) : null;
      if (!until || Number.isNaN(until.getTime())) return { ok: false, error: "Data final do desconto inválida." };
      data.discountUntil = until;
    }
  }
  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") return { ok: false, error: "Situação inválida." };
    data.active = body.active;
  }
  return { ok: true, data };
}

// Cupom digitado num cadastro: vazio é "sem cupom"; preenchido precisa existir.
export async function resolveSignupCoupon(raw: unknown): Promise<{ ok: true; influencerId: string | null } | { ok: false; error: string }> {
  if (typeof raw !== "string" || !raw.trim()) return { ok: true, influencerId: null };
  const influencer = await findActiveInfluencerByCoupon(raw);
  return influencer ? { ok: true, influencerId: influencer.id } : { ok: false, error: "Cupom não encontrado. Confira o código ou deixe o campo em branco." };
}

// Links do influenciador: os dois só preenchem o cupom. A venda continua sendo
// atribuída uma vez (no aluno ou no pedido), então link + cupom nunca contam em dobro.
export function influencerLinks(couponCode: string) {
  return {
    signup: portalUrl("STUDENT", `/indicacao/${encodeURIComponent(couponCode)}`),
    store: `${STORE_URL}/?cupom=${encodeURIComponent(couponCode)}`,
  };
}
