"use client";

import { useRef, useState } from "react";

type Column = "OPEN" | "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY";
type Person = { id: string; name: string; email: string };
type Demand = { id: string; title: string; description: string | null; column: Column; scheduledAt: string | null; assignees: { user: Person }[] };

const columns: Array<{ id: Column; label: string }> = [
  { id: "OPEN", label: "Em aberto" }, { id: "MONDAY", label: "Segunda" }, { id: "TUESDAY", label: "Terça" },
  { id: "WEDNESDAY", label: "Quarta" }, { id: "THURSDAY", label: "Quinta" }, { id: "FRIDAY", label: "Sexta" },
];
const datetimeValue = (value: string | null) => value ? new Date(value).toISOString().slice(0, 16) : "";
const dateLabel = (value: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "Sem horário";
const initials = (name: string) => name.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2);

export function DemandBoard({ areaId, areaName, initialDemands, people }: { areaId: string; areaName: string; initialDemands: Demand[]; people: Person[] }) {
  const [demands, setDemands] = useState(initialDemands);
  const [selected, setSelected] = useState<Demand | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emptyForm = { title: "", description: "", scheduledAt: "", assigneeIds: [] as string[], column: "OPEN" as Column };
  const [form, setForm] = useState(emptyForm);
  const normalizedSearch = assigneeSearch.trim().toLocaleLowerCase("pt-BR");
  const matchingPeople = people.filter((person) => !normalizedSearch || `${person.name} ${person.email}`.toLocaleLowerCase("pt-BR").includes(normalizedSearch));
  const selectedPeople = people.filter((person) => form.assigneeIds.includes(person.id));

  function startCreate(column: Column = "OPEN") {
    setForm({ ...emptyForm, column }); setSelected(null); setCreateOpen(true); setMessage(""); setAssigneeSearch("");
  }
  function startEdit(demand: Demand) {
    setSelected(demand); setCreateOpen(true); setMessage(""); setAssigneeSearch("");
    setForm({ title: demand.title, description: demand.description ?? "", scheduledAt: datetimeValue(demand.scheduledAt), assigneeIds: demand.assignees.map((item) => item.user.id), column: demand.column });
  }
  function closeEditor() { setCreateOpen(false); setSelected(null); setMessage(""); }
  function toggleAssignee(id: string) { setForm((current) => ({ ...current, assigneeIds: current.assigneeIds.includes(id) ? current.assigneeIds.filter((item) => item !== id) : [...current.assigneeIds, id] })); }

  async function save() {
    if (!form.title.trim()) { setMessage("Dê um título à atividade."); return; }
    const response = await fetch("/api/demandas", { method: selected ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...(selected ? { id: selected.id } : { workAreaId: areaId }), ...form, scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null }) });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error ?? "Não foi possível salvar a atividade."); return; }
    setDemands((current) => selected ? current.map((demand) => demand.id === selected.id ? data.demand : demand) : [...current, data.demand]);
    closeEditor();
  }

  async function move(id: string, column: Column) {
    const current = demands.find((demand) => demand.id === id); if (!current || current.column === column) return;
    setDemands((items) => items.map((demand) => demand.id === id ? { ...demand, column } : demand));
    const response = await fetch("/api/demandas", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, column }) });
    if (!response.ok) { setDemands((items) => items.map((demand) => demand.id === id ? current : demand)); setMessage("Não foi possível mover a atividade."); }
  }

  function pointerDown(id: string, target: HTMLButtonElement, pointerId: number) {
    timer.current = setTimeout(() => { if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId); setDragging(id); navigator.vibrate?.(20); }, 2000);
  }
  function pointerUp() { if (timer.current) clearTimeout(timer.current); timer.current = null; setDragging(null); }

  return <section className="demand-board">
    <header className="demand-board-head"><div><p className="eyebrow">Área de trabalho</p><h1>{areaName}.</h1><p>Pressione uma atividade por dois segundos para movê-la entre os dias.</p></div><button className="button button-dark" type="button" onClick={() => startCreate()}>Nova demanda</button></header>
    {message && !createOpen ? <p className="error-message">{message}</p> : null}
    <div className="demand-columns-scroll" aria-label="Quadro semanal de demandas"><div className="demand-columns">{columns.map((column) => <section className={`demand-column ${dragging ? "is-drop-target" : ""}`} key={column.id} onPointerEnter={() => dragging ? void move(dragging, column.id) : undefined} onPointerUp={pointerUp}><header><strong>{column.label}</strong><span>{demands.filter((demand) => demand.column === column.id).length}</span></header><div className="demand-column-cards">{demands.filter((demand) => demand.column === column.id).map((demand) => <button className={`demand-card ${dragging === demand.id ? "dragging" : ""}`} key={demand.id} type="button" onPointerDown={(event) => pointerDown(demand.id, event.currentTarget, event.pointerId)} onPointerUp={pointerUp} onPointerCancel={pointerUp} onClick={() => !dragging && startEdit(demand)}><strong>{demand.title}</strong>{demand.description ? <p>{demand.description}</p> : null}<small>{dateLabel(demand.scheduledAt)}</small>{demand.assignees.length ? <div className="demand-avatars">{demand.assignees.map(({ user }) => <span title={user.name} key={user.id}>{initials(user.name)}</span>)}</div> : null}</button>)}</div><button className="demand-add-inline" type="button" onClick={() => startCreate(column.id)}>+ Adicionar</button></section>)}</div></div>
    {createOpen ? <div className="demand-editor-layer" role="dialog" aria-modal="true" aria-label="Editor de demanda"><button className="demand-editor-backdrop" type="button" onClick={closeEditor} aria-label="Fechar" /><section className="demand-editor"><div className="panel-heading"><div><p className="eyebrow">{selected ? "Editar demanda" : "Nova demanda"}</p><h2>{selected ? "Ajuste a atividade" : "O que precisa acontecer?"}</h2></div><button className="button button-quiet" type="button" onClick={closeEditor}>Fechar</button></div><div className="field"><label htmlFor="demand-title">Atividade</label><input id="demand-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} autoFocus /></div><div className="field"><label htmlFor="demand-description">Detalhes</label><textarea id="demand-description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={4} /></div><div className="demand-editor-grid"><div className="field"><label htmlFor="demand-column">Coluna</label><select id="demand-column" value={form.column} onChange={(event) => setForm({ ...form, column: event.target.value as Column })}>{columns.map((column) => <option key={column.id} value={column.id}>{column.label}</option>)}</select></div><div className="field"><label htmlFor="demand-time">Data e horário</label><input id="demand-time" type="datetime-local" value={form.scheduledAt} onChange={(event) => setForm({ ...form, scheduledAt: event.target.value })} /></div></div><fieldset className="demand-assignees"><legend>Responsáveis</legend><div className="assignee-search"><label htmlFor="demand-assignee-search">Buscar colaborador</label><input id="demand-assignee-search" type="search" placeholder="Nome ou e-mail" value={assigneeSearch} onChange={(event) => setAssigneeSearch(event.target.value)} /></div>{selectedPeople.length ? <div className="selected-assignees">{selectedPeople.map((person) => <button type="button" key={person.id} onClick={() => toggleAssignee(person.id)}><span>{initials(person.name)}</span>{person.name}<b aria-label={`Remover ${person.name}`}>×</b></button>)}</div> : <p className="assignee-empty">Nenhum responsável selecionado.</p>}<div className="assignee-options">{matchingPeople.length ? matchingPeople.map((person) => { const isSelected = form.assigneeIds.includes(person.id); return <button className={isSelected ? "selected" : ""} type="button" key={person.id} onClick={() => toggleAssignee(person.id)} aria-pressed={isSelected}><span>{initials(person.name)}</span><strong>{person.name}</strong><small>{person.email}</small><i>{isSelected ? "✓" : "+"}</i></button>; }) : <p>Nenhum colaborador encontrado.</p>}</div></fieldset>{message ? <p className="error-message">{message}</p> : null}<div className="creation-actions"><button className="button button-dark" type="button" onClick={save}>{selected ? "Salvar alterações" : "Criar demanda"}</button></div></section></div> : null}
  </section>;
}
