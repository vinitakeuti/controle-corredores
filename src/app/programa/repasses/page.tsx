import { AppShell } from "@/components/app-shell";
import { PixKeyForm } from "@/components/program-widgets";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { formatCurrency, formatDate } from "@/lib/format";
import { currentMonthKey, maskPixKey, monthName, totalsByInfluencer, totalsOf } from "@/lib/influencers";
import { prisma } from "@/lib/prisma";
import { requireProgramMember } from "@/lib/program";

const pixTypeLabel: Record<string, string> = { CPF: "CPF", CNPJ: "CNPJ", EMAIL: "E-mail", PHONE: "Telefone", RANDOM: "Chave aleatória" };

export default async function ProgramPayoutsPage() {
  const { user, influencer, showCommission } = await requireProgramMember();
  const month = currentMonthKey();
  const [payouts, totals] = await Promise.all([
    prisma.influencerPayout.findMany({ where: { influencerId: influencer.id }, orderBy: { month: "desc" } }),
    totalsByInfluencer(month),
  ]);
  const open = totalsOf(totals, influencer.id);

  return <AppShell user={user} current="program-payouts">
    <PageHeader context={{ label: "Programa Experts & Creators" }} title="Repasses." lead="O que já foi aprovado para você, o que já foi pago e onde você recebe." />

    <section className="section-block" aria-labelledby="program-payouts-title">
      <div className="section-head"><div><h2 className="section-title" id="program-payouts-title">Seus repasses</h2><p className="section-lead">A equipe fecha cada mês depois que ele termina. O mês que está correndo ainda pode mudar.</p></div></div>
      {!showCommission ? <div className="message" data-tone="info"><Icon name="info" /><div><strong>Valores de comissão ainda não liberados</strong><p>Quando a equipe liberar, você vê aqui quanto tem a receber em cada mês. Suas vendas já aparecem em Minhas vendas.</p></div></div>
        : <>
          <div className="payout-open"><span>{monthName(month)} · em aberto</span><strong>{formatCurrency(open.commissionCents)}</strong><small>{open.sales} {open.sales === 1 ? "venda" : "vendas"} até agora</small></div>
          {payouts.length ? <ul className="ledger payout-ledger">{payouts.map((payout) => <li className="ledger-row" key={payout.id}><div className="ledger-row-content">
            <span className="ledger-copy"><strong>{monthName(payout.month)}</strong><small>{payout.salesCount} {payout.salesCount === 1 ? "venda" : "vendas"} · aprovado em {formatDate(payout.approvedAt)}</small></span>
            <span className="payout-amount">{formatCurrency(payout.amountCents)}</span>
            <StatusPill tone={payout.status === "PAID" ? "positive" : "info"}>{payout.status === "PAID" ? `Pago em ${formatDate(payout.paidAt)}` : "Aprovado"}</StatusPill>
          </div></li>)}</ul> : <div className="state-empty"><p>Ainda não há mês fechado. Quando a equipe aprovar um mês de comissão, o valor aparece aqui.</p></div>}
        </>}
    </section>

    <section className="section-block" aria-labelledby="program-pix-title">
      <div className="section-head"><div><h2 className="section-title" id="program-pix-title">Onde receber</h2><p className="section-lead">A chave Pix para onde a Pace Lab manda a sua comissão.</p></div></div>
      <div className="pix-card">
        <span className="pix-card-icon" aria-hidden="true"><Icon name="wallet" /></span>
        <div className="pix-card-copy">{influencer.pixKeyHint ? <><strong>Sua chave Pix <span className="mono">{maskPixKey(influencer.pixKeyHint)}</span></strong><span>{pixTypeLabel[influencer.pixKeyType ?? ""] ?? "Chave"} · cadastrada em {formatDate(influencer.pixKeyUpdatedAt)}</span></> : <><strong>Nenhuma chave cadastrada</strong><span>Cadastre para receber seus repasses.</span></>}</div>
        <PixKeyForm hasKey={Boolean(influencer.pixKeyHint)} />
      </div>
    </section>
  </AppShell>;
}
