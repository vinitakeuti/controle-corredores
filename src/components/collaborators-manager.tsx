"use client";

import { FormEvent, useState } from "react";
import { Feedback } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { MenuButton } from "@/components/ui/menu-button";
import { Sheet } from "@/components/ui/sheet";
import { StatusPill } from "@/components/ui/status-pill";

const managerFeatures = [
  ["overview", "Visão geral"], ["demands", "Demandas"], ["sales", "Vendas"], ["students", "Alunos"],
  ["analysis", "Analisar dados"], ["finance", "Financeiro"], ["plans", "Planos"], ["integrations", "Integrações"], ["assistant", "Assistente IA"],
] as const;
type ManagerFeature = (typeof managerFeatures)[number][0];
type ManagerPermissions = Record<ManagerFeature, boolean>;
type Role = "ADMIN" | "MANAGER" | "OPERATOR";
type Collaborator = { id: string; name: string; email: string; role: Role; active: boolean; joinedAt: string | Date; commissionRateBps: number; managerPermissions: unknown; passwordResetLinkAccess: boolean };
type AccessDraft = { role: Role; commissionRate: string; managerPermissions: ManagerPermissions; passwordResetLinkAccess: boolean };

const roleOrder: Record<Role, number> = { ADMIN: 0, MANAGER: 1, OPERATOR: 2 };
// Mesmas regras de src/lib/access-control.ts: operador tem áreas fixas; gerente, as escolhidas aqui.
const operatorAreas = "Demandas, Vendas, Alunos e Analisar dados";

function permissions(value?: unknown): ManagerPermissions {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return Object.fromEntries(managerFeatures.map(([feature]) => [feature, source[feature] === true])) as ManagerPermissions;
}
function roleLabel(role: Role) { return role === "ADMIN" ? "Administrador" : role === "MANAGER" ? "Gerente" : "Operador"; }
function roleHint(role: Role) { return role === "ADMIN" ? "Administradores acessam todas as áreas, incluindo Configurações." : role === "MANAGER" ? "Gerentes acessam só as áreas marcadas abaixo." : `Operadores acessam ${operatorAreas}.`; }
function rateInputValue(rateBps: number) { return (rateBps / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 }); }
function rateLabel(rateBps: number) { return `${rateInputValue(rateBps)}%`; }
function parseRate(value: string) { const number = Number(value.replace(",", ".")); return Number.isFinite(number) ? Math.round(number * 100) : null; }
function initials(name: string) { return name.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2); }
function sortTeam(list: Collaborator[]) { return [...list].sort((left, right) => roleOrder[left.role] - roleOrder[right.role] || left.name.localeCompare(right.name, "pt-BR")); }

function accessSummary(collaborator: Collaborator) {
  const canReset = collaborator.role === "ADMIN" || collaborator.passwordResetLinkAccess;
  if (collaborator.role === "ADMIN") return { main: "Todas as áreas", detail: "Inclui Configurações · gera link de senha" };
  if (collaborator.role === "OPERATOR") return { main: "Áreas de operador", detail: `${operatorAreas}${canReset ? " · gera link de senha" : ""}` };
  const enabled = managerFeatures.filter(([feature]) => permissions(collaborator.managerPermissions)[feature]);
  return { main: `${enabled.length} de ${managerFeatures.length} áreas`, detail: `${enabled.length ? enabled.map(([, label]) => label).join(", ") : "Nenhuma área liberada"}${canReset ? " · gera link de senha" : ""}` };
}

