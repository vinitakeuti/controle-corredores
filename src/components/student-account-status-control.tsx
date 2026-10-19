"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

  return <section className="panel student-account-status-control">
    <div className="panel-heading"><div><p className="eyebrow">Acesso à assessoria</p><h2>{initialActive ? "Aluno ativo" : "Aluno inativo"}</h2><p>{initialActive ? "O aluno pode acessar a área dele e permanece incluído nos acompanhamentos financeiros." : "O aluno vê o aviso de conta inativa e pode acessar a loja. Ele fica fora da análise de alunos em atraso e da receita prevista."}</p></div><span className={`pill ${initialActive ? "" : "pill-coral"}`}>{initialActive ? "Ativo" : "Inativo"}</span></div>
    {canManage ? initialActive ? <div className="student-account-status-actions">{confirming ? <><p className="delete-warning">Isso suspende o acesso à assessoria, revoga os links abertos e retira o aluno da análise de atrasos. O histórico e as cobranças já emitidas serão preservados.</p><button className="button button-quiet" type="button" onClick={() => setConfirming(false)} disabled={pending}>Cancelar</button><button className="button button-danger" type="button" onClick={() => void changeStatus(false)} disabled={pending}>{pending ? "Inativando..." : "Confirmar inativação"}</button></> : <button className="button button-danger-quiet" type="button" onClick={() => setConfirming(true)} disabled={pending}>Inativar aluno</button>}</div> : <div className="student-account-status-actions"><button className="button button-dark" type="button" onClick={() => void changeStatus(true)} disabled={pending}>{pending ? "Reativando..." : "Reativar aluno"}</button></div> : <p className="student-account-status-note">Somente administradores podem alterar o acesso do aluno.</p>}
    {error ? <p className="error-message">{error}</p> : null}
    {message ? <p className="success-message">{message}</p> : null}
  </section>;
}
