"use client";

import { useRef, useState } from "react";
import { Feedback } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { MenuButton } from "@/components/ui/menu-button";
import { PageHeader } from "@/components/ui/page-header";
import { Sheet } from "@/components/ui/sheet";

type Column = { id: string; name: string; position: number };
type Folder = { id: string; name: string };
type Person = { id: string; name: string; email: string };
type Demand = { id: string; title: string; description: string | null; columnId: string; scheduledAt: string | null; completedAt: string | null; assignees: { user: Person }[] };
type ArchivedDemand = Demand & { folder: Folder | null };

// Datas e horários sempre no fuso de Maceió (UTC−3, sem horário de verão).
const maceioParts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Maceio", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const datetimeValue = (value: string | null) => {
  if (!value) return "";
  const parts = Object.fromEntries(maceioParts.formatToParts(new Date(value)).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};
const fromDatetimeValue = (value: string) => value ? new Date(`${value}:00-03:00`).toISOString() : null;
const dateLabel = (value: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Maceio" }).format(new Date(value)) : "Sem horário";
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
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveListOpen, setArchiveListOpen] = useState(false);
  const [archivedDemands, setArchivedDemands] = useState<ArchivedDemand[]>([]);
  const [archiveFolder, setArchiveFolder] = useState<Folder | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [newColumnName, setNewColumnName] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [archiveFolderId, setArchiveFolderId] = useState("");
  const [columnNames, setColumnNames] = useState<Record<string, string>>({});
  const [memberIds, setMemberIds] = useState(initialMembers.map((member) => member.id));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);
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
  function closeView() { setViewing(null); setArchiveOpen(false); setConfirmDelete(false); setMessage(""); }
  function toggleAssignee(id: string) { setForm((current) => ({ ...current, assigneeIds: current.assigneeIds.includes(id) ? current.assigneeIds.filter((item) => item !== id) : [...current.assigneeIds, id] })); }
  function toggleMember(id: string) { setMemberIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }

  async function saveDemand() {
    if (saving) return;
    if (!form.title.trim() || !form.columnId) { setMessage("Dê um título e escolha uma coluna."); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/demandas", { method: selected ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...(selected ? { id: selected.id } : { workAreaId: areaId, requestKey: createRequestKey.current }), ...form, scheduledAt: fromDatetimeValue(form.scheduledAt) }) });
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
    if (!viewing || saving) return;
    setSaving(true);
    try {
      const response = await fetch("/api/demandas?id=" + encodeURIComponent(viewing.id), { method: "DELETE" }); const data = await response.json();
      if (!response.ok) { setMessage(data.error ?? "Não foi possível excluir a demanda."); return; }
      setDemands((items) => items.filter((demand) => demand.id !== viewing.id)); closeView();
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
  async function deleteFolder(folder: Folder) {
    if (saving) return;
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/demandas/folders?id=" + encodeURIComponent(folder.id), { method: "DELETE" }); const data = await response.json();
      if (!response.ok) { setMessage(data.error ?? "Não foi possível excluir a pasta."); return; }
      setFolders((items) => items.filter((item) => item.id !== folder.id));
      setArchivedDemands((items) => items.map((demand) => demand.folder?.id === folder.id ? { ...demand, folder: null } : demand));
      if (archiveFolderId === folder.id) setArchiveFolderId("");
      setFolderToDelete(null);
    } finally { setSaving(false); }
  }
  async function archiveViewed() {
    if (!archiveFolderId || !viewing) { setMessage("Escolha uma pasta para arquivar."); return; }
    const id = viewing.id; const updated = await updateViewed({ folderId: archiveFolderId });
    if (updated) { setDemands((items) => items.filter((demand) => demand.id !== id)); closeView(); }
  }
  async function openArchiveList(folder: Folder | null = null) {
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/demandas?workAreaId=" + encodeURIComponent(areaId)); const data = await response.json();
      if (!response.ok) { setMessage(data.error ?? "Não foi possível carregar o arquivo."); return; }
      setArchivedDemands(data.demands); setArchiveFolder(folder); setArchiveListOpen(true); setFoldersOpen(false);
    } catch { setMessage("Não foi possível carregar o arquivo."); } finally { setSaving(false); }
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

  const boardMenu = [
    { label: "Arquivo", icon: "file" as const, onSelect: () => void openArchiveList() },
    { label: "Pastas", icon: "layers" as const, onSelect: () => { setMessage(""); setFoldersOpen(true); } },
    ...(canManageMembers ? [{ label: "Pessoas do quadro", icon: "users" as const, onSelect: () => { setMessage(""); setManageMembersOpen(true); } }] : []),
    { label: "Editar colunas", icon: "board" as const, onSelect: () => { setMessage(""); setManageOpen(true); } },
  ];
  const anyDialogOpen = createOpen || manageOpen || foldersOpen || manageMembersOpen || archiveListOpen || Boolean(viewing);

  return <section className="board" aria-label={`Quadro ${areaName}`}>
    <PageHeader
      context={{ label: "Áreas de trabalho", href: "/admin/demandas", current: "Quadro" }}
      title={`${areaName}.`}
      lead="Use as setas em cada demanda para movê-la entre as colunas."
      actions={<><button className="btn btn-primary" type="button" onClick={() => startCreate()}><Icon name="plus" />Nova demanda</button><MenuButton label="Opções do quadro" items={boardMenu} /></>}
    />
    <Feedback error={!anyDialogOpen ? message : ""} />
    <div className="board-scroll" role="region" aria-label="Quadro de demandas" tabIndex={0}>
      <div className="board-columns" style={{ "--board-columns": columns.length } as React.CSSProperties}>
        {columns.map((column, columnIndex) => {
          const items = demands.filter((demand) => demand.columnId === column.id);
          const previous = columns[columnIndex - 1];
          const next = columns[columnIndex + 1];
          return <section className="board-column" key={column.id} aria-labelledby={`column-${column.id}`}>
            <header className="board-column-head"><h2 id={`column-${column.id}`}>{column.name}</h2><span className="board-count" aria-label={`${items.length} ${items.length === 1 ? "demanda" : "demandas"}`}>{items.length}</span></header>
            <ul className="board-cards">
              {items.map((demand) => <li className="board-card" data-completed={demand.completedAt ? "true" : undefined} key={demand.id}>
                <button className="board-card-open" type="button" onClick={() => { setViewing(demand); setMessage(""); }}>
                  <strong>{demand.title}</strong>
                  {demand.description ? <span className="board-card-text">{demand.description}</span> : null}
                  <span className="board-card-meta">
                    {demand.completedAt ? <span className="board-card-done"><Icon name="check" className="icon-sm" />Concluída</span> : null}
                    <span><Icon name="calendar" className="icon-sm" />{dateLabel(demand.scheduledAt)}</span>
                  </span>
                  {demand.assignees.length ? <span className="avatars" aria-label={`Responsáveis: ${demand.assignees.map(({ user }) => user.name).join(", ")}`}>{demand.assignees.map(({ user }) => <span className="avatar" title={user.name} aria-hidden="true" key={user.id}>{initials(user.name)}</span>)}</span> : null}
                </button>
                <div className="board-card-move">
                  <button className="icon-btn" type="button" onClick={() => previous && void move(demand.id, previous.id)} disabled={!previous} aria-label={previous ? `Mover “${demand.title}” para ${previous.name}` : "Já está na primeira coluna"}><Icon name="arrowLeft" /></button>
                  <button className="icon-btn" type="button" onClick={() => next && void move(demand.id, next.id)} disabled={!next} aria-label={next ? `Mover “${demand.title}” para ${next.name}` : "Já está na última coluna"}><Icon name="arrowRight" /></button>
                </div>
              </li>)}
            </ul>
            {items.length === 0 ? <p className="board-empty">Nenhuma demanda nesta coluna.</p> : null}
            <button className="btn btn-quiet board-add" type="button" onClick={() => startCreate(column.id)}><Icon name="plus" />Adicionar</button>
          </section>;
        })}
      </div>
    </div>

    {createOpen ? <Sheet open onClose={closeEditor} title={selected ? "Editar demanda" : "Nova demanda"} className="sheet-wide">
      <Editor selected={selected} form={form} setForm={setForm} columns={columns} message={message} saving={saving} search={assigneeSearch} setSearch={setAssigneeSearch} people={matchingPeople} selectedPeople={selectedPeople} toggleAssignee={toggleAssignee} close={closeEditor} save={saveDemand} />
    </Sheet> : null}

    {viewing ? <Sheet open onClose={closeView} title={viewing.title}>
      <div className="demand-view">
        <p className="demand-view-state">{viewing.completedAt ? <span className="status-pill" data-tone="positive">Concluída</span> : <span className="status-pill" data-tone="neutral">Demanda</span>}</p>
        {viewing.description ? <p className="demand-view-text">{viewing.description}</p> : <p className="field-hint">Sem detalhes adicionais.</p>}
        <dl className="kv-list">
          <div><dt>Data e horário</dt><dd>{dateLabel(viewing.scheduledAt)}</dd></div>
          <div><dt>Responsáveis</dt><dd>{viewing.assignees.length ? viewing.assignees.map(({ user }) => user.name).join(", ") : "Nenhum responsável"}</dd></div>
        </dl>
        <Feedback error={message} />
        <div className="btn-row demand-actions">
          <button className="btn btn-secondary" type="button" onClick={() => { const demand = viewing; closeView(); startEdit(demand); }}>Editar</button>
          <button className="btn btn-secondary" type="button" onClick={() => void updateViewed({ completed: !viewing.completedAt })} disabled={saving}><Icon name="check" />{viewing.completedAt ? "Reabrir" : "Concluir"}</button>
          <button className="btn btn-secondary" type="button" onClick={() => { setArchiveOpen((open) => !open); setConfirmDelete(false); setMessage(""); }} aria-expanded={archiveOpen}><Icon name="file" />Arquivar</button>
          <button className="btn btn-danger" type="button" onClick={() => { setConfirmDelete(true); setArchiveOpen(false); }} disabled={saving}><Icon name="trash" />Excluir</button>
        </div>
        {confirmDelete ? <div className="message-stack demand-view-panel">
          <p className="message" data-tone="danger"><Icon name="alert" /><span>Excluir esta demanda? Esta ação não pode ser desfeita.</span></p>
          <div className="btn-row"><button className="btn btn-secondary" type="button" onClick={() => setConfirmDelete(false)}>Cancelar</button><button className="btn btn-danger-solid" type="button" onClick={() => void deleteViewed()} disabled={saving} aria-busy={saving}>Excluir demanda</button></div>
        </div> : null}
        {archiveOpen ? <div className="demand-view-panel">
          <h3 className="section-title">Escolha uma pasta</h3>
          <div className="form-field"><label htmlFor="demand-folder">Pasta</label><select className="control" id="demand-folder" value={archiveFolderId} onChange={(event) => setArchiveFolderId(event.target.value)}><option value="">Selecione uma pasta</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></div>
          {folders.length ? null : <p className="field-hint">Crie uma pasta nas opções do quadro.</p>}
          <button className="btn btn-primary" type="button" onClick={() => void archiveViewed()} disabled={saving || !folders.length}>Arquivar demanda</button>
        </div> : null}
      </div>
    </Sheet> : null}

    {archiveListOpen ? <Sheet open onClose={() => { setArchiveListOpen(false); setArchiveFolder(null); }} title={archiveFolder?.name ?? "Demandas arquivadas"}>
      <p className="section-lead sheet-lead">{archiveFolder ? "Cards guardados nesta pasta. Restaure um card para devolvê-lo ao quadro." : "Cards arquivados neste quadro."}</p>
      <Feedback error={message} />
      {(() => {
        const list = archiveFolder ? archivedDemands.filter((demand) => demand.folder?.id === archiveFolder.id) : archivedDemands;
        return list.length ? <ul className="activity-list">{list.map((demand) => <li key={demand.id}>
          <span className="activity-copy"><strong>{demand.title}</strong><span>{demand.folder?.name ?? "Sem pasta"} · {dateLabel(demand.scheduledAt)}</span></span>
          <button className="btn btn-secondary" type="button" onClick={() => void restoreArchived(demand)} disabled={saving}>Restaurar</button>
        </li>)}</ul> : <div className="state-empty"><p>{archiveFolder ? "Esta pasta ainda não tem cards arquivados." : "Nenhuma demanda foi arquivada neste quadro."}</p></div>;
      })()}
    </Sheet> : null}

    {manageOpen ? <Sheet open onClose={() => setManageOpen(false)} title="Colunas">
      <p className="section-lead sheet-lead">Crie, renomeie ou remova colunas. Ao excluir, as demandas seguem para a próxima coluna disponível.</p>
      <ul className="edit-list">{columns.map((column) => <li key={column.id}>
        <input className="control" aria-label={"Nome da coluna " + column.name} value={columnNames[column.id] ?? column.name} onChange={(event) => setColumnNames({ ...columnNames, [column.id]: event.target.value })} />
        <button className="btn btn-secondary" type="button" onClick={() => void renameColumn(column)}>Salvar</button>
        <button className="icon-btn edit-list-remove" type="button" onClick={() => void deleteColumn(column)} aria-label={`Excluir a coluna ${column.name}`}><Icon name="trash" /></button>
      </li>)}</ul>
      <div className="control-group edit-list-add">
        <input className="control" aria-label="Nome da nova coluna" placeholder="Nova coluna" value={newColumnName} onChange={(event) => setNewColumnName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void addColumn()} />
        <button className="btn btn-primary" type="button" onClick={() => void addColumn()}><Icon name="plus" />Coluna</button>
      </div>
      <Feedback error={message} />
    </Sheet> : null}

    {foldersOpen ? <Sheet open onClose={() => { setFoldersOpen(false); setFolderToDelete(null); }} title="Pastas do arquivo">
      <p className="section-lead sheet-lead">Abra uma pasta para ver e restaurar os cards guardados.</p>
      <div className="control-group edit-list-add">
        <input className="control" aria-label="Nome da nova pasta" placeholder="Nome da pasta" value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void createFolder()} />
        <button className="btn btn-primary" type="button" onClick={() => void createFolder()} disabled={saving}>Criar pasta</button>
      </div>
      <p className="field-hint">Ao excluir uma pasta, os cards permanecem no arquivo e ficam sem pasta.</p>
      <Feedback error={message} />
      {folders.length ? <ul className="activity-list folder-list">{folders.map((folder) => <li key={folder.id}>
        {folderToDelete === folder.id ? <>
          <span className="activity-copy"><strong>Excluir a pasta “{folder.name}”?</strong><span>Os cards continuarão arquivados, sem pasta.</span></span>
          <span className="btn-row"><button className="btn btn-secondary" type="button" onClick={() => setFolderToDelete(null)}>Cancelar</button><button className="btn btn-danger-solid" type="button" onClick={() => void deleteFolder(folder)} disabled={saving}>Excluir</button></span>
        </> : <>
          <button className="folder-open" type="button" onClick={() => void openArchiveList(folder)} disabled={saving}><Icon name="file" /><span className="activity-copy"><strong>{folder.name}</strong><span>Abrir pasta</span></span></button>
          <button className="icon-btn" type="button" onClick={() => setFolderToDelete(folder.id)} disabled={saving} aria-label={`Excluir a pasta ${folder.name}`}><Icon name="trash" /></button>
        </>}
      </li>)}</ul> : <div className="state-empty"><p>Ainda não há pastas neste quadro.</p></div>}
    </Sheet> : null}

    {manageMembersOpen ? <Sheet open onClose={() => setManageMembersOpen(false)} title="Pessoas do quadro">
      <p className="section-lead sheet-lead">Somente as pessoas selecionadas poderão abrir e movimentar demandas aqui.</p>
      <ul className="person-list">{people.map((person) => <li key={person.id}><label className="person-option">
        <input type="checkbox" checked={memberIds.includes(person.id)} onChange={() => toggleMember(person.id)} />
        <span className="avatar" aria-hidden="true">{initials(person.name)}</span>
        <span className="activity-copy"><strong>{person.name}</strong><span>{person.email}</span></span>
      </label></li>)}</ul>
      <Feedback error={message} />
      <div className="btn-row sheet-actions"><button className="btn btn-primary" type="button" onClick={() => void saveMembers()}>Salvar acesso</button></div>
    </Sheet> : null}
  </section>;
}

