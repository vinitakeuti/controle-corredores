"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type EntryType = "REVENUE" | "EXPENSE";

const categories = {
  REVENUE: ["Venda avulsa", "Evento", "Produto", "Serviço", "Outro"],
  EXPENSE: ["Operação", "Marketing", "Equipe", "Equipamento", "Impostos", "Outro"],
};

export function FinancialEntryManager({ month }: { month: string }) {
  return <FinancialEntryForm month={month} initialType="EXPENSE" />;
}

export function FinancialMobileActions({ month }: { month: string }) {
  const [type, setType] = useState<EntryType | null>(null);

  return <>
    <div className="financial-mobile-actions">
      <button type="button" className="expense" onClick={() => setType("EXPENSE")}><b>−</b> Saída</button>
      <button type="button" onClick={() => setType("REVENUE")}><b>+</b> Entrada</button>
    </div>
    {type ? <div className="financial-entry-modal" role="dialog" aria-modal="true" aria-labelledby="financial-entry-modal-title">
      <button className="financial-entry-backdrop" type="button" aria-label="Fechar lançamento" onClick={() => setType(null)} />
      <section>
        <div className="financial-entry-modal-heading">
          <div><p className="eyebrow">Novo lançamento</p><h2 id="financial-entry-modal-title">{type === "EXPENSE" ? "Registrar saída" : "Registrar entrada"}</h2></div>
          <button type="button" onClick={() => setType(null)} aria-label="Fechar">×</button>
        </div>
        <FinancialEntryForm key={type} month={month} initialType={type} onSaved={() => setType(null)} />
      </section>
    </div> : null}
  </>;
}

function FinancialEntryForm({ month, initialType, onSaved }: { month: string; initialType: EntryType; onSaved?: () => void }) {
  const router = useRouter();
  const [type, setType] = useState<EntryType>(initialType);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(categories[initialType][0]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [occurredAt, setOccurredAt] = useState(`${month}-01`);
  const [isFixed, setIsFixed] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  function changeType(next: EntryType) {
    setType(next);
    setCategory(categories[next][0]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/financial-entries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, title, category, description, amount, occurredAt, isFixed }),
      });
      const data = await response.json().catch(() => null) as { error?: unknown } | null;
      if (!response.ok) {
        setMessage(typeof data?.error === "string" ? data.error : "Não foi possível salvar.");
        return;
      }
      setTitle("");
      setDescription("");
      setAmount("");
      setMessage("Lançamento registrado.");
      router.refresh();
      onSaved?.();
    } catch {
      setMessage("Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return <form className="financial-entry-form" onSubmit={submit}>
    <div className="financial-entry-type">
      <button type="button" className={type === "EXPENSE" ? "active expense" : ""} onClick={() => changeType("EXPENSE")}>Saída</button>
      <button type="button" className={type === "REVENUE" ? "active" : ""} onClick={() => changeType("REVENUE")}>Entrada</button>
    </div>
    <div className="financial-entry-core">
      <div className="field financial-title-field"><label htmlFor="financial-title">Título</label><input id="financial-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={type === "REVENUE" ? "Ex.: Venda de camiseta" : "Ex.: Aluguel da pista"} required /></div>
      <div className="field"><label htmlFor="financial-category">Categoria</label><select id="financial-category" value={category} onChange={(event) => setCategory(event.target.value)}>{categories[type].map((item) => <option key={item}>{item}</option>)}</select></div>
      <div className="field"><label htmlFor="financial-amount">Valor (R$)</label><input id="financial-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" required /></div>
      <div className="field"><label htmlFor="financial-date">Data</label><input id="financial-date" type="date" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} required /></div>
      <label className="financial-fixed"><input type="checkbox" checked={isFixed} onChange={(event) => setIsFixed(event.target.checked)} /><span><strong>Custo fixo</strong><small>Repete todo mês</small></span></label>
    </div>
    <details className="financial-entry-notes">
      <summary>Adicionar descrição</summary>
      <div className="field"><label htmlFor="financial-description">Descrição <em>opcional</em></label><textarea id="financial-description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Detalhes para conferência." /></div>
    </details>
    <div className="financial-entry-submit">
      {message ? <p className={message === "Lançamento registrado." ? "success-message" : "error-message"} role="status">{message}</p> : null}
      <button className="button button-dark" type="submit" disabled={saving}>{saving ? "Salvando…" : type === "REVENUE" ? "Registrar entrada" : "Registrar saída"}</button>
    </div>
  </form>;
}
