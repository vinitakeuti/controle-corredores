"use client";

import { FormEvent, useState } from "react";
import { Feedback } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { StatusPill } from "@/components/ui/status-pill";

const managerFeatures = [
  ["overview", "Visão geral"], ["demands", "Demandas"], ["sales", "Vendas"], ["students", "Alunos"],
  ["analysis", "Analisar dados"], ["finance", "Financeiro"], ["plans", "Planos"], ["integrations", "Integrações"],
] as const;
type ManagerFeature = (typeof managerFeatures)[number][0];
type ManagerPermissions = Record<ManagerFeature, boolean>;
type Role = "ADMIN" | "MANAGER" | "OPERATOR";
type Collaborator = { id: string; name: string; email: string; role: Role; active: boolean; joinedAt: string | Date; commissionRateBps: number; managerPermissions: unknown; passwordResetLinkAccess: boolean };
type CollaboratorChanges = { role: Role; commissionRate: string; managerPermissions: ManagerPermissions; passwordResetLinkAccess: boolean };

function permissions(value?: unknown): ManagerPermissions {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return Object.fromEntries(managerFeatures.map(([feature]) => [feature, source[feature] === true])) as ManagerPermissions;
}
function roleLabel(role: Role) { return role === "ADMIN" ? "Administrador" : role === "MANAGER" ? "Gerente" : "Operador"; }
function rateInputValue(rateBps: number) { return (rateBps / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 }); }
function parseRate(value: string) { const number = Number(value.replace(",", ".")); return Number.isFinite(number) ? Math.round(number * 100) : null; }

function ResetLinkAccess({ role, checked, onChange, id }: { role: Role; checked: boolean; onChange: (value: boolean) => void; id: string }) {
  if (role === "ADMIN") return <p className="field-hint">Administradores sempre podem gerar links de redefinição de senha de alunos.</p>;
  return <label className="check" htmlFor={id}><input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span className="check-copy"><strong>Gerar link de redefinição de senha</strong><small>Permite criar, no perfil do aluno, um link para ele trocar a senha.{role === "MANAGER" ? " O gerente também precisa da área Alunos liberada." : ""}</small></span></label>;
}

function PermissionPicker({ value, onChange, idPrefix, open = false }: { value: ManagerPermissions; onChange: (value: ManagerPermissions) => void; idPrefix: string; open?: boolean }) {
  const enabled = managerFeatures.filter(([feature]) => value[feature]).length;
  return <details className="permission-picker" open={open}>
    <summary><span className="form-label">Áreas liberadas para o gerente</span><span className="board-count">{enabled} de {managerFeatures.length}</span><Icon name="chevronDown" className="icon-sm ledger-toggle" /></summary>
    <p className="field-hint">Marque somente as áreas que este gerente poderá acessar. Configurações e gestão de cargos continuam exclusivas de administradores.</p>
    <div className="option-checks-list">{managerFeatures.map(([feature, label]) => <label className="option-check" key={feature} htmlFor={`${idPrefix}-${feature}`}><input id={`${idPrefix}-${feature}`} type="checkbox" checked={value[feature]} onChange={() => onChange({ ...value, [feature]: !value[feature] })} />{label}</label>)}</div>
  </details>;
}

