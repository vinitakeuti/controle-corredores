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

  return (
    <section className={`panel profile-payments liability-term-review liability-term-review-${status.toLowerCase()}`}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Termo de responsabilidade</p>
          <h2>{statusLabel[status]}</h2>
          <p>{status === "SUBMITTED" ? "Confira a assinatura no VALIDAR do ITI antes de aprovar." : status === "APPROVED" ? "Documento assinado digitalmente e validado pela administração." : status === "REJECTED" ? "O aluno pode enviar um novo PDF assinado." : "O aluno ainda não enviou o PDF assinado."}</p>
        </div>
        <span className={`pill ${status === "REJECTED" ? "pill-coral" : ""}`}>{statusLabel[status]}</span>
      </div>

      {hasSignedPdf ? <div className="term-review-file">
        <div>
          <strong>{fileName || "Termo assinado em PDF"}</strong>
          <small>{submittedAt ? `Enviado em ${submittedAt}` : "PDF enviado pelo aluno"}{reviewedAt ? ` · Revisado em ${reviewedAt}` : ""}</small>
        </div>
        <a className="term-review-open-file" href={`/api/admin/students/${encodeURIComponent(studentId)}/liability-term`} target="_blank" rel="noreferrer">Abrir PDF <span aria-hidden="true">↗</span></a>
      </div> : null}

      {status === "SUBMITTED" ? <div className="term-review-actions">
        <div className="term-validation-callout">
          <div><span aria-hidden="true">1</span><div><strong>Valide a assinatura digital</strong><p>Abra o arquivo, envie-o ao VALIDAR do ITI e confirme a validade antes de liberar o aluno.</p></div></div>
          <a href="https://validar.iti.gov.br" target="_blank" rel="noreferrer">Validar no ITI <b aria-hidden="true">↗</b></a>
        </div>
        <div className="field term-review-note-field">
          <label htmlFor="term-review-note">Observação da validação</label>
          <textarea id="term-review-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Opcional ao aprovar; obrigatória se solicitar novo envio." rows={3} />
        </div>
        {error ? <p className="error-message">{error}</p> : null}
        <div className="term-review-decision-actions">
          <button className="button button-dark" type="button" disabled={pending} onClick={() => review("APPROVE")}>{pending ? "Salvando..." : "Aprovar e liberar aluno"}</button>
          <button className="button term-review-reject" type="button" disabled={pending} onClick={() => review("REJECT")}>Solicitar novo envio</button>
        </div>
      </div> : reviewNote ? <p className="term-review-note"><strong>Observação:</strong> {reviewNote}</p> : null}
    </section>
  );
}
