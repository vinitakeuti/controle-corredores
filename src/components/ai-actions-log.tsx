import type { AiActionLogRow } from "@/lib/ai/audit";
import { StatusPill, type Tone } from "@/components/ui/status-pill";

const titles: Record<string, string> = { cadastrar_aluno: "Cadastro de aluno", criar_evento_agenda: "Novo compromisso", remover_evento_agenda: "Remoção de compromisso", lancar_financeiro: "Lançamento financeiro", remover_lancamento: "Remoção de lançamento" };
const statuses: Record<string, { label: string; tone: Tone }> = { PENDING: { label: "Aguardando", tone: "info" }, EXECUTED: { label: "Feita", tone: "positive" }, REJECTED: { label: "Cancelada", tone: "neutral" }, FAILED: { label: "Falhou", tone: "danger" }, EXPIRED: { label: "Expirou", tone: "warning" } };
const channels: Record<string, string> = { APP: "App", WHATSAPP: "WhatsApp", SITE: "Site" };
const when = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Maceio", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

// Toda ação que muda dados passa por aqui: quem pediu, por onde, o quê e o desfecho.
export function AiActionsLog({ rows }: { rows: AiActionLogRow[] }) {
  return (
    <section className="section-block" aria-labelledby="ai-actions-title">
      <div className="section-head">
        <div>
          <h2 className="section-title" id="ai-actions-title">Ações da IA</h2>
          <p className="section-lead">Cadastros, compromissos e lançamentos que a IA preparou, com quem pediu e o que aconteceu. Nada é executado sem a confirmação de quem pediu.</p>
        </div>
      </div>
      {rows.length ? (
        <ul className="ledger ai-actions-log">
          {rows.map((row) => {
            const status = statuses[row.status] ?? { label: row.status, tone: "neutral" as Tone };
            return (
              <li className="ledger-row" key={row.id}>
                <div className="ledger-row-content">
                  <span className="ledger-copy">
                    <strong>{titles[row.tool] ?? row.tool}</strong>
                    <small>{row.summary}</small>
                    <small>{row.requester} · {channels[row.channel] ?? row.channel} · {when.format(new Date(row.createdAt))}{row.error ? ` · ${row.error}` : ""}</small>
                  </span>
                  <StatusPill tone={status.tone}>{status.label}</StatusPill>
                </div>
              </li>
            );
          })}
        </ul>
      ) : <p className="ledger-empty">Nenhuma ação ainda.</p>}
    </section>
  );
}
