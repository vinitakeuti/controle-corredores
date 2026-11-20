import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { RankingBoard } from "@/components/program-ranking";
import { CopyCouponButton, CopyLinkButton } from "@/components/program-widgets";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { activeDiscountPercent, commissionRule, currentMonthKey, influencerLinks, influencerTypeLabel, monthName, monthRanking, ruleSummary, shiftMonth, totalsByInfluencer, totalsOf } from "@/lib/influencers";
import { requireProgramMember } from "@/lib/program";

function delta(value: number) {
  return `${value > 0 ? "+" : ""}${value}`;
}

export default async function ProgramHomePage() {
  const { user, influencer, settings, showCommission } = await requireProgramMember();
  const rule = ruleSummary(commissionRule(influencer, settings));
  const links = influencerLinks(influencer.couponCode);
  const display = (url: string) => url.replace(/^https?:\/\//, "");
  const month = currentMonthKey();
  const previousMonth = shiftMonth(month, -1);
  const [totals, previousTotals, ranking, previousRanking] = await Promise.all([totalsByInfluencer(month), totalsByInfluencer(previousMonth), monthRanking(month), monthRanking(previousMonth)]);
  const mine = totalsOf(totals, influencer.id);
  const before = totalsOf(previousTotals, influencer.id);
  const me = ranking.find((row) => row.influencerId === influencer.id);
  const meBefore = previousRanking.find((row) => row.influencerId === influencer.id);
  const amountChange = before.amountCents ? Math.round(((mine.amountCents - before.amountCents) / before.amountCents) * 100) : null;
  const discount = activeDiscountPercent(influencer);
  const monthLabel = monthName(month, false);
  const previousLabel = monthName(previousMonth, false);

  return <AppShell user={user} current="program">
    <PageHeader context={{ label: `Programa de ${influencerTypeLabel[influencer.type]}s` }} title={`Olá, ${user.name.split(" ")[0]}.`} lead="Suas vendas e onde você está no ranking. Tudo com o seu cupom." />

    {!influencer.active ? <p className="message" data-tone="warning" role="status"><Icon name="alert" /><span>Seu cupom está pausado e não gera novas vendas. Seu histórico e seus repasses continuam aqui. Fale com a equipe da Pace Lab.</span></p> : null}
    <section className="section-block program-coupon" aria-labelledby="program-coupon-title">
      <div className="section-head"><div><h2 className="section-title" id="program-coupon-title">Seu cupom</h2><p className="section-lead">Use e compartilhe com quem te acompanha.</p></div></div>
      <div className="coupon-card coupon-card-lg">
        <div className="coupon-card-top"><span className="coupon-card-label">Para indicar</span><CopyCouponButton code={influencer.couponCode} /></div>
        <strong className="coupon-card-code">{influencer.couponCode}</strong>
        <span className="coupon-card-note">Vale para os planos da assessoria e para a loja. É ele que gera as vendas atribuídas a você.{showCommission ? (rule === "sem comissão" ? " No momento, suas vendas não geram comissão." : ` Sua comissão: ${rule}.`) : ""}{discount ? ` Quem usa ganha ${discount}% de desconto${influencer.discountUntil ? ` até ${formatShortDate(influencer.discountUntil)}` : ""}.` : ""}</span>
        <div className="coupon-links">
          <span className="coupon-card-label">Seus links</span>
          <ul className="coupon-link-list">
            <li><span className="coupon-link-name">Cadastro na assessoria</span><span className="coupon-link-url" title={links.signup}>{display(links.signup)}</span><CopyLinkButton url={links.signup} name="de cadastro" /></li>
            <li><span className="coupon-link-name">Loja</span><span className="coupon-link-url" title={links.store}>{display(links.store)}</span><CopyLinkButton url={links.store} name="da loja" /></li>
          </ul>
          <p className="coupon-links-note">Os dois já preenchem o seu cupom. Quem usar o link e digitar o cupom conta uma vez só.</p>
        </div>
      </div>
    </section>

    <section className="section-block" aria-labelledby="program-result-title">
      <div className="section-head"><div><h2 className="section-title" id="program-result-title">Seu resultado em {monthLabel}</h2><p className="section-lead">Pedidos cancelados ou com pagamento não concluído não contam. Plano conta no primeiro pagamento de quem você indicou.</p></div></div>
      <div className="program-metrics" data-count={showCommission ? 4 : 3}>
        <div className="program-metric program-metric-accent"><span className="program-metric-label"><Icon name="ticket" />Vendas com seu cupom</span><strong className="program-metric-value">{mine.sales}</strong><span className="program-metric-note"><span className="delta">{delta(mine.sales - before.sales)}</span> vs. {previousLabel}</span></div>
        <div className="program-metric"><span className="program-metric-label"><Icon name="chart" />Valor vendido</span><strong className="program-metric-value">{formatCurrency(mine.amountCents)}</strong><span className="program-metric-note">{amountChange === null ? `${formatCurrency(before.amountCents)} em ${previousLabel}` : <><span className="delta">{delta(amountChange)}%</span> vs. {previousLabel}</>}</span></div>
        <div className="program-metric"><span className="program-metric-label"><Icon name="trophy" />Sua posição</span><strong className="program-metric-value">{me ? <>{me.position}<span className="ordinal">º</span></> : "—"}</strong><span className="program-metric-note">{me ? <>{meBefore ? <><span className="delta">{delta(meBefore.position - me.position)}</span> vs. {previousLabel} · </> : null}de {ranking.length} que pontuaram</> : "Sua primeira venda do mês te coloca no ranking."}</span></div>
        {showCommission ? <div className="program-metric"><span className="program-metric-label"><Icon name="wallet" />Sua comissão</span><strong className="program-metric-value">{formatCurrency(mine.commissionCents)}</strong><span className="program-metric-note">estimada · fecha no fim do mês</span></div> : null}
      </div>
    </section>

    <section className="section-block" aria-labelledby="program-ranking-title">
      <div className="section-head"><div><h2 className="section-title" id="program-ranking-title">Ranking de {monthLabel}</h2><p className="section-lead">Você aparece só com o nome abreviado. Ninguém vê seus valores.</p></div><Link className="btn btn-quiet" href="/programa/ranking">Ver completo<Icon name="arrowRight" /></Link></div>
      {ranking.length ? <RankingBoard rows={ranking} meId={influencer.id} compact /> : <div className="state-empty"><p>Ninguém pontuou em {monthLabel} ainda. A primeira venda com o cupom abre o ranking.</p></div>}
    </section>
  </AppShell>;
}
