"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Status = "PENDING" | "SUBMITTED" | "APPROVED" | "REJECTED";

const statusLabel: Record<Status, string> = {
  PENDING: "Aguardando envio",
  SUBMITTED: "Aguardando validação",
  APPROVED: "Validado",
  REJECTED: "Novo envio solicitado",
};

export function LiabilityTermReview({ studentId, status, fileName, submittedAt, reviewedAt, reviewNote, hasSignedPdf }: { studentId: string; status: Status; fileName: string | null; submittedAt: string | null; reviewedAt: string | null; reviewNote: string | null; hasSignedPdf: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState(reviewNote ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function review(action: "APPROVE" | "REJECT") {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/students/${encodeURIComponent(studentId)}/liability-term`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, note }) });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Não foi possível atualizar o termo.");
        return;
      }
      router.refresh();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setPending(false);
    }
  }

  return <section className="panel profile-payments liability-term-review"><div className="panel-heading"><div><p className="eyebrow">Termo de responsabilidade</p><h2>{statusLabel[status]}</h2><p>{status === "SUBMITTED" ? "Confira a assinatura no VALIDAR do ITI antes de aprovar." : status === "APPROVED" ? "Documento assinado digitalmente e validado pela administração." : status === "REJECTED" ? "O aluno pode enviar um novo PDF assinado." : "O aluno ainda não enviou o PDF assinado."}</p></div><span className={`pill ${status === "REJECTED" ? "pill-coral" : ""}`}>{statusLabel[status]}</span></div>{hasSignedPdf ? <div className="term-review-file"><div><strong>{fileName || "Termo assinado em PDF"}</strong><small>{submittedAt ? `Enviado em ${submittedAt}` : "PDF enviado pelo aluno"}{reviewedAt ? ` · Revisado em ${reviewedAt}` : ""}</small></div><a className="button button-quiet" href={`/api/admin/students/${encodeURIComponent(studentId)}/liability-term`} target="_blank" rel="noreferrer">Abrir PDF</a></div> : null}{status === "SUBMITTED" ? <div className="term-review-actions"><a className="term-validator-link" href="https://validar.iti.gov.br" target="_blank" rel="noreferrer">Validar assinatura no ITI ↗</a><div className="field"><label htmlFor="term-review-note">Observação da validação</label><textarea id="term-review-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Opcional ao aprovar; obrigatório se solicitar novo envio." rows={3} /></div>{error ? <p className="error-message">{error}</p> : null}<div className="creation-actions"><button className="button button-dark" type="button" disabled={pending} onClick={() => review("APPROVE")}>{pending ? "Salvando..." : "Aprovar termo"}</button><button className="button button-danger-quiet" type="button" disabled={pending} onClick={() => review("REJECT")}>Solicitar novo envio</button></div></div> : reviewNote ? <p className="term-review-note"><strong>Observação:</strong> {reviewNote}</p> : null}</section>;
}
