"use client";

import { useRef, useState } from "react";

type Column = { id: string; name: string; position: number };
type Folder = { id: string; name: string };
type Person = { id: string; name: string; email: string };
type Demand = { id: string; title: string; description: string | null; columnId: string; scheduledAt: string | null; completedAt: string | null; assignees: { user: Person }[] };
type ArchivedDemand = Demand & { folder: Folder | null };

const datetimeValue = (value: string | null) => value ? new Date(value).toISOString().slice(0, 16) : "";
const dateLabel = (value: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "Sem horário";
const initials = (name: string) => name.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2);

export function DemandBoard({ areaId, areaName, initialColumns, initialDemands, initialFolders, people, initialMembers, canManageMembers }: { areaId: string; areaName: string; initialColumns: Column[]; initialDemands: Demand[]; initialFolders: Folder[]; people: Person[]; initialMembers: Person[]; canManageMembers: boolean }) {
  const [columns, setColumns] = useState(initialColumns);
  const [demands, setDemands] = useState(initialDemands);
  const [folders, setFolders] = useState(initialFolders);
  const [selected, setSelected] = useState<Demand | null>(null);
  const [viewing, setViewing] = useState<Demand | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [manageMembersOpen, setManageMembersOpen] = useState(false);
  const [foldersOpen, setFoldersOpen] = useState(false);
  const [boardMenuOpen, setBoardMenuOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveListOpen, setArchiveListOpen] = useState(false);
  const [archivedDemands, setArchivedDemands] = useState<ArchivedDemand[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [newColumnName, setNewColumnName] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [archiveFolderId, setArchiveFolderId] = useState("");
  const [columnNames, setColumnNames] = useState<Record<string, string>>({});
  const [memberIds, setMemberIds] = useState(initialMembers.map((member) => member.id));
  const createRequestKey = useRef("");
  const emptyForm = { title: "", description: "", scheduledAt: "", assigneeIds: [] as string[], columnId: initialColumns[0]?.id ?? "" };
  const [form, setForm] = useState(emptyForm);
  const search = assigneeSearch.trim().toLocaleLowerCase("pt-BR");
  const matchingPeople = people.filter((person) => !search || (person.name + " " + person.email).toLocaleLowerCase("pt-BR").includes(search));
  const selectedPeople = people.filter((person) => form.assigneeIds.includes(person.id));

  function startCreate(columnId = columns[0]?.id ?? "") {
    createRequestKey.current = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "demand-" + Date.now() + "-" + Math.random();
    setForm({ ...emptyForm, columnId }); setSelected(null); setCreateOpen(true); setMessage(""); setAssigneeSearch("");
  }
  function startEdit(demand: Demand) { setSelected(demand); setCreateOpen(true); setMessage(""); setAssigneeSearch(""); setForm({ title: demand.title, description: demand.description ?? "", scheduledAt: datetimeValue(demand.scheduledAt), assigneeIds: demand.assignees.map((item) => item.user.id), columnId: demand.columnId }); }
  function closeEditor() { setCreateOpen(false); setSelected(null); setMessage(""); }
  function toggleAssignee(id: string) { setForm((current) => ({ ...current, assigneeIds: current.assigneeIds.includes(id) ? current.assigneeIds.filter((item) => item !== id) : [...current.assigneeIds, id] })); }
  function toggleMember(id: string) { setMemberIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }

  async function saveDemand() {
    if (saving) return;
    if (!form.title.trim() || !form.columnId) { setMessage("Dê um título e escolha uma coluna."); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/demandas", { method: selected ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...(selected ? { id: selected.id } : { workAreaId: areaId, requestKey: createRequestKey.current }), ...form, scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null }) });
      const data = await response.json();
      if (!response.ok) { setMessage(data.error ?? "Não foi possível salvar a atividade."); return; }
      setDemands((current) => selected ? current.map((demand) => demand.id === selected.id ? data.demand : demand) : current.some((demand) => demand.id === data.demand.id) ? current : [...current, data.demand]);
      closeEditor();
    } finally { setSaving(false); }
  }
  async function move(id: string, columnId: string) {
    const current = demands.find((demand) => demand.id === id); if (!current || current.columnId === columnId) return;
    setDemands((items) => items.map((demand) => demand.id === id ? { ...demand, columnId } : demand));
    const response = await fetch("/api/demandas", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, columnId }) });
    if (!response.ok) { setDemands((items) => items.map((demand) => demand.id === id ? current : demand)); setMessage("Não foi possível mover a atividade."); }
  }
  async function updateViewed(data: Record<string, unknown>) {
    if (!viewing || saving) return false;
    setSaving(true);
    try {
      const response = await fetch("/api/demandas", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: viewing.id, ...data }) });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error ?? "Não foi possível atualizar a demanda."); return false; }
      setDemands((items) => items.map((demand) => demand.id === result.demand.id ? result.demand : demand)); setViewing(result.demand); return true;
    } finally { setSaving(false); }
  }
  async function deleteViewed() {
    if (!viewing || saving || !window.confirm("Excluir esta demanda? Esta ação não pode ser desfeita.")) return;
    setSaving(true);
    try {
      const response = await fetch("/api/demandas?id=" + encodeURIComponent(viewing.id), { method: "DELETE" }); const data = await response.json();
      if (!response.ok) { setMessage(data.error ?? "Não foi possível excluir a demanda."); return; }
      setDemands((items) => items.filter((demand) => demand.id !== viewing.id)); setViewing(null);
    } finally { setSaving(false); }
  }
  async function createFolder() {
    const name = newFolderName.trim(); if (!name || saving) return;
    setSaving(true);
    try {
      const response = await fetch("/api/demandas/folders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workAreaId: areaId, name }) }); const data = await response.json();
      if (!response.ok) { setMessage(data.error ?? "Não foi possível criar a pasta."); return; }
      setFolders((items) => [...items, data.folder].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))); setArchiveFolderId(data.folder.id); setNewFolderName("");
    } finally { setSaving(false); }
  }
  async function archiveViewed() {
    if (!archiveFolderId || !viewing) { setMessage("Escolha uma pasta para arquivar."); return; }
    const id = viewing.id; const updated = await updateViewed({ folderId: archiveFolderId });
    if (updated) { setDemands((items) => items.filter((demand) => demand.id !== id)); setViewing(null); setArchiveOpen(false); }
  }
  async function openArchiveList() {
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/demandas?workAreaId=" + encodeURIComponent(areaId)); const data = await response.json();
      if (!response.ok) { setMessage(data.error ?? "Não foi possível carregar o arquivo."); return; }
      setArchivedDemands(data.demands); setArchiveListOpen(true);
    } finally { setSaving(false); }
  }
  async function restoreArchived(demand: ArchivedDemand) {
    setSaving(true);
    try {
      const response = await fetch("/api/demandas", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: demand.id, folderId: null }) }); const data = await response.json();
      if (!response.ok) { setMessage(data.error ?? "Não foi possível restaurar a demanda."); return; }
      setArchivedDemands((items) => items.filter((item) => item.id !== demand.id)); setDemands((items) => [...items, data.demand]);
    } finally { setSaving(false); }
  }
  async function addColumn() {
    const name = newColumnName.trim(); if (!name) return;
    const response = await fetch("/api/demandas/columns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workAreaId: areaId, name }) }); const data = await response.json();
    if (!response.ok) { setMessage(data.error ?? "Não foi possível criar a coluna."); return; }
    setColumns((items) => [...items, data.column]); setNewColumnName(""); setMessage("");
  }
  async function renameColumn(column: Column) {
    const name = (columnNames[column.id] ?? column.name).trim(); if (!name || name === column.name) return;
    const response = await fetch("/api/demandas/columns", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: column.id, name }) }); const data = await response.json();
    if (!response.ok) { setMessage(data.error ?? "Não foi possível atualizar a coluna."); return; }
    setColumns((items) => items.map((item) => item.id === column.id ? data.column : item)); setColumnNames((items) => ({ ...items, [column.id]: data.column.name })); setMessage("");
  }
  async function deleteColumn(column: Column) {
    const response = await fetch("/api/demandas/columns?id=" + encodeURIComponent(column.id), { method: "DELETE" }); const data = await response.json();
    if (!response.ok) { setMessage(data.error ?? "Não foi possível excluir a coluna."); return; }
    setDemands((items) => items.map((demand) => demand.columnId === column.id ? { ...demand, columnId: data.movedToColumnId } : demand)); setColumns((items) => items.filter((item) => item.id !== column.id)); setMessage("");
  }
  async function saveMembers() {
    const response = await fetch("/api/demandas/members", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workAreaId: areaId, memberIds }) }); const data = await response.json();
    if (!response.ok) { setMessage(data.error ?? "Não foi possível atualizar o acesso ao quadro."); return; }
    setMemberIds(data.members.map((member: Person) => member.id)); setManageMembersOpen(false); setMessage("");
  }

  return <section className="demand-board">
    <header className="demand-board-head"><div><p className="eyebrow">Área de trabalho</p><h1>{areaName}.</h1><p>Use as setas em cada demanda para movê-la entre as colunas.</p></div><div className="demand-board-actions"><button className="button button-dark" type="button" onClick={() => startCreate()}>Nova demanda</button><div className="demand-settings"><button className="demand-settings-trigger" type="button" aria-label="Opções do quadro" title="Opções do quadro" aria-expanded={boardMenuOpen} onClick={() => setBoardMenuOpen((open) => !open)}>⋮</button>{boardMenuOpen ? <div className="demand-settings-menu"><button type="button" onClick={() => { setBoardMenuOpen(false); void openArchiveList(); }}>Arquivo</button><button type="button" onClick={() => { setBoardMenuOpen(false); setFoldersOpen(true); }}>Pastas</button>{canManageMembers ? <button type="button" onClick={() => { setBoardMenuOpen(false); setManageMembersOpen(true); }}>Pessoas do quadro</button> : null}<button type="button" onClick={() => { setBoardMenuOpen(false); setManageOpen(true); }}>Editar colunas</button></div> : null}</div></div></header>
    {message && !createOpen && !manageOpen && !viewing ? <p className="error-message">{message}</p> : null}
    <div className="demand-columns-scroll" aria-label="Quadro de demandas"><div className="demand-columns">{columns.map((column, columnIndex) => <section className="demand-column" key={column.id}><header><strong>{column.name}</strong><span>{demands.filter((demand) => demand.columnId === column.id).length}</span></header><div className="demand-column-cards">{demands.filter((demand) => demand.columnId === column.id).map((demand) => <article className={"demand-card " + (demand.completedAt ? "completed" : "")} key={demand.id}><button className="demand-card-open" type="button" onClick={() => { setViewing(demand); setMessage(""); }}><strong>{demand.title}</strong>{demand.description ? <p>{demand.description}</p> : null}<small>{demand.completedAt ? "Concluída · " : ""}{dateLabel(demand.scheduledAt)}</small>{demand.assignees.length ? <div className="demand-avatars">{demand.assignees.map(({ user }) => <span title={user.name} key={user.id}>{initials(user.name)}</span>)}</div> : null}</button><div className="demand-move-actions"><button type="button" onClick={() => void move(demand.id, columns[columnIndex - 1].id)} disabled={columnIndex === 0} aria-label="Mover para a coluna anterior">←</button><button type="button" onClick={() => void move(demand.id, columns[columnIndex + 1].id)} disabled={columnIndex === columns.length - 1} aria-label="Mover para a próxima coluna">→</button></div></article>)}</div><button className="demand-add-inline" type="button" onClick={() => startCreate(column.id)}>+ Adicionar</button></section>)}</div></div>
    {createOpen ? <Editor selected={selected} form={form} setForm={setForm} columns={columns} message={message} saving={saving} search={assigneeSearch} setSearch={setAssigneeSearch} people={matchingPeople} selectedPeople={selectedPeople} toggleAssignee={toggleAssignee} close={closeEditor} save={saveDemand} /> : null}
    {viewing ? <DemandView demand={viewing} message={message} saving={saving} folders={folders} archiveOpen={archiveOpen} archiveFolderId={archiveFolderId} setArchiveFolderId={setArchiveFolderId} close={() => { setViewing(null); setArchiveOpen(false); }} edit={() => { const demand = viewing; setViewing(null); startEdit(demand); }} complete={() => void updateViewed({ completed: !viewing.completedAt })} remove={() => void deleteViewed()} toggleArchive={() => { setArchiveOpen((open) => !open); setMessage(""); }} archive={() => void archiveViewed()} /> : null}
    {archiveListOpen ? <ArchiveList demands={archivedDemands} saving={saving} close={() => setArchiveListOpen(false)} restore={restoreArchived} /> : null}
    {manageOpen ? <ColumnsEditor columns={columns} names={columnNames} setNames={setColumnNames} newName={newColumnName} setNewName={setNewColumnName} message={message} close={() => setManageOpen(false)} rename={renameColumn} remove={deleteColumn} add={addColumn} /> : null}
    {foldersOpen ? <FoldersEditor folders={folders} newName={newFolderName} setNewName={setNewFolderName} saving={saving} message={message} close={() => setFoldersOpen(false)} create={createFolder} /> : null}
    {manageMembersOpen ? <MembersEditor people={people} memberIds={memberIds} toggle={toggleMember} message={message} close={() => setManageMembersOpen(false)} save={saveMembers} /> : null}
  </section>;
}