// Cargo, comissão, áreas do gerente e link de senha: os mesmos campos para criar e para editar.
function AccessFields({ draft, onChange, idPrefix, roleLocked = false }: { draft: AccessDraft; onChange: (draft: AccessDraft) => void; idPrefix: string; roleLocked?: boolean }) {
  const enabled = managerFeatures.filter(([feature]) => draft.managerPermissions[feature]).length;
  return <>
    <div className="form-grid">
      <div className="form-field">
        <label htmlFor={`${idPrefix}-role`}>Cargo</label>
        <select className="control" id={`${idPrefix}-role`} value={draft.role} onChange={(event) => onChange({ ...draft, role: event.target.value as Role })} disabled={roleLocked} aria-describedby={`${idPrefix}-role-hint`}>
          <option value="OPERATOR">Operador</option><option value="MANAGER">Gerente</option><option value="ADMIN">Administrador</option>
        </select>
        <p className="field-hint" id={`${idPrefix}-role-hint`}>{roleLocked ? "Sua própria conta não pode ter o cargo alterado nem ser excluída aqui." : roleHint(draft.role)}</p>
      </div>
      <div className="form-field">
        <label htmlFor={`${idPrefix}-commission`}>Comissão sobre vendas aprovadas (%)</label>
        <input className="control" id={`${idPrefix}-commission`} type="number" min="0" max="100" step="0.01" inputMode="decimal" value={draft.commissionRate} onChange={(event) => onChange({ ...draft, commissionRate: event.target.value })} aria-describedby={`${idPrefix}-commission-hint`} />
        <p className="field-hint" id={`${idPrefix}-commission-hint`}>A comissão é calculada sobre o primeiro pagamento aprovado de cada venda atribuída.</p>
      </div>
    </div>
    {draft.role === "MANAGER" ? <fieldset className="team-fieldset">
      <legend className="form-label">Áreas liberadas para o gerente <span className="count-label">{enabled} de {managerFeatures.length}</span></legend>
      <p className="field-hint">Marque somente as áreas que este gerente poderá acessar. Configurações e gestão de cargos continuam exclusivas de administradores.</p>
      <div className="team-areas">{managerFeatures.map(([feature, label]) => <label className="check" key={feature} htmlFor={`${idPrefix}-${feature}`}><input id={`${idPrefix}-${feature}`} type="checkbox" checked={draft.managerPermissions[feature]} onChange={() => onChange({ ...draft, managerPermissions: { ...draft.managerPermissions, [feature]: !draft.managerPermissions[feature] } })} /><span className="check-copy"><strong>{label}</strong></span></label>)}</div>
    </fieldset> : null}
    {draft.role === "ADMIN" ? <p className="field-hint team-reset-note">Administradores sempre podem gerar links de redefinição de senha de alunos.</p> : <label className="check team-reset-check" htmlFor={`${idPrefix}-reset-link`}>
      <input id={`${idPrefix}-reset-link`} type="checkbox" checked={draft.passwordResetLinkAccess} onChange={(event) => onChange({ ...draft, passwordResetLinkAccess: event.target.checked })} />
      <span className="check-copy"><strong>Gerar link de redefinição de senha</strong><small>Permite criar, no perfil do aluno, um link para ele trocar a senha.{draft.role === "MANAGER" ? " O gerente também precisa da área Alunos liberada." : ""}</small></span>
    </label>}
  </>;
}

const emptyDraft = (): AccessDraft => ({ role: "OPERATOR", commissionRate: "0", managerPermissions: permissions(), passwordResetLinkAccess: false });

