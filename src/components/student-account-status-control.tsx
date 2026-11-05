"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Feedback } from "@/components/ui/feedback";
import { StatusPill } from "@/components/ui/status-pill";

export function StudentAccountStatusControl({ studentId, initialActive, canManage }: { studentId: string; initialActive: boolean; canManage: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function changeStatus(active: boolean) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/students/${encodeURIComponent(studentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-active", active }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "Não foi possível atualizar o acesso do aluno.");
        return;
      }
      setConfirming(false);
      setMessage(active ? "Aluno reativado. A condição comercial foi preservada, sem retomar débitos automáticos anteriores." : "Aluno inativado. O acesso à assessoria foi suspenso e o histórico foi preservado.");
      router.refresh();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setPending(false);
    }
  }

  return <section className="section-block" aria-labelledby={`account-status-${studentId}`}>
    <div className="section-head">
      <div>
        <h2 className="section-title" id={`account-status-${studentId}`}>Acesso à assessoria</h2>
        <p className="section-lead">{initialActive ? "O aluno pode acessar a área dele e permanece incluído nos acompanhamentos financeiros." : "O aluno vê o aviso de conta inativa e pode acessar a loja. Ele fica fora da análise de alunos em atraso e da receita prevista."}</p>
      </div>
      <StatusPill tone={initialActive ? "positive" : "neutral"}>{initialActive ? "Ativo" : "Inativo"}</StatusPill>
    </div>
    {canManage ? initialActive ? confirming ? <div className="message-stack">
      <p className="message" data-tone="warning"><Icon name="alert" /><span>Isso suspende o acesso à assessoria, revoga os links abertos e retira o aluno da análise de atrasos. O histórico e as cobranças já emitidas serão preservados.</span></p>
      <div className="btn-row">
        <button className="btn btn-secondary" type="button" onClick={() => setConfirming(false)} disabled={pending}>Cancelar</button>
        <button className="btn btn-danger-solid" type="button" onClick={() => void changeStatus(false)} disabled={pending} aria-busy={pending}>{pending ? "Inativando..." : "Confirmar inativação"}</button>
      </div>
    </div> : <div className="btn-row"><button className="btn btn-danger" type="button" onClick={() => setConfirming(true)} disabled={pending}>Inativar aluno</button></div>
      : <div className="btn-row"><button className="btn btn-primary" type="button" onClick={() => void changeStatus(true)} disabled={pending} aria-busy={pending}>{pending ? "Reativando..." : "Reativar aluno"}</button></div>
      : <p className="field-hint">Somente administradores podem alterar o acesso do aluno.</p>}
    <Feedback success={message} error={error} />
  </section>;
}