function Editor({ selected, form, setForm, columns, message, saving, search, setSearch, people, selectedPeople, toggleAssignee, close, save }: { selected: Demand | null; form: { title: string; description: string; scheduledAt: string; assigneeIds: string[]; columnId: string }; setForm: (form: { title: string; description: string; scheduledAt: string; assigneeIds: string[]; columnId: string }) => void; columns: Column[]; message: string; saving: boolean; search: string; setSearch: (value: string) => void; people: Person[]; selectedPeople: Person[]; toggleAssignee: (id: string) => void; close: () => void; save: () => void }) {
  return <div className="demand-editor-layer" role="dialog" aria-modal="true" aria-label="Editor de demanda"><button className="demand-editor-backdrop" type="button" onClick={close} aria-label="Fechar" /><section className="demand-editor"><div className="panel-heading"><div><p className="eyebrow">{selected ? "Editar demanda" : "Nova demanda"}</p><h2>{selected ? "Ajuste a atividade" : "O que precisa acontecer?"}</h2></div><button className="button button-quiet" type="button" onClick={close}>Fechar</button></div><div className="field"><label htmlFor="demand-title">Atividade</label><input id="demand-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} autoFocus /></div><div className="field"><label htmlFor="demand-description">Detalhes</label><textarea id="demand-description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={4} /></div><div className="demand-editor-grid"><div className="field"><label htmlFor="demand-column">Coluna</label><select id="demand-column" value={form.columnId} onChange={(event) => setForm({ ...form, columnId: event.target.value })}>{columns.map((column) => <option key={column.id} value={column.id}>{column.name}</option>)}</select></div><div className="field"><label htmlFor="demand-time">Data e horário</label><input id="demand-time" type="datetime-local" value={form.scheduledAt} onChange={(event) => setForm({ ...form, scheduledAt: event.target.value })} /></div></div><fieldset className="demand-assignees"><legend>Responsáveis</legend><div className="assignee-search"><label htmlFor="demand-assignee-search">Buscar colaborador</label><input id="demand-assignee-search" type="search" placeholder="Nome ou e-mail" value={search} onChange={(event) => setSearch(event.target.value)} /></div>{selectedPeople.length ? <div className="selected-assignees">{selectedPeople.map((person) => <button type="button" key={person.id} onClick={() => toggleAssignee(person.id)}><span>{initials(person.name)}</span>{person.name}<b aria-label={"Remover " + person.name}>×</b></button>)}</div> : <p className="assignee-empty">Nenhum responsável selecionado.</p>}<div className="assignee-options">{people.length ? people.map((person) => { const isSelected = form.assigneeIds.includes(person.id); return <button className={isSelected ? "selected" : ""} type="button" key={person.id} onClick={() => toggleAssignee(person.id)} aria-pressed={isSelected}><span>{initials(person.name)}</span><strong>{person.name}</strong><small>{person.email}</small><i>{isSelected ? "✓" : "+"}</i></button>; }) : <p>Nenhum colaborador encontrado.</p>}</div></fieldset>{message ? <p className="error-message">{message}</p> : null}<div className="creation-actions"><button className="button button-dark" type="button" onClick={save} disabled={saving}>{saving ? "Salvando…" : selected ? "Salvar alterações" : "Criar demanda"}</button></div></section></div>;
}