export function CollaboratorsManager({ initialCollaborators, currentAdminId }: { initialCollaborators: Collaborator[]; currentAdminId: string }) {
  const [collaborators, setCollaborators] = useState(() => sortTeam(initialCollaborators));
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [newDraft, setNewDraft] = useState<AccessDraft>(emptyDraft);
  const [editing, setEditing] = useState<Collaborator | null>(null); const [editDraft, setEditDraft] = useState<AccessDraft>(emptyDraft);
  const [deleteTarget, setDeleteTarget] = useState<Collaborator | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null); const [emailSent, setEmailSent] = useState(false);
  const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [pending, setPending] = useState(false);

  const counts = { ADMIN: 0, MANAGER: 0, OPERATOR: 0 } as Record<Role, number>;
  collaborators.forEach((collaborator) => { counts[collaborator.role] += 1; });
  const breakdown = ([["ADMIN", "administrador", "administradores"], ["MANAGER", "gerente", "gerentes"], ["OPERATOR", "operador", "operadores"]] as const).filter(([role]) => counts[role]).map(([role, one, many]) => `${counts[role]} ${counts[role] === 1 ? one : many}`).join(" · ");

  function openEdit(collaborator: Collaborator) {
    setError("");
    setEditDraft({ role: collaborator.role, commissionRate: rateInputValue(collaborator.commissionRateBps), managerPermissions: permissions(collaborator.managerPermissions), passwordResetLinkAccess: collaborator.passwordResetLinkAccess });
    setEditing(collaborator);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(""); setMessage(""); setTemporaryPassword(null); setEmailSent(false);
    const commissionRateBps = parseRate(newDraft.commissionRate);
    if (commissionRateBps === null || commissionRateBps < 0 || commissionRateBps > 10000) { setPending(false); setError("Informe uma comissão entre 0% e 100%."); return; }
    try {
      const response = await fetch("/api/admin/collaborators", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, role: newDraft.role, commissionRateBps, managerPermissions: newDraft.managerPermissions, passwordResetLinkAccess: newDraft.passwordResetLinkAccess }) }); const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Não foi possível cadastrar o colaborador."); return; }
      setCollaborators((current) => sortTeam([...current, data.collaborator]));
      setName(""); setEmail(""); setNewDraft(emptyDraft()); setTemporaryPassword(data.temporaryPassword); setEmailSent(Boolean(data.emailSent)); setCreateOpen(false);
      setMessage(data.emailSent ? "Colaborador cadastrado. O e-mail com os dados de acesso foi enviado." : "Colaborador cadastrado, mas não foi possível enviar o e-mail. Compartilhe a senha temporária manualmente.");
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const commissionRateBps = parseRate(editDraft.commissionRate);
    if (commissionRateBps === null || commissionRateBps < 0 || commissionRateBps > 10000) { setError("Informe uma comissão entre 0% e 100%."); return; }
    setPending(true); setError(""); setMessage(""); setTemporaryPassword(null);
    try {
      const response = await fetch("/api/admin/collaborators", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ collaboratorId: editing.id, commissionRateBps, role: editDraft.role, managerPermissions: editDraft.managerPermissions, passwordResetLinkAccess: editDraft.passwordResetLinkAccess }) }); const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Não foi possível atualizar o colaborador."); return; }
      setCollaborators((current) => sortTeam(current.map((collaborator) => collaborator.id === editing.id ? { ...collaborator, commissionRateBps: data.commissionRateBps, role: data.role, managerPermissions: data.managerPermissions, passwordResetLinkAccess: data.passwordResetLinkAccess ?? collaborator.passwordResetLinkAccess } : collaborator)));
      setMessage(`Acesso de ${editing.name} atualizado.`); setEditing(null);
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setPending(true); setError(""); setMessage(""); setTemporaryPassword(null);
    try {
      const response = await fetch("/api/admin/collaborators", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ collaboratorId: deleteTarget.id }) }); const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Não foi possível excluir o colaborador."); return; }
      setCollaborators((current) => current.filter((collaborator) => collaborator.id !== data.deletedId));
      setMessage(`Acesso de ${deleteTarget.name} excluído.`); setDeleteTarget(null);
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }

  const sheetOpen = createOpen || Boolean(editing) || Boolean(deleteTarget);
  // A própria conta não tem "mais ações"; o espaço fica reservado para "Editar" alinhar com as outras linhas.
  const rowActions = (collaborator: Collaborator) => collaborator.id === currentAdminId ? <span className="team-menu-slot" aria-hidden="true" /> : <MenuButton label={`Mais ações de ${collaborator.name}`} items={[{ label: "Excluir acesso", icon: "trash", tone: "danger", onSelect: () => { setError(""); setDeleteTarget(collaborator); } }]} />;
  const editButton = (collaborator: Collaborator) => <button className="btn btn-quiet" type="button" onClick={() => openEdit(collaborator)} aria-label={`Editar acesso de ${collaborator.name}`}>Editar</button>;
  const identity = (collaborator: Collaborator) => <span className="team-identity">
    <span className="avatar team-avatar" aria-hidden="true">{initials(collaborator.name)}</span>
    <span className="team-person"><strong>{collaborator.name}{collaborator.id === currentAdminId ? <span className="team-you">Você</span> : null}</strong><span>{collaborator.email}</span></span>
  </span>;

  return <section className="section-block team" aria-labelledby="team-title">
    <div className="section-head">
      <div><h2 className="section-title" id="team-title">Colaboradores cadastrados</h2><p className="section-lead">{collaborators.length} {collaborators.length === 1 ? "acesso administrativo" : "acessos administrativos"}{breakdown ? ` · ${breakdown}` : ""}.</p></div>
      <button className="btn btn-primary" type="button" onClick={() => { setError(""); setCreateOpen(true); }} aria-haspopup="dialog"><Icon name="plus" />Adicionar colaborador</button>
    </div>
    {message ? <div className="team-created">
      <Feedback success={message} />
      {temporaryPassword ? <div className="form-field"><span className="form-label">Senha temporária</span><code className="code-box">{temporaryPassword}</code><p className="field-hint">{emailSent ? "Senha exibida apenas por segurança. O colaborador também a recebeu por e-mail." : "Envie esta senha ao colaborador por um canal seguro. Ele poderá alterá-la depois do primeiro acesso."}</p></div> : null}
    </div> : null}
    <Feedback error={!sheetOpen ? error : ""} />

    <div className="data-table-wrap team-table-wrap responsive-table">
      <table className="data-table team-table">
        <caption className="visually-hidden">Equipe com acesso à gestão</caption>
        <thead><tr><th scope="col">Colaborador</th><th scope="col">Cargo</th><th scope="col">Acessos</th><th scope="col" className="num">Comissão</th><th scope="col"><span className="visually-hidden">Ações</span></th></tr></thead>
        <tbody>{collaborators.map((collaborator) => {
          const access = accessSummary(collaborator);
          return <tr key={collaborator.id}>
            <td>{identity(collaborator)}</td>
            <td><StatusPill tone={collaborator.role === "ADMIN" ? "info" : "neutral"}>{roleLabel(collaborator.role)}</StatusPill></td>
            <td><span className="cell-primary">{access.main}</span><span className="cell-secondary team-access-detail">{access.detail}</span></td>
            <td className="num team-rate">{rateLabel(collaborator.commissionRateBps)}</td>
            <td><div className="team-actions">{editButton(collaborator)}{rowActions(collaborator)}</div></td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    <ul className="data-rows responsive-rows team-rows" aria-label="Equipe com acesso à gestão">
      {collaborators.map((collaborator) => {
        const access = accessSummary(collaborator);
        return <li key={collaborator.id}>
          {identity(collaborator)}
          <StatusPill tone={collaborator.role === "ADMIN" ? "info" : "neutral"}>{roleLabel(collaborator.role)}</StatusPill>
          <span className="row-meta"><span>{access.main}</span><span>Comissão {rateLabel(collaborator.commissionRateBps)}</span></span>
          <div className="team-row-actions">{editButton(collaborator)}{rowActions(collaborator)}</div>
          <span className="team-row-detail">{access.detail}</span>
        </li>;
      })}
    </ul>

    {createOpen ? <Sheet open onClose={() => setCreateOpen(false)} title="Adicionar à equipe" className="sheet-wide">
      <form className="sheet-form" onSubmit={submit}>
        <p className="section-lead sheet-lead">Defina o cargo e os acessos antes de criar a conta.</p>
        <div className="form-grid">
          <div className="form-field"><label htmlFor="collaborator-name">Nome completo</label><input className="control" id="collaborator-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required data-autofocus /></div>
          <div className="form-field"><label htmlFor="collaborator-email">E-mail</label><input className="control" id="collaborator-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></div>
        </div>
        <AccessFields draft={newDraft} onChange={setNewDraft} idPrefix="new-collaborator" />
        <Feedback error={error} />
        <div className="btn-row btn-row-split sheet-actions"><button className="btn btn-quiet" type="button" onClick={() => setCreateOpen(false)}>Cancelar</button><button className="btn btn-primary" type="submit" disabled={pending} aria-busy={pending}>{pending ? "Criando acesso..." : "Criar colaborador"}</button></div>
      </form>
    </Sheet> : null}

    {editing ? <Sheet open onClose={() => { setEditing(null); setError(""); }} title={editing.name} className="sheet-wide">
      <form className="sheet-form" onSubmit={saveEdit}>
        <p className="section-lead sheet-lead">{editing.email}</p>
        <AccessFields draft={editDraft} onChange={setEditDraft} idPrefix={`edit-${editing.id}`} roleLocked={editing.id === currentAdminId} />
        <Feedback error={error} />
        <div className="btn-row btn-row-split sheet-actions"><button className="btn btn-quiet" type="button" onClick={() => { setEditing(null); setError(""); }} disabled={pending}>Cancelar</button><button className="btn btn-primary" type="submit" disabled={pending} aria-busy={pending}>{pending ? "Salvando..." : "Salvar alterações"}</button></div>
      </form>
    </Sheet> : null}

    {deleteTarget ? <Sheet open onClose={() => setDeleteTarget(null)} title="Excluir acesso?">
      <div className="sheet-form">
        <p className="message" data-tone="danger"><Icon name="alert" /><span>Excluir o acesso de {deleteTarget.name}? As demandas, links de pagamento e lançamentos criados por essa pessoa passam para a sua conta.</span></p>
        <Feedback error={error} />
        <div className="btn-row btn-row-split sheet-actions"><button className="btn btn-secondary" type="button" onClick={() => setDeleteTarget(null)} disabled={pending}>Cancelar</button><button className="btn btn-danger-solid" type="button" onClick={confirmDelete} disabled={pending} aria-busy={pending}>{pending ? "Excluindo..." : "Confirmar exclusão"}</button></div>
      </div>
    </Sheet> : null}
  </section>;
}
