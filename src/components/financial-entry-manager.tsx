"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/format";

type EntryType = "REVENUE" | "EXPENSE";
type LedgerKind = "income" | "cost";

export type FinancialEntryRowData = {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
  amountCents: number;
  occurredAt: string;
  isFixed: boolean;
  createdByName: string;
};

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

export function FinancialEntryRow({ entry, kind, editable }: { entry: FinancialEntryRowData; kind: LedgerKind; editable: boolean }) {
  const [editing, setEditing] = useState(false);
  const content = <>
    <span className={`finance-entry-mark ${kind}`}>{kind === "income" ? "+" : "−"}</span>
    <span className="finance-entry-row-copy"><strong>{entry.title}</strong><small>{entry.category ? `${entry.category} · ` : ""}{formatDate(entry.occurredAt)} · {entry.createdByName}</small></span>
    <span className="finance-entry-row-amount"><b className={kind === "cost" ? "negative" : ""}>{kind === "cost" ? "−" : ""}{formatCurrency(entry.amountCents)}</b></span>
  </>;

  return <div className={`finance-entry-row${editable ? " is-editable" : ""}`}>
    {editable ? <button type="button" className="finance-entry-row-content" onClick={() => setEditing(true)} aria-label={`Editar lançamento ${entry.title}`}>{content}</button> : <div className="finance-entry-row-content">{content}</div>}
    {editing ? <FinancialEntryEditModal entry={entry} initialType={kind === "income" ? "REVENUE" : "EXPENSE"} onClose={() => setEditing(false)} /> : null}
  </div>;
}

function FinancialEntryEditModal({ entry, initialType, onClose }: { entry: FinancialEntryRowData; initialType: EntryType; onClose: () => void }) {
  const router = useRouter();
  const [type, setType] = useState<EntryType>(initialType);
  const [title, setTitle] = useState(entry.title);
  const [category, setCategory] = useState(entry.category ?? categories[initialType][0]);
  const [description, setDescription] = useState(entry.description ?? "");
  const [amount, setAmount] = useState((entry.amountCents / 100).toFixed(2).replace(".", ","));
  const [occurredAt, setOccurredAt] = useState(entry.occurredAt.slice(0, 10));
  const [isFixed, setIsFixed] = useState(entry.isFixed);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function changeType(next: EntryType) {
    setType(next);
    setCategory(categories[next][0]);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/financial-entries", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: entry.id, type, title, category, description, amount, occurredAt, isFixed }),
      });
      const data = await response.json().catch(() => null) as { error?: unknown } | null;
      if (!response.ok) {
        setMessage(typeof data?.error === "string" ? data.error : "Não foi possível salvar as alterações.");
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setMessage("Não foi possível salvar as alterações. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setDeleting(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/financial-entries?id=${encodeURIComponent(entry.id)}`, { method: "DELETE" });
      const data = await response.json().catch(() => null) as { error?: unknown } | null;
      if (!response.ok) {
        setMessage(typeof data?.error === "string" ? data.error : "Não foi possível excluir o lançamento.");
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setMessage("Não foi possível excluir o lançamento. Tente novamente.");
    } finally {
      setDeleting(false);
    }
  }

  return <div className="financial-entry-modal financial-entry-edit-modal" role="dialog" aria-modal="true" aria-labelledby="financial-entry-edit-title">
    <button className="financial-entry-backdrop" type="button" aria-label="Fechar edição" onClick={onClose} />
    <section>
      <div className="financial-entry-modal-heading">
        <div><p className="eyebrow">Editar lançamento</p><h2 id="financial-entry-edit-title">{entry.title}</h2></div>
        <button type="button" onClick={onClose} aria-label="Fechar">×</button>
      </div>
      <form className="financial-entry-form" onSubmit={save}>
        <div className="financial-entry-type">
          <button type="button" className={type === "EXPENSE" ? "active expense" : ""} onClick={() => changeType("EXPENSE")}>Saída</button>
          <button type="button" className={type === "REVENUE" ? "active" : ""} onClick={() => changeType("REVENUE")}>Entrada</button>
        </div>
        <div className="financial-entry-core">
          <div className="field financial-title-field"><label htmlFor="financial-edit-title-input">Título</label><input id="financial-edit-title-input" value={title} onChange={(event) => setTitle(event.target.value)} required /></div>
          <div className="field"><label htmlFor="financial-edit-category">Categoria</label><select id="financial-edit-category" value={category} onChange={(event) => setCategory(event.target.value)}>{categories[type].map((item) => <option key={item}>{item}</option>)}</select></div>
          <div className="field"><label htmlFor="financial-edit-amount">Valor (R$)</label><input id="financial-edit-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required /></div>
          <div className="field"><label htmlFor="financial-edit-date">Data</label><input id="financial-edit-date" type="date" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} required /></div>
          <label className="financial-fixed"><input type="checkbox" checked={isFixed} onChange={(event) => setIsFixed(event.target.checked)} /><span><strong>Recorrente</strong><small>Repete todo mês</small></span></label>
        </div>
        <div className="field financial-entry-description-field"><label htmlFor="financial-edit-description">Descrição <em>opcional</em></label><textarea id="financial-edit-description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Detalhes para conferência." /></div>
        {message ? <p className="error-message" role="alert">{message}</p> : null}
        {confirmingDelete ? <div className="financial-entry-delete-confirm" role="alert"><p>Excluir este lançamento{isFixed ? " e encerrar sua repetição nos próximos meses" : ""}?</p><div><button type="button" className="button" onClick={() => setConfirmingDelete(false)} disabled={deleting}>Cancelar</button><button type="button" className="button financial-entry-danger" onClick={remove} disabled={deleting}>{deleting ? "Excluindo..." : "Confirmar exclusão"}</button></div></div> : <div className="financial-entry-editor-actions"><button type="button" className="financial-entry-delete-trigger" onClick={() => setConfirmingDelete(true)}>Excluir lançamento</button><button className="button button-dark" type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</button></div>}
      </form>
    </section>
  </div>;
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