function DemandView({ demand, message, saving, folders, archiveOpen, archiveFolderId, setArchiveFolderId, close, edit, complete, remove, toggleArchive, archive }: { demand: Demand; message: string; saving: boolean; folders: Folder[]; archiveOpen: boolean; archiveFolderId: string; setArchiveFolderId: (value: string) => void; close: () => void; edit: () => void; complete: () => void; remove: () => void; toggleArchive: () => void; archive: () => void }) {
  return <div className="demand-editor-layer" role="dialog" aria-modal="true" aria-label="Detalhes da demanda"><button className="demand-editor-backdrop" type="button" onClick={close} aria-label="Fechar" /><section className="demand-editor demand-view"><div className="panel-heading"><div><p className="eyebrow">{demand.completedAt ? "Concluída" : "Demanda"}</p><h2>{demand.title}</h2></div><button className="button button-quiet" type="button" onClick={close}>Fechar</button></div><div className="demand-view-copy">{demand.description ? <p>{demand.description}</p> : <p className="muted">Sem detalhes adicionais.</p>}<dl><div><dt>Data e horário</dt><dd>{dateLabel(demand.scheduledAt)}</dd></div><div><dt>Responsáveis</dt><dd>{demand.assignees.length ? demand.assignees.map(({ user }) => user.name).join(", ") : "Nenhum responsável"}</dd></div></dl></div>{message ? <p className="error-message">{message}</p> : null}<div className="demand-view-actions"><button className="button button-secondary" type="button" onClick={edit}>Editar</button><button className="button button-secondary" type="button" onClick={complete} disabled={saving}>{demand.completedAt ? "Reabrir" : "Concluir"}</button><button className="button button-secondary" type="button" onClick={toggleArchive}>Arquivar</button><button className="button button-danger-quiet" type="button" onClick={remove} disabled={saving}>Excluir</button></div>{archiveOpen ? <div className="demand-archive-panel"><p className="eyebrow">Arquivo</p><h3>Escolha uma pasta</h3><div className="field"><label htmlFor="demand-folder">Pasta</label><select id="demand-folder" value={archiveFolderId} onChange={(event) => setArchiveFolderId(event.target.value)}><option value="">Selecione uma pasta</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></div>{folders.length ? null : <p className="muted">Crie uma pasta nas opções do quadro.</p>}<button className="button button-dark" type="button" onClick={archive} disabled={saving || !folders.length}>Arquivar demanda</button></div> : null}</section></div>;
}