export function CollaboratorsManager({ initialCollaborators, currentAdminId }: { initialCollaborators: Collaborator[]; currentAdminId: string }) {
  const [collaborators, setCollaborators] = useState(initialCollaborators);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [role, setRole] = useState<Role>("OPERATOR");
  const [managerPermissions, setManagerPermissions] = useState<ManagerPermissions>(permissions()); const [commissionRate, setCommissionRate] = useState("0"); const [resetLinkAccess, setResetLinkAccess] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null); const [emailSent, setEmailSent] = useState(false);
  const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [pending, setPending] = useState(false); const [savingId, setSavingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false); const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null); const [deletingId, setDeletingId] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(""); setMessage(""); setTemporaryPassword(null); setEmailSent(false);
    const commissionRateBps = parseRate(commissionRate);
    if (commissionRateBps === null || commissionRateBps < 0 || commissionRateBps > 10000) { setPending(false); setError("Informe uma comissão entre 0% e 100%."); return; }
    try {
      const response = await fetch("/api/admin/collaborators", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, role, commissionRateBps, managerPermissions, passwordResetLinkAccess: resetLinkAccess }) }); const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Não foi possível cadastrar o colaborador."); return; }
      setCollaborators((current) => [...current, data.collaborator].sort((left, right) => left.name.localeCompare(right.name, "pt-BR")));
      setName(""); setEmail(""); setRole("OPERATOR"); setManagerPermissions(permissions()); setCommissionRate("0"); setResetLinkAccess(false); setTemporaryPassword(data.temporaryPassword); setEmailSent(Boolean(data.emailSent)); setCreateOpen(false);
      setMessage(data.emailSent ? "Colaborador cadastrado. O e-mail com os dados de acesso foi enviado." : "Colaborador cadastrado, mas não foi possível enviar o e-mail. Compartilhe a senha temporária manualmente.");
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }

  async function saveCollaborator(collaboratorId: string, changes: CollaboratorChanges) {
    const commissionRateBps = parseRate(changes.commissionRate);
    if (commissionRateBps === null || commissionRateBps < 0 || commissionRateBps > 10000) { setError("Informe uma comissão entre 0% e 100%."); return; }
    setSavingId(collaboratorId); setError("");
    try {
      const response = await fetch("/api/admin/collaborators", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ collaboratorId, commissionRateBps, role: changes.role, managerPermissions: changes.managerPermissions, passwordResetLinkAccess: changes.passwordResetLinkAccess }) }); const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Não foi possível atualizar o colaborador."); return; }
      setCollaborators((current) => current.map((collaborator) => collaborator.id === collaboratorId ? { ...collaborator, commissionRateBps: data.commissionRateBps, role: data.role, managerPermissions: data.managerPermissions, passwordResetLinkAccess: data.passwordResetLinkAccess ?? collaborator.passwordResetLinkAccess } : collaborator));
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setSavingId(null); }
  }

  async function deleteCollaborator(collaboratorId: string) {
    if (deleteConfirmationId !== collaboratorId) { setDeleteConfirmationId(collaboratorId); return; }
    setDeletingId(collaboratorId); setError("");
    try {
      const response = await fetch("/api/admin/collaborators", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ collaboratorId }) }); const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Não foi possível excluir o colaborador."); return; }
      setCollaborators((current) => current.filter((collaborator) => collaborator.id !== data.deletedId)); setDeleteConfirmationId(null);
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setDeletingId(null); }
  }

  return <section className="section-block team" aria-labelledby="team-title">
    <div className="section-head">
      <div><h2 className="section-title" id="team-title">Colaboradores cadastrados</h2><p className="section-lead">{collaborators.length} {collaborators.length === 1 ? "acesso administrativo" : "acessos administrativos"}.</p></div>
      <button className="btn btn-primary" type="button" onClick={() => { setError(""); setCreateOpen(true); }} aria-haspopup="dialog"><Icon name="plus" />Adicionar colaborador</button>
    </div>
    {message ? <div className="team-created">
      <Feedback success={message} />
      {temporaryPassword ? <div className="form-field"><span className="form-label">Senha temporária</span><code className="code-box">{temporaryPassword}</code><p className="field-hint">{emailSent ? "Senha exibida apenas por segurança. O colaborador também a recebeu por e-mail." : "Envie esta senha ao colaborador por um canal seguro. Ele poderá alterá-la depois do primeiro acesso."}</p></div> : null}
    </div> : null}
    <Feedback error={!createOpen ? error : ""} />
    <ul className="team-list">{collaborators.map((collaborator) => <CollaboratorRow collaborator={collaborator} key={collaborator.id} saving={savingId === collaborator.id} deleting={deletingId === collaborator.id} currentAdmin={collaborator.id === currentAdminId} confirmDelete={deleteConfirmationId === collaborator.id} onSave={saveCollaborator} onDelete={deleteCollaborator} onCancelDelete={() => setDeleteConfirmationId(null)} />)}</ul>

    {createOpen ? <Sheet open onClose={() => setCreateOpen(false)} title="Adicionar à equipe" className="sheet-wide">
      <form className="sheet-form" onSubmit={submit}>
        <p className="section-lead sheet-lead">Defina o cargo e os acessos antes de criar a conta.</p>
        <div className="form-grid">
          <div className="form-field"><label htmlFor="collaborator-name">Nome completo</label><input className="control" id="collaborator-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required data-autofocus /></div>
          <div className="form-field"><label htmlFor="collaborator-email">E-mail</label><input className="control" id="collaborator-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></div>
          <div className="form-field"><label htmlFor="collaborator-role">Cargo</label><select className="control" id="collaborator-role" value={role} onChange={(event) => setRole(event.target.value as Role)}><option value="OPERATOR">Operador</option><option value="MANAGER">Gerente</option><option value="ADMIN">Administrador</option></select></div>
          <div className="form-field"><label htmlFor="collaborator-commission">Comissão sobre vendas aprovadas (%)</label><input className="control" id="collaborator-commission" type="number" min="0" max="100" step="0.01" inputMode="decimal" value={commissionRate} onChange={(event) => setCommissionRate(event.target.value)} aria-describedby="collaborator-commission-hint" /></div>
        </div>
        <p className="field-hint" id="collaborator-commission-hint">A comissão é calculada sobre o primeiro pagamento aprovado de cada venda atribuída.</p>
        {role === "MANAGER" ? <PermissionPicker value={managerPermissions} onChange={setManagerPermissions} idPrefix="new-manager" open /> : null}
        <ResetLinkAccess role={role} checked={resetLinkAccess} onChange={setResetLinkAccess} id="new-reset-link-access" />
        <Feedback error={error} />
        <div className="btn-row btn-row-split sheet-actions"><button className="btn btn-quiet" type="button" onClick={() => setCreateOpen(false)}>Cancelar</button><button className="btn btn-primary" type="submit" disabled={pending} aria-busy={pending}>{pending ? "Criando acesso..." : "Criar colaborador"}</button></div>
      </form>
    </Sheet> : null}
  </section>;
}

