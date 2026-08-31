"use client";

import { FormEvent, useState } from "react";

type Role = "ADMIN" | "OPERATOR";
type Collaborator = { id: string; name: string; email: string; role: Role; active: boolean; joinedAt: string | Date };

function roleLabel(role: Role) { return role === "ADMIN" ? "Administrador" : "Operador"; }

export function CollaboratorsManager({ initialCollaborators }: { initialCollaborators: Collaborator[] }) {
  const [collaborators, setCollaborators] = useState(initialCollaborators);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("OPERATOR");
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(""); setMessage(""); setTemporaryPassword(null); setEmailSent(false);
    try {
      const response = await fetch("/api/admin/collaborators", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, role }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Não foi possível cadastrar o colaborador."); return; }
      setCollaborators((current) => [...current, data.collaborator].sort((left, right) => left.name.localeCompare(right.name, "pt-BR")));
      setName(""); setEmail(""); setRole("OPERATOR");
      setTemporaryPassword(data.temporaryPassword);
      setEmailSent(Boolean(data.emailSent));
      setMessage(data.emailSent ? "Colaborador cadastrado. O e-mail com os dados de acesso foi enviado." : "Colaborador cadastrado, mas não foi possível enviar o e-mail. Compartilhe a senha temporária manualmente.");
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }

  return <section className="collaborators-manager"><div className="collaborators-layout"><form className="collaborator-form" onSubmit={submit}><div className="panel-heading"><div><p className="eyebrow">Novo colaborador</p><h2>Adicionar à equipe</h2><p>Defina o acesso da pessoa antes de criar a conta.</p></div></div><div className="field"><label htmlFor="collaborator-name">Nome completo</label><input id="collaborator-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required /></div><div className="field"><label htmlFor="collaborator-email">E-mail</label><input id="collaborator-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></div><div className="field"><label htmlFor="collaborator-role">Papel</label><select id="collaborator-role" value={role} onChange={(event) => setRole(event.target.value as Role)}><option value="OPERATOR">Operador</option><option value="ADMIN">Administrador</option></select></div><p className="collaborator-role-note">{role === "OPERATOR" ? "Tem acesso limitado às áreas de Alunos e Analisar dados." : "Possui acesso completo às configurações e à operação da plataforma."}</p>{error ? <p className="error-message">{error}</p> : null}<button className="button button-dark" type="submit" disabled={pending}>{pending ? "Criando acesso..." : "Criar colaborador"}</button></form><section className="collaborator-directory"><div className="panel-heading"><div><p className="eyebrow">Equipe</p><h2>Colaboradores cadastrados</h2><p>{collaborators.length} acesso(s) administrativo(s).</p></div></div><div className="collaborator-list">{collaborators.map((collaborator) => <div className="collaborator-row" key={collaborator.id}><div><strong>{collaborator.name}</strong><span>{collaborator.email}</span></div><em>{roleLabel(collaborator.role)}</em></div>)}</div></section></div>{message ? <div className="collaborator-created"><p className="success-message">{message}</p>{temporaryPassword ? <div><span>Senha temporária</span><code>{temporaryPassword}</code><small>{emailSent ? "Senha exibida apenas por segurança. O colaborador também a recebeu por e-mail." : "Envie esta senha ao colaborador por um canal seguro. Ele poderá alterá-la depois do primeiro acesso."}</small></div> : null}</div> : null}</section>;
}
