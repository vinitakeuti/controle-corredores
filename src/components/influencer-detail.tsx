"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { InfluencerFields, influencerPayload, type InfluencerDraft, type ProgramDefaults } from "@/components/influencer-fields";
import { Feedback } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { StatusPill } from "@/components/ui/status-pill";
import { formatCurrency } from "@/lib/format";

export type MonthRow = { month: string; label: string; sales: number; amountCents: number; commissionCents: number; payout: { status: "APPROVED" | "PAID"; amountCents: number; paidAt: string | null } | null; closed: boolean };

// Ações da ficha do influenciador: editar, aprovar/pagar repasses, pausar e copiar a chave Pix.
export function InfluencerDetailActions({ id, draft: initialDraft, active, program }: { id: string; draft: InfluencerDraft; active: boolean; program: ProgramDefaults }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialDraft);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/admin/influencers/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível salvar.");
      setEditing(false); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }

  return <>
    <div className="btn-row">
      <button className="btn btn-secondary" type="button" onClick={() => { setDraft(initialDraft); setError(""); setEditing(true); }}><Icon name="edit" />Editar</button>
      <button className="btn btn-quiet" type="button" onClick={() => { void patch({ active: !active }); }} disabled={pending}>{active ? "Pausar no programa" : "Reativar no programa"}</button>
    </div>
    {!editing && error ? <Feedback error={error} /> : null}
    {editing ? <Sheet open onClose={() => setEditing(false)} title="Editar no programa" className="sheet-wide">
      <form className="sheet-form" onSubmit={(event) => { event.preventDefault(); void patch(influencerPayload(draft)); }}>
        <InfluencerFields idPrefix="edit-influencer" draft={draft} onChange={setDraft} program={program} />
        <p className="message" data-tone="info"><Icon name="info" /><span>As regras valem para as próximas vendas; as já registradas mantêm a comissão da época. Trocar o cupom faz o antigo parar de funcionar.</span></p>
        <Feedback error={error} />
        <div className="btn-row btn-row-split sheet-actions">
          <button className="btn btn-quiet" type="button" onClick={() => setEditing(false)} disabled={pending}>Cancelar</button>
          <button className="btn btn-primary" type="submit" disabled={pending} aria-busy={pending}>{pending ? "Salvando..." : "Salvar"}</button>
        </div>
      </form>
    </Sheet> : null}
  </>;
}

export function PayoutActions({ id, row }: { id: string; row: MonthRow }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function act(action: "approve" | "pay" | "reopen") {
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/admin/influencers/${encodeURIComponent(id)}/payouts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month: row.month, action }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível atualizar o repasse.");
      router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }
  const status = row.payout?.status === "PAID" ? <StatusPill tone="positive">Pago</StatusPill> : row.payout ? <StatusPill tone="info">Aprovado · {formatCurrency(row.payout.amountCents)}</StatusPill> : !row.sales ? <span className="cell-secondary">—</span> : !row.commissionCents ? <span className="cell-secondary">Sem comissão</span> : row.closed ? <StatusPill tone="warning">A aprovar</StatusPill> : <StatusPill tone="neutral">Mês em andamento</StatusPill>;
  return <div className="payout-cell">
    {status}
    {row.payout?.status === "APPROVED" ? <>
      <button className="btn btn-quiet" type="button" onClick={() => act("pay")} disabled={pending} aria-label={`Marcar repasse de ${row.label} como pago`}>Marcar como pago</button>
      <button className="btn btn-quiet" type="button" onClick={() => act("reopen")} disabled={pending} aria-label={`Desfazer aprovação de ${row.label}`}>Desfazer</button>
    </> : !row.payout && row.closed && row.commissionCents > 0 ? <button className="btn btn-secondary" type="button" onClick={() => act("approve")} disabled={pending} aria-label={`Aprovar repasse de ${row.label}`}>Aprovar</button> : null}
    {error ? <span className="payout-error" role="alert">{error}</span> : null}
  </div>;
}

export function CopyValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return <button className="btn btn-quiet" type="button" onClick={async () => { try { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } catch { /* sem permissão de cópia */ } }} aria-label={label}>
    <Icon name={copied ? "check" : "copy"} />{copied ? "Copiado" : "Copiar"}
  </button>;
}