function Editor({ selected, form, setForm, columns, message, saving, search, setSearch, people, selectedPeople, toggleAssignee, close, save }: { selected: Demand | null; form: { title: string; description: string; scheduledAt: string; assigneeIds: string[]; columnId: string }; setForm: (form: { title: string; description: string; scheduledAt: string; assigneeIds: string[]; columnId: string }) => void; columns: Column[]; message: string; saving: boolean; search: string; setSearch: (value: string) => void; people: Person[]; selectedPeople: Person[]; toggleAssignee: (id: string) => void; close: () => void; save: () => void }) {
  return <form className="demand-form" onSubmit={(event) => { event.preventDefault(); save(); }}>
    <p className="section-lead sheet-lead">{selected ? "Ajuste a atividade" : "O que precisa acontecer?"}</p>
    <div className="form-field"><label htmlFor="demand-title">Atividade</label><input className="control" id="demand-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} data-autofocus /></div>
    <div className="form-field"><label htmlFor="demand-description">Detalhes</label><textarea className="control" id="demand-description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={4} /></div>
    <div className="form-grid">
      <div className="form-field"><label htmlFor="demand-column">Coluna</label><select className="control" id="demand-column" value={form.columnId} onChange={(event) => setForm({ ...form, columnId: event.target.value })}>{columns.map((column) => <option key={column.id} value={column.id}>{column.name}</option>)}</select></div>
      <div className="form-field"><label htmlFor="demand-time">Data e horário</label><input className="control" id="demand-time" type="datetime-local" value={form.scheduledAt} onChange={(event) => setForm({ ...form, scheduledAt: event.target.value })} /><span className="field-hint">Horário de Maceió.</span></div>
    </div>
    <fieldset className="assignees">
      <legend className="form-label">Responsáveis</legend>
      <div className="form-field"><label className="visually-hidden" htmlFor="demand-assignee-search">Buscar colaborador</label><div className="search-field"><Icon name="search" /><input className="control" id="demand-assignee-search" type="search" placeholder="Buscar colaborador por nome ou e-mail" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div>
      {selectedPeople.length ? <div className="assignee-selected">{selectedPeople.map((person) => <button className="chip" type="button" key={person.id} onClick={() => toggleAssignee(person.id)} aria-label={`Remover ${person.name}`}><span className="avatar avatar-sm" aria-hidden="true">{initials(person.name)}</span>{person.name}<Icon name="close" className="icon-sm" /></button>)}</div> : <p className="field-hint">Nenhum responsável selecionado.</p>}
      <ul className="person-list">{people.length ? people.map((person) => { const isSelected = form.assigneeIds.includes(person.id); return <li key={person.id}><button className="person-option" type="button" onClick={() => toggleAssignee(person.id)} aria-pressed={isSelected}>
        <span className="avatar" aria-hidden="true">{initials(person.name)}</span>
        <span className="activity-copy"><strong>{person.name}</strong><span>{person.email}</span></span>
        <Icon name={isSelected ? "check" : "plus"} className="person-option-mark" />
      </button></li>; }) : <li className="field-hint">Nenhum colaborador encontrado.</li>}</ul>
    </fieldset>
    <Feedback error={message} />
    <div className="btn-row btn-row-split sheet-actions">
      <button className="btn btn-quiet" type="button" onClick={close}>Cancelar</button>
      <button className="btn btn-primary" type="submit" disabled={saving} aria-busy={saving}>{saving ? "Salvando…" : selected ? "Salvar alterações" : "Criar demanda"}</button>
    </div>
  </form>;
}
