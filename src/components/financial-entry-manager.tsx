"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Feedback } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
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
  return <FinancialEntryForm month={month} initialType="EXPENSE" idPrefix="financial" />;
}

// Celular: barra fixa com Saída e Entrada, acima da navegação inferior; o formulário abre em bottom sheet.
export function FinancialMobileActions({ month }: { month: string }) {
  const [type, setType] = useState<EntryType | null>(null);

  return <>
    <div className="finance-quick-actions">
      <button type="button" className="btn btn-secondary" onClick={() => setType("EXPENSE")}><span className="ledger-sign" data-kind="cost" aria-hidden="true">−</span>Saída</button>
      <button type="button" className="btn btn-secondary" onClick={() => setType("REVENUE")}><span className="ledger-sign" data-kind="income" aria-hidden="true">+</span>Entrada</button>
    </div>
    {type ? <Sheet open onClose={() => setType(null)} title={type === "EXPENSE" ? "Registrar saída" : "Registrar entrada"} closeLabel="Fechar lançamento">
      <FinancialEntryForm key={type} month={month} initialType={type} onSaved={() => setType(null)} idPrefix="financial-mobile" />
    </Sheet> : null}
  </>;
}

export function FinancialEntryRow({ entry, kind, editable }: { entry: FinancialEntryRowData; kind: LedgerKind; editable: boolean }) {
  const [editing, setEditing] = useState(false);
  const content = <>
    <span className="ledger-sign" data-kind={kind} aria-hidden="true">{kind === "income" ? "+" : "−"}</span>
    <span className="ledger-copy"><strong>{entry.title}</strong><small>{entry.category ? `${entry.category} · ` : ""}{formatDate(entry.occurredAt)} · {entry.createdByName}</small></span>
    <span className="ledger-amount" data-kind={kind}>{kind === "cost" ? "−" : ""}{formatCurrency(entry.amountCents)}</span>
  </>;

  return <li className="ledger-row">
    {editable ? <button type="button" className="ledger-row-content" onClick={() => setEditing(true)} aria-label={`Editar lançamento ${entry.title}, ${kind === "cost" ? "menos " : ""}${formatCurrency(entry.amountCents)}`}>{content}<Icon name="chevronRight" className="icon-sm ledger-edit" /></button> : <div className="ledger-row-content">{content}</div>}
    {editing ? <FinancialEntryEditModal entry={entry} initialType={kind === "income" ? "REVENUE" : "EXPENSE"} onClose={() => setEditing(false)} /> : null}
  </li>;
}

function TypeToggle({ type, onChange }: { type: EntryType; onChange: (type: EntryType) => void }) {
  return <div className="segmented" role="group" aria-label="Tipo de lançamento">
    <button type="button" aria-pressed={type === "EXPENSE"} data-kind="cost" onClick={() => onChange("EXPENSE")}>Saída</button>
    <button type="button" aria-pressed={type === "REVENUE"} data-kind="income" onClick={() => onChange("REVENUE")}>Entrada</button>
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

  return <Sheet open onClose={onClose} title={entry.title} closeLabel="Fechar edição">
    <form className="sheet-form finance-form" onSubmit={save}>
      <TypeToggle type={type} onChange={changeType} />
      <div className="form-field"><label htmlFor="financial-edit-title-input">Título</label><input className="control" id="financial-edit-title-input" value={title} onChange={(event) => setTitle(event.target.value)} required /></div>
      <div className="form-grid finance-form-grid">
        <div className="form-field"><label htmlFor="financial-edit-category">Categoria</label><select className="control" id="financial-edit-category" value={category} onChange={(event) => setCategory(event.target.value)}>{categories[type].map((item) => <option key={item}>{item}</option>)}</select></div>
        <div className="form-field"><label htmlFor="financial-edit-amount">Valor (R$)</label><input className="control" id="financial-edit-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required /></div>
        <div className="form-field"><label htmlFor="financial-edit-date">Data</label><input className="control" id="financial-edit-date" type="date" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} required /></div>
      </div>
      <label className="check"><input type="checkbox" checked={isFixed} onChange={(event) => setIsFixed(event.target.checked)} /><span className="check-copy"><strong>Recorrente</strong><small>Repete todo mês</small></span></label>
      <div className="form-field"><label htmlFor="financial-edit-description">Descrição <span className="optional-tag">opcional</span></label><textarea className="control" id="financial-edit-description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Detalhes para conferência." /></div>
      <Feedback error={message} />
      {confirmingDelete ? <div className="message-stack">
        <p className="message" data-tone="danger"><Icon name="alert" /><span>Excluir este lançamento{isFixed ? " e encerrar sua repetição nos próximos meses" : ""}?</span></p>
        <div className="btn-row"><button type="button" className="btn btn-secondary" onClick={() => setConfirmingDelete(false)} disabled={deleting}>Cancelar</button><button type="button" className="btn btn-danger-solid" onClick={remove} disabled={deleting} aria-busy={deleting}>{deleting ? "Excluindo..." : "Confirmar exclusão"}</button></div>
      </div> : <div className="btn-row btn-row-split sheet-actions">
        <button type="button" className="btn btn-danger" onClick={() => setConfirmingDelete(true)}><Icon name="trash" />Excluir lançamento</button>
        <button className="btn btn-primary" type="submit" disabled={saving} aria-busy={saving}>{saving ? "Salvando..." : "Salvar alterações"}</button>
      </div>}
    </form>
  </Sheet>;
}

