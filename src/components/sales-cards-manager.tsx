"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Feedback } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { MenuButton } from "@/components/ui/menu-button";
import { Sheet } from "@/components/ui/sheet";
import { StatusPill } from "@/components/ui/status-pill";

type Status = "active" | "expired" | "closed";
export type SalesCardRow = { id: string; name: string; url: string; expiresAt: string; status: Status; signups: number; createdBy: string; plans: { id: string; label: string }[] };
export type SalesCardPlan = { id: string; label: string; isHidden: boolean; isCourtesy: boolean };
type Editing = { card: SalesCardRow | null } | null;

const MAX_DAYS = 30;
const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Maceio" });
const pad = (value: number) => String(value).padStart(2, "0");
// <input type="datetime-local"> trabalha no fuso do aparelho de quem usa.
const toLocalInput = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
function endOfToday() { const date = new Date(); date.setHours(23, 59, 0, 0); return date; }

function statusPill(card: SalesCardRow) {
  if (card.status === "active") return <StatusPill tone="positive">Ativo</StatusPill>;
  return <StatusPill tone="neutral">{card.status === "closed" ? "Encerrado" : "Expirado"}</StatusPill>;
}
function validityText(card: SalesCardRow) {
  const when = dateTime.format(new Date(card.expiresAt));
  return card.status === "active" ? `Vale até ${when}` : card.status === "closed" ? `Encerrado em ${when}` : `Expirou em ${when}`;
}