function CollaboratorRow({ collaborator, saving, deleting, currentAdmin, confirmDelete, onSave, onDelete, onCancelDelete }: { collaborator: Collaborator; saving: boolean; deleting: boolean; currentAdmin: boolean; confirmDelete: boolean; onSave: (id: string, changes: CollaboratorChanges) => void; onDelete: (id: string) => void; onCancelDelete: () => void }) {
  const [rate, setRate] = useState(rateInputValue(collaborator.commissionRateBps)); const [role, setRole] = useState<Role>(collaborator.role); const [managerPermissions, setManagerPermissions] = useState(permissions(collaborator.managerPermissions)); const [resetLinkAccess, setResetLinkAccess] = useState(collaborator.passwordResetLinkAccess);
  return <li className="team-row">
    <div className="team-identity">
      <span className="avatar team-avatar" aria-hidden="true">{collaborator.name.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2)}</span>
      <span className="activity-copy"><strong>{collaborator.name}</strong><span>{collaborator.email}</span></span>
      <StatusPill tone={role === "ADMIN" ? "info" : "neutral"}>{roleLabel(role)}</StatusPill>
    </div>
    <div className="team-controls">
      <div className="form-field"><label htmlFor={`role-${collaborator.id}`}>Cargo</label><select className="control" id={`role-${collaborator.id}`} value={role} onChange={(event) => setRole(event.target.value as Role)} disabled={currentAdmin}><option value="OPERATOR">Operador</option><option value="MANAGER">Gerente</option><option value="ADMIN">Administrador</option></select></div>
      <div className="form-field team-commission"><label htmlFor={`commission-${collaborator.id}`}>Comissão (%)</label><input className="control" id={`commission-${collaborator.id}`} type="number" min="0" max="100" step="0.01" inputMode="decimal" value={rate} onChange={(event) => setRate(event.target.value)} /></div>
      <div className="btn-row team-actions">
        <button className="btn btn-secondary" type="button" disabled={saving || deleting} aria-busy={saving} onClick={() => onSave(collaborator.id, { role, commissionRate: rate, managerPermissions, passwordResetLinkAccess: resetLinkAccess })}>{saving ? "Salvando..." : "Salvar"}</button>
        {currentAdmin || confirmDelete ? null : <button className="icon-btn team-delete" type="button" disabled={saving} onClick={() => onDelete(collaborator.id)} aria-label={`Excluir ${collaborator.name}`} title="Excluir"><Icon name="trash" /></button>}
      </div>
    </div>
    {confirmDelete ? <div className="message-stack team-confirm">
      <p className="message" data-tone="danger"><Icon name="alert" /><span>Excluir o acesso de {collaborator.name}?</span></p>
      <div className="btn-row"><button className="btn btn-secondary" type="button" disabled={deleting} onClick={onCancelDelete}>Cancelar</button><button className="btn btn-danger-solid" type="button" disabled={deleting} aria-busy={deleting} onClick={() => onDelete(collaborator.id)}>{deleting ? "Excluindo..." : "Confirmar exclusão"}</button></div>
    </div> : null}
    {role === "MANAGER" ? <PermissionPicker value={managerPermissions} onChange={setManagerPermissions} idPrefix={`manager-${collaborator.id}`} /> : null}
    <ResetLinkAccess role={role} checked={resetLinkAccess} onChange={setResetLinkAccess} id={`reset-link-${collaborator.id}`} />
    {currentAdmin ? <p className="field-hint">Sua própria conta não pode ter o cargo alterado nem ser excluída aqui.</p> : null}
  </li>;
}