function FinancialEntryForm({ month, initialType, onSaved, idPrefix }: { month: string; initialType: EntryType; onSaved?: () => void; idPrefix: string }) {
  const router = useRouter();
  const [type, setType] = useState<EntryType>(initialType);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(categories[initialType][0]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [occurredAt, setOccurredAt] = useState(`${month}-01`);
  const [isFixed, setIsFixed] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function changeType(next: EntryType) {
    setType(next);
    setCategory(categories[next][0]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/financial-entries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, title, category, description, amount, occurredAt, isFixed }),
      });
      const data = await response.json().catch(() => null) as { error?: unknown } | null;
      if (!response.ok) {
        setError(typeof data?.error === "string" ? data.error : "Não foi possível salvar.");
        return;
      }
      setTitle("");
      setDescription("");
      setAmount("");
      setMessage("Lançamento registrado.");
      router.refresh();
      onSaved?.();
    } catch {
      setError("Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  const id = (name: string) => `${idPrefix}-${name}`;

  return <form className="finance-form" onSubmit={submit}>
    <TypeToggle type={type} onChange={changeType} />
    <div className="form-field"><label htmlFor={id("title")}>Título</label><input className="control" id={id("title")} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={type === "REVENUE" ? "Ex.: Venda de camiseta" : "Ex.: Aluguel da pista"} required data-autofocus /></div>
    <div className="form-grid finance-form-grid">
      <div className="form-field"><label htmlFor={id("category")}>Categoria</label><select className="control" id={id("category")} value={category} onChange={(event) => setCategory(event.target.value)}>{categories[type].map((item) => <option key={item}>{item}</option>)}</select></div>
      <div className="form-field"><label htmlFor={id("amount")}>Valor (R$)</label><input className="control" id={id("amount")} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" required /></div>
      <div className="form-field"><label htmlFor={id("date")}>Data</label><input className="control" id={id("date")} type="date" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} required /></div>
    </div>
    <label className="check"><input type="checkbox" checked={isFixed} onChange={(event) => setIsFixed(event.target.checked)} /><span className="check-copy"><strong>Custo fixo</strong><small>Repete todo mês</small></span></label>
    <details className="finance-notes">
      <summary>Adicionar descrição</summary>
      <div className="form-field"><label htmlFor={id("description")}>Descrição <span className="optional-tag">opcional</span></label><textarea className="control" id={id("description")} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Detalhes para conferência." /></div>
    </details>
    <Feedback success={message} error={error} />
    <button className="btn btn-primary btn-block" type="submit" disabled={saving} aria-busy={saving}>{saving ? "Salvando…" : type === "REVENUE" ? "Registrar entrada" : "Registrar saída"}</button>
  </form>;
}