export function SalesCardsManager({ cards, plans }: { cards: SalesCardRow[]; plans: SalesCardPlan[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing>(null);
  const [name, setName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [planIds, setPlanIds] = useState<string[]>([]);
  const [closing, setClosing] = useState<SalesCardRow | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  const publicPlans = plans.filter((plan) => !plan.isHidden);
  const hiddenPlans = plans.filter((plan) => plan.isHidden);
  const selectedCourtesy = plans.some((plan) => plan.isCourtesy && planIds.includes(plan.id));
  const selectedHidden = plans.some((plan) => plan.isHidden && planIds.includes(plan.id));
  const activeCount = cards.filter((card) => card.status === "active").length;
  const now = new Date();
  const minInput = toLocalInput(now);
  const maxInput = toLocalInput(new Date(now.getTime() + MAX_DAYS * 24 * 60 * 60 * 1000));

  function openCreate() {
    setError(""); setName(""); setExpiresAt(toLocalInput(endOfToday())); setPlanIds([]);
    setEditing({ card: null });
  }
  function openEdit(card: SalesCardRow) {
    setError(""); setName(card.name); setPlanIds(card.plans.map((plan) => plan.id));
    // Cartão vencido: sugere reabrir até o fim de hoje.
    setExpiresAt(toLocalInput(card.status === "active" ? new Date(card.expiresAt) : endOfToday()));
    setEditing({ card });
  }
  const togglePlan = (id: string) => setPlanIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  async function save() {
    if (!editing) return;
    const when = new Date(expiresAt);
    if (name.trim().length < 2) { setError("Dê um nome ao cartão, como o nome do evento."); return; }
    if (!expiresAt || Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) { setError("A validade precisa ser no futuro."); return; }
    if (!planIds.length) { setError("Escolha pelo menos um plano."); return; }
    setPending(true); setError(""); setMessage("");
    try {
      const body = JSON.stringify({ name, expiresAt: when.toISOString(), planIds });
      const response = editing.card
        ? await fetch(`/api/admin/sales-cards/${encodeURIComponent(editing.card.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body })
        : await fetch("/api/admin/sales-cards", { method: "POST", headers: { "Content-Type": "application/json" }, body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível salvar o cartão.");
      setMessage(editing.card ? "Cartão atualizado." : "Cartão criado. Use “Exibir QR Code” para deixar em exibição no evento.");
      setEditing(null); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }
  async function confirmClose() {
    if (!closing) return;
    setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/sales-cards/${encodeURIComponent(closing.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ close: true }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível encerrar o cartão.");
      setMessage(`“${closing.name}” foi encerrado. O QR Code parou de funcionar.`);
      setClosing(null); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }
  async function copyLink(card: SalesCardRow) {
    try { await navigator.clipboard.writeText(card.url); setError(""); setMessage(`Link de “${card.name}” copiado.`); } catch { setError("Não foi possível copiar o link."); }
  }

  const planChecks = (items: SalesCardPlan[]) => items.map((plan) => <label className="check" key={plan.id}>
    <input type="checkbox" checked={planIds.includes(plan.id)} onChange={() => togglePlan(plan.id)} />
    <span className="check-copy"><strong>{plan.label}</strong></span>
  </label>);

  return <div className="sales-cards">
    <div className="plans-toolbar">
      <p className="plans-summary">{cards.length} {cards.length === 1 ? "cartão" : "cartões"} · {activeCount} {activeCount === 1 ? "ativo" : "ativos"}</p>
      <button className="btn btn-primary" type="button" onClick={openCreate} disabled={!plans.length}><Icon name="plus" />Novo cartão</button>
    </div>
    <Feedback success={message} error={!editing && !closing ? error : ""} />

    {cards.length ? <ul className="sales-card-grid" aria-label="Cartões de venda">
      {cards.map((card) => <li className="sales-card-tile" key={card.id} data-status={card.status}>
        <div className="sales-card-head">
          <h2 className="sales-card-name">{card.name}</h2>
          {statusPill(card)}
        </div>
        <p className="sales-card-validity">{validityText(card)}</p>
        <ul className="sales-card-plans" aria-label={`Planos de ${card.name}`}>{card.plans.length ? card.plans.map((plan) => <li key={plan.id}>{plan.label}</li>) : <li>Nenhum plano ativo</li>}</ul>
        <dl className="sales-card-facts">
          <div><dt>Cadastros</dt><dd>{card.signups}</dd></div>
          <div><dt>Criado por</dt><dd>{card.createdBy}</dd></div>
        </dl>
        <div className="sales-card-actions">
          {card.status === "active" ? <Link className="btn btn-primary" href={`/admin/vendas/cartoes/${card.id}`}><Icon name="eye" />Exibir QR Code</Link> : <button className="btn btn-secondary" type="button" onClick={() => openEdit(card)}>Reabrir</button>}
          <MenuButton label={`Mais ações de ${card.name}`} items={[
            { label: "Editar", icon: "edit", onSelect: () => openEdit(card) },
            ...(card.status === "active" ? [{ label: "Copiar link", icon: "copy" as const, onSelect: () => { void copyLink(card); } }, { label: "Encerrar agora", icon: "close" as const, tone: "danger" as const, onSelect: () => { setError(""); setClosing(card); } }] : []),
          ]} />
        </div>
      </li>)}
    </ul> : <div className="state-empty"><strong>Nenhum cartão ainda.</strong><p>Crie um cartão para deixar um QR Code em exibição no próximo evento.</p></div>}

    {editing ? <Sheet open onClose={() => { setEditing(null); setError(""); }} title={editing.card ? `Editar ${editing.card.name}` : "Novo cartão de venda"} className="sheet-wide">
      <form className="sheet-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <div className="form-field"><label htmlFor="card-name-input">Nome do cartão</label><input className="control" id="card-name-input" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="Ex.: Corrida da Orla 2026" data-autofocus /></div>
        <div className="form-field">
          <label htmlFor="card-expires">Válido até</label>
          <input className="control" id="card-expires" type="datetime-local" value={expiresAt} min={minInput} max={maxInput} onChange={(event) => setExpiresAt(event.target.value)} aria-describedby="card-expires-hint" />
          <p className="field-hint" id="card-expires-hint">Depois desse horário o QR Code para de funcionar e não mostra mais os planos. Máximo de {MAX_DAYS} dias.</p>
        </div>
        <fieldset className="plan-fieldset">
          <legend className="form-label">Planos disponíveis no QR Code</legend>
          {publicPlans.length ? <><p className="sales-card-group">Planos públicos</p><div className="sales-card-checks">{planChecks(publicPlans)}</div></> : null}
          {hiddenPlans.length ? <><p className="sales-card-group">Planos ocultos</p><div className="sales-card-checks">{planChecks(hiddenPlans)}</div></> : null}
        </fieldset>
        {selectedHidden ? <p className="message" data-tone="info"><Icon name="info" /><span>Os planos ocultos escolhidos aparecem para quem escanear este QR Code, só enquanto ele valer.</span></p> : null}
        {selectedCourtesy ? <div className="message" data-tone="warning"><Icon name="alert" /><div><strong>Cortesia no cartão</strong><p>Qualquer pessoa que escanear até o fim da validade pode entrar sem pagar.</p></div></div> : null}
        <Feedback error={error} />
        <div className="btn-row btn-row-split sheet-actions">
          <button className="btn btn-quiet" type="button" onClick={() => { setEditing(null); setError(""); }} disabled={pending}>Cancelar</button>
          <button className="btn btn-primary" type="submit" disabled={pending} aria-busy={pending}>{pending ? "Salvando..." : editing.card ? "Salvar cartão" : "Criar cartão"}</button>
        </div>
      </form>
    </Sheet> : null}

    {closing ? <Sheet open onClose={() => setClosing(null)} title={`Encerrar ${closing.name}?`}>
      <div className="sheet-form">
        <p className="message" data-tone="warning"><Icon name="alert" /><span>O QR Code para de funcionar na hora, inclusive na tela de exibição. Para reabrir, edite a validade.</span></p>
        <Feedback error={error} />
        <div className="btn-row btn-row-split sheet-actions"><button className="btn btn-secondary" type="button" onClick={() => setClosing(null)} disabled={pending}>Cancelar</button><button className="btn btn-danger-solid" type="button" onClick={confirmClose} disabled={pending} aria-busy={pending}>{pending ? "Encerrando..." : "Encerrar agora"}</button></div>
      </div>
    </Sheet> : null}
  </div>;
}
