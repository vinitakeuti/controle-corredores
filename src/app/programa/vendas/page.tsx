import { InfluencerSaleStatus } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { MarketingMonthPicker } from "@/components/marketing-month-picker";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { formatCurrency } from "@/lib/format";
import { currentMonthKey, monthBounds, monthlyTotals, monthName, parseMonthKey } from "@/lib/influencers";
import { prisma } from "@/lib/prisma";
import { requireProgramMember } from "@/lib/program";

const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Maceio" });

export default async function ProgramSalesPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { user, influencer, showCommission } = await requireProgramMember();
  const params = await searchParams;
  const current = currentMonthKey();
  const month = parseMonthKey(params.month) && params.month! <= current ? params.month! : current;
  const { from, to } = monthBounds(month);
  const [sales, months] = await Promise.all([
    // Quem comprou não aparece: só pedido, data, o que foi comprado e valor.
    prisma.influencerSale.findMany({ where: { influencerId: influencer.id, occurredAt: { gte: from, lt: to } }, orderBy: { occurredAt: "desc" }, select: { id: true, reference: true, occurredAt: true, description: true, amountCents: true, commissionBps: true, commissionCents: true, status: true, source: true } }),
    monthlyTotals(influencer.id, influencer.createdAt),
  ]);
  const confirmed = sales.filter((sale) => sale.status === InfluencerSaleStatus.CONFIRMED).length;

  return <AppShell user={user} current="program-sales">
    <PageHeader context={{ label: "Programa Experts & Creators" }} title="Minhas vendas." lead="As vendas com o seu cupom, pela data do pagamento." actions={<MarketingMonthPicker value={month} max={current} />} />

    <section className="section-block" aria-labelledby="program-sales-title">
      <div className="section-head"><div><h2 className="section-title" id="program-sales-title">Vendas com seu cupom em {monthName(month)}</h2><p className="section-lead">Só o pedido, a data, o que foi comprado e o valor. Quem comprou não aparece aqui.</p></div></div>
      {sales.length ? <div className="data-table-wrap responsive-scroll">
        <table className="data-table program-sales-table">
          <caption className="visually-hidden">Vendas com o cupom em {monthName(month)}</caption>
          <thead><tr><th scope="col">Pedido</th><th scope="col">Data</th><th scope="col">O que foi comprado</th><th scope="col" className="num">Valor</th>{showCommission ? <th scope="col" className="num">Comissão</th> : null}<th scope="col">Situação</th></tr></thead>
          <tbody>{sales.map((sale) => <tr key={sale.id}>
            <td><code>{sale.reference}</code></td>
            <td><span className="mono">{dateTime.format(sale.occurredAt)}</span></td>
            <td className="sale-description">{sale.source === "PLAN" ? `Plano · ${sale.description}` : sale.description}</td>
            <td className="num"><span className="mono">{formatCurrency(sale.amountCents)}</span></td>
            {showCommission ? <td className="num">{sale.commissionBps ? <span className="mono">{formatCurrency(sale.commissionCents)}</span> : <span className="cell-secondary">Sem comissão</span>}</td> : null}
            <td><StatusPill tone={sale.status === InfluencerSaleStatus.CONFIRMED ? "positive" : "neutral"}>{sale.status === InfluencerSaleStatus.CONFIRMED ? "Confirmada" : "Cancelada"}</StatusPill></td>
          </tr>)}</tbody>
        </table>
        <p className="table-foot">{confirmed} {confirmed === 1 ? "venda confirmada" : "vendas confirmadas"} em {monthName(month, false)}. Cancelada: o pedido foi estornado ou cancelado e não conta.</p>
      </div> : <div className="state-empty"><strong>Nenhuma venda em {monthName(month, false)}.</strong><p>Compartilhe seu cupom: cada assinatura nova e cada compra na loja com ele aparecem aqui.</p></div>}
    </section>

    <section className="section-block" aria-labelledby="program-months-title">
      <div className="section-head"><div><h2 className="section-title" id="program-months-title">Mês a mês</h2><p className="section-lead">As vendas com o seu cupom em cada mês.</p></div></div>
      <div className="data-table-wrap">
        <table className="data-table months-table">
          <caption className="visually-hidden">Vendas por mês</caption>
          <thead><tr><th scope="col">Mês</th><th scope="col" className="num">Vendas</th><th scope="col" className="num">Valor vendido</th>{showCommission ? <th scope="col" className="num">Comissão</th> : null}</tr></thead>
          <tbody>{months.slice(0, 12).map((row) => <tr key={row.month}>
            <td>{monthName(row.month)}{row.month === current ? <span className="cell-secondary">até hoje</span> : null}</td>
            <td className="num"><span className="mono">{row.sales}</span></td>
            <td className="num"><span className="mono">{formatCurrency(row.amountCents)}</span></td>
            {showCommission ? <td className="num"><span className="mono">{formatCurrency(row.commissionCents)}</span></td> : null}
          </tr>)}</tbody>
        </table>
      </div>
    </section>
  </AppShell>;
}
