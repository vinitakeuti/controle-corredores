import { AiChannel } from "@prisma/client";
import { formatUsd } from "@/lib/ai/settings";
import type { AiUsageReport } from "@/lib/ai/usage";

const channelLabels: Record<AiChannel, string> = { APP: "App de gestão", WHATSAPP: "WhatsApp", SITE: "Site" };
const tokens = (value: number) => value.toLocaleString("pt-BR");

// Custos do mês: o total vem do OpenRouter (usage.cost) em cada resposta, somado aqui.
export function AiUsagePanel({ report, budgetUsd }: { report: AiUsageReport; budgetUsd: number | null }) {
  const budgetMicros = budgetUsd != null ? budgetUsd * 1_000_000 : null;
  const usedShare = budgetMicros ? Math.min(100, Math.round((report.costMicros / budgetMicros) * 100)) : null;
  return (
    <section className="section-block" aria-labelledby="ai-usage-title">
      <div className="section-head">
        <div>
          <h2 className="section-title" id="ai-usage-title">Custos de {report.monthLabel}</h2>
          <p className="section-lead">Valores em dólar, como o OpenRouter cobra. Cada chamada ao modelo conta, inclusive as consultas que o assistente faz antes de responder.</p>
        </div>
      </div>
      <div className="metric-strip" data-count={3}>
        <div className="metric"><span className="metric-label">Gasto no mês</span><strong className="metric-value">{formatUsd(report.costMicros)}</strong><span className="metric-note">{budgetMicros ? `${usedShare}% do limite de ${formatUsd(budgetMicros)}` : "Sem limite mensal"} · mês anterior {formatUsd(report.previousMonthCostMicros)}</span></div>
        <div className="metric"><span className="metric-label">Chamadas ao modelo</span><strong className="metric-value">{tokens(report.calls)}</strong><span className="metric-note">{report.conversations} {report.conversations === 1 ? "conversa" : "conversas"} com atividade</span></div>
        <div className="metric"><span className="metric-label">Tokens</span><strong className="metric-value">{tokens(report.inputTokens + report.outputTokens)}</strong><span className="metric-note">{tokens(report.inputTokens)} de entrada ({tokens(report.cachedTokens)} do cache) · {tokens(report.outputTokens)} de saída</span></div>
      </div>
      <div className="ai-usage-grid">
        <div>
          <h3 className="ai-usage-heading">Por modelo</h3>
          {report.byModel.length ? <ul className="ledger ledger-compact">{report.byModel.map((item) => <li className="ledger-row" key={item.model}><div className="ledger-row-content"><span className="ledger-copy"><strong>{item.model}</strong><small>{tokens(item.calls)} chamadas · {tokens(item.inputTokens)} + {tokens(item.outputTokens)} tokens</small></span><span className="ledger-amount">{formatUsd(item.costMicros)}</span></div></li>)}</ul> : <p className="ledger-empty">Nenhum uso neste mês.</p>}
        </div>
        <div>
          <h3 className="ai-usage-heading">Por canal</h3>
          {report.byChannel.length ? <ul className="ledger ledger-compact">{report.byChannel.map((item) => <li className="ledger-row" key={item.channel}><div className="ledger-row-content"><span className="ledger-copy"><strong>{channelLabels[item.channel]}</strong><small>{tokens(item.calls)} chamadas</small></span><span className="ledger-amount">{formatUsd(item.costMicros)}</span></div></li>)}</ul> : <p className="ledger-empty">Nenhum uso neste mês.</p>}
          <h3 className="ai-usage-heading">Por pessoa</h3>
          {report.byPerson.length ? <ul className="ledger ledger-compact">{report.byPerson.map((item) => <li className="ledger-row" key={item.name}><div className="ledger-row-content"><span className="ledger-copy"><strong>{item.name}</strong><small>{item.conversations} {item.conversations === 1 ? "conversa" : "conversas"}</small></span><span className="ledger-amount">{formatUsd(item.costMicros)}</span></div></li>)}</ul> : <p className="ledger-empty">Nenhum uso neste mês.</p>}
        </div>
      </div>
    </section>
  );
}