function ArchiveList({ demands, saving, close, restore }: { demands: ArchivedDemand[]; saving: boolean; close: () => void; restore: (demand: ArchivedDemand) => Promise<void> }) {
  return <div className="demand-editor-layer" role="dialog" aria-modal="true" aria-label="Arquivo de demandas"><button className="demand-editor-backdrop" type="button" onClick={close} aria-label="Fechar" /><section className="demand-editor"><div className="panel-heading"><div><p className="eyebrow">Arquivo</p><h2>Demandas arquivadas</h2></div><button className="button button-quiet" type="button" onClick={close}>Fechar</button></div><div className="demand-archive-list">{demands.length ? demands.map((demand) => <article key={demand.id}><div><strong>{demand.title}</strong><small>{demand.folder?.name ?? "Sem pasta"} · {dateLabel(demand.scheduledAt)}</small></div><button className="button button-secondary" type="button" onClick={() => void restore(demand)} disabled={saving}>Restaurar</button></article>) : <p className="muted">Nenhuma demanda foi arquivada neste quadro.</p>}</div></section></div>;
}

function FoldersEditor({ folders, newName, setNewName, saving, message, close, create }: { folders: Folder[]; newName: string; setNewName: (value: string) => void; saving: boolean; message: string; close: () => void; create: () => Promise<void> }) {
  return <div className="demand-editor-layer" role="dialog" aria-modal="true" aria-label="Pastas do quadro"><button className="demand-editor-backdrop" type="button" onClick={close} aria-label="Fechar" /><section className="demand-editor"><div className="panel-heading"><div><p className="eyebrow">Organização</p><h2>Pastas do arquivo</h2><p>Use pastas para organizar demandas concluídas ou antigas.</p></div><button className="button button-quiet" type="button" onClick={close}>Fechar</button></div><div className="demand-folder-create demand-folder-create-dialog"><input aria-label="Nome da nova pasta" placeholder="Nome da pasta" value={newName} onChange={(event) => setNewName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void create()} /><button className="button button-dark" type="button" onClick={() => void create()} disabled={saving}>Criar pasta</button></div>{message ? <p className="error-message">{message}</p> : null}<div className="demand-folder-list">{folders.length ? folders.map((folder) => <span key={folder.id}>{folder.name}</span>) : <p className="muted">Ainda não há pastas neste quadro.</p>}</div></section></div>;
}

