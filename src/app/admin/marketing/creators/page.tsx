import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { InfluencersManager } from "@/components/influencers-manager";
import { MarketingMonthPicker } from "@/components/marketing-month-picker";
import { PageHeader } from "@/components/ui/page-header";
import { requireFeature } from "@/lib/auth";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { activeDiscountPercent, commissionRule, currentMonthKey, getMarketingSettings, monthName, parseMonthKey, ruleSummary, shiftMonth, syncStoreCouponSales, totalsByInfluencer, totalsOf } from "@/lib/influencers";
import { prisma } from "@/lib/prisma";

const numberFormat = new Intl.NumberFormat("pt-BR");

export default async function CreatorsPage({ searchParams }: { searchParams: Promise<{ month?: string; aluno?: string }> }) {
  const user = await requireFeature("marketing");
  const params = await searchParams;
  const current = currentMonthKey();
  const month = parseMonthKey(params.month) && params.month! <= current ? params.month! : current;
  await syncStoreCouponSales();
  const [influencers, totals, previous, payouts, settings, students] = await Promise.all([
    prisma.influencer.findMany({ include: { user: { select: { name: true, role: true } } } }),
    totalsByInfluencer(month),
    totalsByInfluencer(shiftMonth(month, -1)),
    prisma.influencerPayout.findMany({ where: { month }, select: { influencerId: true, status: true } }),
    getMarketingSettings(),
    prisma.user.findMany({ where: { role: UserRole.STUDENT, active: true, influencer: null }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
  ]);
  const payoutBy = new Map(payouts.map((payout) => [payout.influencerId, payout.status]));
  const rows = influencers.map((influencer) => {
    const mine = totalsOf(totals, influencer.id);
    const discount = activeDiscountPercent(influencer);
    const rule = commissionRule(influencer, settings);
    return {
      id: influencer.id,
      name: influencer.user.name,
      isStudent: influencer.user.role === UserRole.STUDENT,
      type: influencer.type,
      couponCode: influencer.couponCode,
      rule: ruleSummary(rule),
      customRule: rule.custom,
      discount: discount ? `${discount}%${influencer.discountUntil ? ` até ${formatShortDate(influencer.discountUntil)}` : ""}` : null,
      active: influencer.active,
      ...mine,
      salesDelta: mine.sales - totalsOf(previous, influencer.id).sales,
      payout: payoutBy.get(influencer.id) ?? null,
    };
  }).sort((a, b) => Number(b.active) - Number(a.active) || b.sales - a.sales || b.amountCents - a.amountCents || a.name.localeCompare(b.name, "pt-BR"));
  const sum = rows.reduce((acc, row) => ({ sales: acc.sales + row.sales, amountCents: acc.amountCents + row.amountCents, commissionCents: acc.commissionCents + row.commissionCents }), { sales: 0, amountCents: 0, commissionCents: 0 });
  const previousSales = [...previous.values()].reduce((total, item) => total + item.sales, 0);

  return <AppShell user={user} current="marketing">
    <PageHeader context={{ label: "Marketing" }} title="Experts & Creators." lead="Cupons, vendas e comissões de quem indica a Pace Lab. Plano conta no 1º pagamento do indicado; loja, em cada pedido pago com o cupom." actions={<MarketingMonthPicker value={month} max={current} />} />
    <div className="metric-strip" data-count={4}>
      <div className="metric"><span className="metric-label">No programa</span><strong className="metric-value">{numberFormat.format(rows.filter((row) => row.active).length)}</strong><span className="metric-note">{rows.filter((row) => row.type === "EXPERT" && row.active).length} experts · {rows.filter((row) => row.type === "CREATOR" && row.active).length} creators</span></div>
      <div className="metric"><span className="metric-label">Vendas com cupom</span><strong className="metric-value">{numberFormat.format(sum.sales)}</strong><span className="metric-note">{monthName(month)} · {previousSales} no mês anterior</span></div>
      <div className="metric"><span className="metric-label">Valor vendido</span><strong className="metric-value">{formatCurrency(sum.amountCents)}</strong><span className="metric-note">planos e loja</span></div>
      <div className="metric"><span className="metric-label">Comissão do mês</span><strong className="metric-value">{formatCurrency(sum.commissionCents)}</strong><span className="metric-note">{month < current ? "mês encerrado" : "ainda pode mudar"}</span></div>
    </div>
    <InfluencersManager rows={rows} students={students} showCommission={settings.showCommission} monthClosed={month < current} initialStudentId={params.aluno ?? null} program={{ plan: settings.planCommissionEnabled, store: settings.storeCommissionEnabled, percent: settings.defaultCommissionBps / 100 }} />
  </AppShell>;
}
