import Link from "next/link";
import { notFound } from "next/navigation";
import { InfluencerSaleStatus, UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { CopyValue, InfluencerDetailActions, PayoutActions } from "@/components/influencer-detail";
import { choiceOf } from "@/lib/influencer-draft";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { requireFeature } from "@/lib/auth";
import { formatCurrency, formatDate, maceioInputDate } from "@/lib/format";
import { activeDiscountPercent, commissionRule, currentMonthKey, getMarketingSettings, influencerLinks, influencerTypeLabel, monthlyTotals, monthName, ruleSummary, shiftMonth, syncStoreCouponSales } from "@/lib/influencers";
import { decryptSecret } from "@/lib/integration-crypto";
import { prisma } from "@/lib/prisma";

const pixTypeLabel: Record<string, string> = { CPF: "CPF", CNPJ: "CNPJ", EMAIL: "E-mail", PHONE: "Telefone", RANDOM: "Chave aleatória" };
const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Maceio" });

export default async function CreatorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireFeature("marketing");
  const { id } = await params;
  await syncStoreCouponSales();
  const influencer = await prisma.influencer.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, role: true } },
      payouts: true,
      sales: { orderBy: { occurredAt: "desc" }, take: 60 },
      _count: { select: { referrals: true } },
    },
  });
  if (!influencer) notFound();
  const current = currentMonthKey();
  const settings = await getMarketingSettings();
  const rule = commissionRule(influencer, settings);
  const links = influencerLinks(influencer.couponCode);
  const months = await monthlyTotals(influencer.id, new Date(Math.min(influencer.createdAt.getTime(), Date.now())));
  const payoutBy = new Map(influencer.payouts.map((payout) => [payout.month, payout]));
  const rows = months.slice(0, 12).map((row) => {
    const payout = payoutBy.get(row.month);
    return { ...row, label: monthName(row.month), closed: row.month < current, payout: payout ? { status: payout.status, amountCents: payout.amountCents, paidAt: payout.paidAt?.toISOString() ?? null } : null };
  });
  const thisMonth = rows.find((row) => row.month === current) ?? { sales: 0, amountCents: 0, commissionCents: 0 };
  const lastMonth = rows.find((row) => row.month === shiftMonth(current, -1)) ?? { sales: 0 };
  const allTime = months.reduce((acc, row) => ({ sales: acc.sales + row.sales, amountCents: acc.amountCents + row.amountCents, commissionCents: acc.commissionCents + row.commissionCents }), { sales: 0, amountCents: 0, commissionCents: 0 });
  const paidOut = influencer.payouts.filter((payout) => payout.status === "PAID").reduce((total, payout) => total + payout.amountCents, 0);
  const discount = activeDiscountPercent(influencer);
  let pixKey: string | null = null;
  try { pixKey = influencer.pixKeyEncrypted ? decryptSecret(influencer.pixKeyEncrypted) : null; } catch { pixKey = null; }
  const draft = {
    type: influencer.type,
    couponCode: influencer.couponCode,
    plan: choiceOf(influencer.planCommission),
    store: choiceOf(influencer.storeCommission),
    commissionPercent: influencer.commissionBps === null ? "" : String(influencer.commissionBps / 100),
    discountPercent: influencer.discountPercent ? String(influencer.discountPercent) : "",
    discountUntil: influencer.discountUntil ? maceioInputDate(influencer.discountUntil) : "",
  };

  return <AppShell user={user} current="marketing">
    <PageHeader context={{ label: "Experts & Creators", href: "/admin/marketing/creators", current: influencerTypeLabel[influencer.type] }} title={`${influencer.user.name}.`} lead={`${influencer.user.role === UserRole.STUDENT ? "Aluno" : "Parceiro"} · ${influencerTypeLabel[influencer.type]} · comissão ${ruleSummary(rule)} (${rule.custom ? "regra própria" : "segue o programa"})${discount ? ` · ${discount}% de desconto para quem usa o cupom` : ""}`} actions={<InfluencerDetailActions id={influencer.id} draft={draft} active={influencer.active} program={{ plan: settings.planCommissionEnabled, store: settings.storeCommissionEnabled, percent: settings.defaultCommissionBps / 100 }} />} />

    <div className="influencer-overview">
      <section className="coupon-card" aria-label="Cupom">
        <span className="coupon-card-label">Cupom</span>
        <strong className="coupon-card-code">{influencer.couponCode}</strong>
        <span className="coupon-card-note">{influencer.active ? `${influencer._count.referrals} ${influencer._count.referrals === 1 ? "aluno indicado" : "alunos indicados"}` : "Pausado: o cupom não funciona"}</span>
      </section>
      <dl className="summary-strip influencer-summary">
        <div><dt>Vendas em {monthName(current, false)}</dt><dd className="summary-figure">{thisMonth.sales}</dd><span className="cell-secondary">{thisMonth.sales - lastMonth.sales >= 0 ? "+" : ""}{thisMonth.sales - lastMonth.sales} vs. mês anterior</span></div>
        <div><dt>Valor vendido no mês</dt><dd className="summary-figure">{formatCurrency(thisMonth.amountCents)}</dd></div>
        <div><dt>Comissão no mês</dt><dd className="summary-figure">{formatCurrency(thisMonth.commissionCents)}</dd></div>
        <div><dt>Total desde o início</dt><dd className="summary-figure">{formatCurrency(allTime.amountCents)}</dd><span className="cell-secondary">{allTime.sales} vendas · {formatCurrency(paidOut)} já pagos</span></div>
      </dl>
    </div>

    <section className="section-block" aria-labelledby="influencer-months">
      <div className="section-head"><div><h2 className="section-title" id="influencer-months">Mês a mês</h2><p className="section-lead">Vendas pela data do pagamento. Feche o repasse de um mês encerrado aprovando o valor; depois marque como pago.</p></div></div>
      <div className="data-table-wrap">
        <table className="data-table months-table">
          <caption className="visually-hidden">Vendas e repasses por mês</caption>
          <thead><tr><th scope="col">Mês</th><th scope="col" className="num">Vendas</th><th scope="col" className="num">Valor vendido</th><th scope="col" className="num">Comissão</th><th scope="col">Repasse</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.month}>
            <td>{row.label}{row.month === current ? <span className="cell-secondary">até hoje</span> : null}</td>
            <td className="num">{row.sales}</td>
            <td className="num">{formatCurrency(row.amountCents)}</td>
            <td className="num">{formatCurrency(row.commissionCents)}</td>
            <td><PayoutActions id={influencer.id} row={row} /></td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>

    <section className="section-block" aria-labelledby="influencer-sales">
      <div className="section-head"><div><h2 className="section-title" id="influencer-sales">Vendas com o cupom</h2><p className="section-lead">As 60 mais recentes. O influenciador vê o pedido, a data, o que foi comprado e o valor, mas não quem comprou.</p></div></div>
      {influencer.sales.length ? <div className="data-table-wrap responsive-scroll">
        <table className="data-table influencer-sales-table">
          <caption className="visually-hidden">Vendas com o cupom {influencer.couponCode}</caption>
          <thead><tr><th scope="col">Pedido</th><th scope="col">Data</th><th scope="col">Origem</th><th scope="col">Cliente</th><th scope="col">O que foi comprado</th><th scope="col" className="num">Valor</th><th scope="col" className="num">Comissão</th><th scope="col">Situação</th></tr></thead>
          <tbody>{influencer.sales.map((sale) => <tr key={sale.id}>
            <td><code>{sale.reference}</code></td>
            <td>{dateTime.format(sale.occurredAt)}</td>
            <td>{sale.source === "PLAN" ? "Plano" : "Loja"}</td>
            <td>{sale.studentId ? <Link className="link" href={`/admin/alunos/${sale.studentId}`}>{sale.customerName}</Link> : sale.customerName ?? "—"}</td>
            <td className="sale-description">{sale.description}</td>
            <td className="num">{formatCurrency(sale.amountCents)}{sale.discountCents ? <span className="cell-secondary">−{formatCurrency(sale.discountCents)} de desconto</span> : null}</td>
            <td className="num">{sale.commissionBps ? formatCurrency(sale.commissionCents) : <span className="cell-secondary">Sem comissão</span>}</td>
            <td><StatusPill tone={sale.status === InfluencerSaleStatus.CONFIRMED ? "positive" : "neutral"}>{sale.status === InfluencerSaleStatus.CONFIRMED ? "Confirmada" : "Cancelada"}</StatusPill></td>
          </tr>)}</tbody>
        </table>
      </div> : <div className="state-empty"><p>Nenhuma venda com o cupom {influencer.couponCode} ainda.</p></div>}
    </section>

    <div className="profile-columns">
      <section className="section-block" aria-labelledby="influencer-pix">
        <div className="section-head"><div><h2 className="section-title" id="influencer-pix">Onde receber</h2><p className="section-lead">A chave Pix é cadastrada pelo influenciador no portal.</p></div></div>
        {pixKey ? <dl className="kv-list">
          <div><dt>{pixTypeLabel[influencer.pixKeyType ?? ""] ?? "Chave"}</dt><dd className="pix-key"><code>{pixKey}</code><CopyValue value={pixKey} label="Copiar chave Pix" /></dd></div>
          <div><dt>Cadastrada em</dt><dd>{formatDate(influencer.pixKeyUpdatedAt)}</dd></div>
        </dl> : <div className="state-empty"><p>Ainda sem chave Pix cadastrada.</p></div>}
      </section>
      <section className="section-block" aria-labelledby="influencer-contact">
        <div className="section-head"><div><h2 className="section-title" id="influencer-contact">Contato</h2><p className="section-lead">{influencer.user.role === UserRole.STUDENT ? "Também é aluno da Pace Lab." : "Acesso só ao portal do programa."}</p></div></div>
        <dl className="kv-list">
          <div><dt>E-mail</dt><dd>{influencer.user.email}</dd></div>
          <div><dt>Telefone</dt><dd>{influencer.user.phone ?? "—"}</dd></div>
          <div><dt>Link de cadastro</dt><dd className="pix-key"><code>{links.signup}</code><CopyValue value={links.signup} label="Copiar link de cadastro" /></dd></div>
          <div><dt>Link da loja</dt><dd className="pix-key"><code>{links.store}</code><CopyValue value={links.store} label="Copiar link da loja" /></dd></div>
          {influencer.user.role === UserRole.STUDENT ? <div><dt>Perfil</dt><dd><Link className="link" href={`/admin/alunos/${influencer.user.id}`}>Ver perfil do aluno</Link></dd></div> : null}
        </dl>
      </section>
    </div>
  </AppShell>;
}
