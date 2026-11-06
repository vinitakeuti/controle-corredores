"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { StatusPill } from "@/components/ui/status-pill";

type Member = { id: string; name: string; role: "ADMIN" | "MANAGER" | "OPERATOR"; active: boolean; whatsapp: string | null; hasAssistant: boolean };
const roleLabels: Record<Member["role"], string> = { ADMIN: "Administrador", MANAGER: "Gerente", OPERATOR: "Operador" };

const display = (digits: string | null) => {
  if (!digits) return "";
  const local = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  return local.length === 11 ? `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}` : local.length === 10 ? `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}` : digits;
};

function MemberRow({ member }: { member: Member }) {
  const [value, setValue] = useState(display(member.whatsapp));
  const [saved, setSaved] = useState(display(member.whatsapp));
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const changed = value.trim() !== saved;

  async function save() {
    setPending(true); setStatus(null);
    try {
      const response = await fetch("/api/admin/ai/team-whatsapp", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: member.id, whatsapp: value }) });
      const data = await response.json();
      if (!response.ok) { setStatus({ tone: "error", text: data.error ?? "Não foi possível salvar." }); return; }
      const next = display(data.whatsapp);
      setValue(next); setSaved(next);
      setStatus({ tone: "ok", text: data.whatsapp ? "Salvo" : "Removido" });
    } catch { setStatus({ tone: "error", text: "Sem conexão com o servidor." }); } finally { setPending(false); }
  }

  return (
    <li className="team-wa-row">
      <span className="team-wa-person"><strong>{member.name}</strong><span>{roleLabels[member.role]}{!member.active ? " · inativo" : ""}{!member.hasAssistant ? " · sem acesso ao assistente" : ""}</span></span>
      <form className="team-wa-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <label className="visually-hidden" htmlFor={`wa-${member.id}`}>WhatsApp de {member.name}</label>
        <input className="control" id={`wa-${member.id}`} inputMode="tel" placeholder="(82) 99999-9999" value={value} onChange={(event) => { setValue(event.target.value); setStatus(null); }} />
        <button className="btn btn-secondary" type="submit" disabled={pending || !changed} aria-busy={pending}>{pending ? "Salvando..." : "Salvar"}</button>
      </form>
      <span className="team-wa-status" aria-live="polite">{status ? <StatusPill tone={status.tone === "ok" ? "positive" : "danger"}>{status.text}</StatusPill> : null}</span>
      {status?.tone === "error" ? <p className="team-wa-error"><Icon name="alert" className="icon-sm" />{status.text}</p> : null}
    </li>
  );
}

// Equipe no WhatsApp: o assistente reconhece cada pessoa pelo número daqui e usa as permissões do cargo dela.
export function TeamWhatsappPanel({ members }: { members: Member[] }) {
  return (
    <section className="section-block" id="equipe-whatsapp" aria-labelledby="team-wa-title">
      <div className="section-head">
        <div>
          <h2 className="section-title" id="team-wa-title">Equipe no WhatsApp</h2>
          <p className="section-lead">Cada pessoa fala com o assistente pelo próprio WhatsApp. Pelo número daqui a IA reconhece quem é e o cargo, e libera só o que esse cargo permite. Quem não estiver na lista é atendido como aluno (pelo telefone do cadastro) ou como lead.</p>
        </div>
      </div>
      {members.length ? <ul className="team-wa-list">{members.map((member) => <MemberRow key={member.id} member={member} />)}</ul> : <p className="ledger-empty">Nenhum colaborador cadastrado.</p>}
    </section>
  );
}
