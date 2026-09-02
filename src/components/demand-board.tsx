"use client";

import { useRef, useState } from "react";

type Column = { id: string; name: string; position: number };
type Person = { id: string; name: string; email: string };
type Demand = { id: string; title: string; description: string | null; columnId: string; scheduledAt: string | null; assignees: { user: Person }[] };

const datetimeValue = (value: string | null) => value ? new Date(value).toISOString().slice(0, 16) : "";
const dateLabel = (value: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "Sem horário";
const initials = (name: string) => name.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2);

export function DemandBoard({ areaId, areaName, initialColumns, initialDemands, people, initialMembers, canManageMembers }: { areaId: string; areaName: string; initialColumns: Column[]; initialDemands: Demand[]; people: Person[]; initialMembers: Person[]; canManageMembers: boolean }) {
  const [columns, setColumns] = useState(initialColumns);
  const [demands, setDemands] = useState(initialDemands);
  const [selected, setSelected] = useState<Demand | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [manageMembersOpen, setManageMembersOpen] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [newColumnName, setNewColumnName] = useState("");
  const [columnNames, setColumnNames] = useState<Record<string, string>>({});
  const [memberIds, setMemberIds] = useState(initialMembers.map((member) => member.id));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emptyForm = { title: "", description: "", scheduledAt: "", assigneeIds: [] as string[], columnId: initialColumns[0]?.id ?? "" };
  const [form, setForm] = useState(emptyForm);
  const search = assigneeSearch.trim().toLocaleLowerCase("pt-BR");
  const matchingPeople = people.filter((person) => !search || (person.name + " " + person.email).toLocaleLowerCase("pt-BR").includes(search));
  const selectedPeople = people.filter((person) => form.assigneeIds.includes(person.id));

  function startCreate(columnId = columns[0]?.id ?? "") { setForm({ ...emptyForm, columnId }); setSelected(null); setCreateOpen(true); setMessage(""); setAssigneeSearch(""); }
  function startEdit(demand: Demand) { setSelected(demand); setCreateOpen(true); setMessage(""); setAssigneeSearch(""); setForm({ title: demand.title, description: demand.description ?? "", scheduledAt: datetimeValue(demand.scheduledAt), assigneeIds: demand.assignees.map((item) => item.user.id), columnId: demand.columnId }); }
  function closeEditor() { setCreateOpen(false); setSelected(null); setMessage(""); }
  function toggleAssignee(id: string) { setForm((current) => ({ ...current, assigneeIds: current.assigneeIds.includes(id) ? current.assigneeIds.filter((item) => item !== id) : [...current.assigneeIds, id] })); }
  function pointerDown(id: string, target: HTMLButtonElement, pointerId: number) { timer.current = setTimeout(() => { if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId); setDragging(id); navigator.vibrate?.(20); }, 2000); }
  function pointerUp() { if (timer.current) clearTimeout(timer.current); timer.current = null; setDragging(null); }
  function toggleMember(id: string) { setMemberIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }

  async function saveDemand() {
    if (!form.title.trim() || !form.columnId) { setMessage("Dê um título e escolha uma coluna."); return; }
    const response = await fetch("/api/demandas", { method: selected ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...(selected ? { id: selected.id } : { workAreaId: areaId }), ...form, scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null }) });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error ?? "Não foi possível salvar a atividade."); return; }
    setDemands((current) => selected ? current.map((demand) => demand.id === selected.id ? data.demand : demand) : [...current, data.demand]);
    closeEditor();
  }
  async function move(id: string, columnId: string) {
    const current = demands.find((demand) => demand.id === id); if (!current || current.columnId === columnId) return;
    setDemands((items) => items.map((demand) => demand.id === id ? { ...demand, columnId } : demand));
    const response = await fetch("/api/demandas", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, columnId }) });
    if (!response.ok) { setDemands((items) => items.map((demand) => demand.id === id ? current : demand)); setMessage("Não foi possível mover a atividade."); }
  }
  async function addColumn() {
    const name = newColumnName.trim(); if (!name) return;
    const response = await fetch("/api/demandas/columns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workAreaId: areaId, name }) });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error ?? "Não foi possível criar a coluna."); return; }
    setColumns((items) => [...items, data.column]); setNewColumnName(""); setMessage("");
  }
  async function renameColumn(column: Column) {
    const name = (columnNames[column.id] ?? column.name).trim(); if (!name || name === column.name) return;
    const response = await fetch("/api/demandas/columns", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: column.id, name }) });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error ?? "Não foi possível atualizar a coluna."); return; }
    setColumns((items) => items.map((item) => item.id === column.id ? data.column : item)); setColumnNames((items) => ({ ...items, [column.id]: data.column.name })); setMessage("");
  }
  async function deleteColumn(column: Column) {
    const response = await fetch("/api/demandas/columns?id=" + encodeURIComponent(column.id), { method: "DELETE" }); const data = await response.json();
    if (!response.ok) { setMessage(data.error ?? "Não foi possível excluir a coluna."); return; }
    setDemands((items) => items.map((demand) => demand.columnId === column.id ? { ...demand, columnId: data.movedToColumnId } : demand)); setColumns((items) => items.filter((item) => item.id !== column.id)); setMessage("");
  }
  async function saveMembers() {
    const response = await fetch("/api/demandas/members", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workAreaId: areaId, memberIds }) });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error ?? "Não foi possível atualizar o acesso ao quadro."); return; }
    setMemberIds(data.members.map((member: Person) => member.id)); setManageMembersOpen(false); setMessage("");
  }

  return <section className="demand-board">
    <header className="demand-board-head"><div><p className="eyebrow">Área de trabalho</p><h1>{areaName}.</h1><p>Pressione uma atividade por dois segundos para movê-la entre as colunas.</p></div><div className="demand-board-actions">{canManageMembers ? <button className="button button-quiet" type="button" onClick={() => setManageMembersOpen(true)}>Pessoas do quadro</button> : null}<button className="button button-quiet" type="button" onClick={() => setManageOpen(true)}>Editar colunas</button><button className="button button-dark" type="button" onClick={() => startCreate()}>Nova demanda</button></div></header>
    {message && !createOpen && !manageOpen ? <p className="error-message">{message}</p> : null}
    <div className="demand-columns-scroll" aria-label="Quadro de demandas"><div className="demand-columns">{columns.map((column) => <section className={"demand-column " + (dragging ? "is-drop-target" : "")} key={column.id} onPointerEnter={() => dragging ? void move(dragging, column.id) : undefined} onPointerUp={pointerUp}><header><strong>{column.name}</strong><span>{demands.filter((demand) => demand.columnId === column.id).length}</span></header><div className="demand-column-cards">{demands.filter((demand) => demand.columnId === column.id).map((demand) => <button className={"demand-card " + (dragging === demand.id ? "dragging" : "")} key={demand.id} type="button" onPointerDown={(event) => pointerDown(demand.id, event.currentTarget, event.pointerId)} onPointerUp={pointerUp} onPointerCancel={pointerUp} onClick={() => !dragging && startEdit(demand)}><strong>{demand.title}</strong>{demand.description ? <p>{demand.description}</p> : null}<small>{dateLabel(demand.scheduledAt)}</small>{demand.assignees.length ? <div className="demand-avatars">{demand.assignees.map(({ user }) => <span title={user.name} key={user.id}>{initials(user.name)}</span>)}</div> : null}</button>)}</div><button className="demand-add-inline" type="button" onClick={() => startCreate(column.id)}>+ Adicionar</button></section>)}</div></div>
    {createOpen ? <div className="demand-editor-layer" role="dialog" aria-modal="true" aria-label="Editor de demanda"><button className="demand-editor-backdrop" type="button" onClick={closeEditor} aria-label="Fechar" /><section className="demand-editor"><div className="panel-heading"><div><p className="eyebrow">{selected ? "Editar demanda" : "Nova demanda"}</p><h2>{selected ? "Ajuste a atividade" : "O que precisa acontecer?"}</h2></div><button className="button button-quiet" type="button" onClick={closeEditor}>Fechar</button></div><div className="field"><label htmlFor="demand-title">Atividade</label><input id="demand-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} autoFocus /></div><div className="field"><label htmlFor="demand-description">Detalhes</label><textarea id="demand-description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={4} /></div><div className="demand-editor-grid"><div className="field"><label htmlFor="demand-column">Coluna</label><select id="demand-column" value={form.columnId} onChange={(event) => setForm({ ...form, columnId: event.target.value })}>{columns.map((column) => <option key={column.id} value={column.id}>{column.name}</option>)}</select></div><div className="field"><label htmlFor="demand-time">Data e horário</label><input id="demand-time" type="datetime-local" value={form.scheduledAt} onChange={(event) => setForm({ ...form, scheduledAt: event.target.value })} /></div></div><fieldset className="demand-assignees"><legend>Responsáveis</legend><div className="assignee-search"><label htmlFor="demand-assignee-search">Buscar colaborador</label><input id="demand-assignee-search" type="search" placeholder="Nome ou e-mail" value={assigneeSearch} onChange={(event) => setAssigneeSearch(event.target.value)} /></div>{selectedPeople.length ? <div className="selected-assignees">{selectedPeople.map((person) => <button type="button" key={person.id} onClick={() => toggleAssignee(person.id)}><span>{initials(person.name)}</span>{person.name}<b aria-label={"Remover " + person.name}>×</b></button>)}</div> : <p className="assignee-empty">Nenhum responsável selecionado.</p>}<div className="assignee-options">{matchingPeople.length ? matchingPeople.map((person) => { const isSelected = form.assigneeIds.includes(person.id); return <button className={isSelected ? "selected" : ""} type="button" key={person.id} onClick={() => toggleAssignee(person.id)} aria-pressed={isSelected}><span>{initials(person.name)}</span><strong>{person.name}</strong><small>{person.email}</small><i>{isSelected ? "✓" : "+"}</i></button>; }) : <p>Nenhum colaborador encontrado.</p>}</div></fieldset>{message ? <p className="error-message">{message}</p> : null}<div className="creation-actions"><button className="button button-dark" type="button" onClick={saveDemand}>{selected ? "Salvar alterações" : "Criar demanda"}</button></div></section></div> : null}
    {manageOpen ? <div className="demand-editor-layer" role="dialog" aria-modal="true" aria-label="Editar colunas"><button className="demand-editor-backdrop" type="button" onClick={() => setManageOpen(false)} aria-label="Fechar" /><section className="demand-editor column-editor"><div className="panel-heading"><div><p className="eyebrow">Quadro</p><h2>Colunas</h2><p>Crie, renomeie ou remova colunas. Ao excluir, as demandas seguem para a próxima coluna disponível.</p></div><button className="button button-quiet" type="button" onClick={() => setManageOpen(false)}>Fechar</button></div><div className="column-editor-list">{columns.map((column) => <div key={column.id}><input aria-label={"Nome da coluna " + column.name} value={columnNames[column.id] ?? column.name} onChange={(event) => setColumnNames((items) => ({ ...items, [column.id]: event.target.value }))} /><button className="button button-secondary" type="button" onClick={() => renameColumn(column)}>Salvar</button><button className="button button-danger-quiet" type="button" onClick={() => deleteColumn(column)}>Excluir</button></div>)}</div><div className="column-add"><input aria-label="Nome da nova coluna" placeholder="Nova coluna" value={newColumnName} onChange={(event) => setNewColumnName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void addColumn()} /><button className="button button-dark" type="button" onClick={addColumn}>+ Coluna</button></div>{message ? <p className="error-message">{message}</p> : null}</section></div> : null}
    {manageMembersOpen ? <div className="demand-editor-layer" role="dialog" aria-modal="true" aria-label="Pessoas do quadro"><button className="demand-editor-backdrop" type="button" onClick={() => setManageMembersOpen(false)} aria-label="Fechar" /><section className="demand-editor member-editor"><div className="panel-heading"><div><p className="eyebrow">Acesso ao quadro</p><h2>Pessoas do quadro</h2><p>Somente as pessoas selecionadas poderão abrir e movimentar demandas aqui.</p></div><button className="button button-quiet" type="button" onClick={() => setManageMembersOpen(false)}>Fechar</button></div><div className="member-editor-list">{people.map((person) => <label key={person.id}><input type="checkbox" checked={memberIds.includes(person.id)} onChange={() => toggleMember(person.id)} /><span>{initials(person.name)}</span><strong>{person.name}</strong><small>{person.email}</small></label>)}</div>{message ? <p className="error-message">{message}</p> : null}<div className="creation-actions"><button className="button button-dark" type="button" onClick={saveMembers}>Salvar acesso</button></div></section></div> : null}
  </section>;
}