function ColumnsEditor({ columns, names, setNames, newName, setNewName, message, close, rename, remove, add }: { columns: Column[]; names: Record<string, string>; setNames: (value: Record<string, string>) => void; newName: string; setNewName: (value: string) => void; message: string; close: () => void; rename: (column: Column) => Promise<void>; remove: (column: Column) => Promise<void>; add: () => Promise<void> }) {
  return <div className="demand-editor-layer" role="dialog" aria-modal="true" aria-label="Editar colunas"><button className="demand-editor-backdrop" type="button" onClick={close} aria-label="Fechar" /><section className="demand-editor column-editor"><div className="panel-heading"><div><p className="eyebrow">Quadro</p><h2>Colunas</h2><p>Crie, renomeie ou remova colunas. Ao excluir, as demandas seguem para a próxima coluna disponível.</p></div><button className="button button-quiet" type="button" onClick={close}>Fechar</button></div><div className="column-editor-list">{columns.map((column) => <div key={column.id}><input aria-label={"Nome da coluna " + column.name} value={names[column.id] ?? column.name} onChange={(event) => setNames({ ...names, [column.id]: event.target.value })} /><button className="button button-secondary" type="button" onClick={() => void rename(column)}>Salvar</button><button className="button button-danger-quiet" type="button" onClick={() => void remove(column)}>Excluir</button></div>)}</div><div className="column-add"><input aria-label="Nome da nova coluna" placeholder="Nova coluna" value={newName} onChange={(event) => setNewName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void add()} /><button className="button button-dark" type="button" onClick={() => void add()}>+ Coluna</button></div>{message ? <p className="error-message">{message}</p> : null}</section></div>;
}

function MembersEditor({ people, memberIds, toggle, message, close, save }: { people: Person[]; memberIds: string[]; toggle: (id: string) => void; message: string; close: () => void; save: () => Promise<void> }) {
  return <div className="demand-editor-layer" role="dialog" aria-modal="true" aria-label="Pessoas do quadro"><button className="demand-editor-backdrop" type="button" onClick={close} aria-label="Fechar" /><section className="demand-editor member-editor"><div className="panel-heading"><div><p className="eyebrow">Acesso ao quadro</p><h2>Pessoas do quadro</h2><p>Somente as pessoas selecionadas poderão abrir e movimentar demandas aqui.</p></div><button className="button button-quiet" type="button" onClick={close}>Fechar</button></div><div className="member-editor-list">{people.map((person) => <label key={person.id}><input type="checkbox" checked={memberIds.includes(person.id)} onChange={() => toggle(person.id)} /><span>{initials(person.name)}</span><strong>{person.name}</strong><small>{person.email}</small></label>)}</div>{message ? <p className="error-message">{message}</p> : null}<div className="creation-actions"><button className="button button-dark" type="button" onClick={() => void save()}>Salvar acesso</button></div></section></div>;
}
