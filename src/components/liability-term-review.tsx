"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { liabilityTermStatusLabel as statusLabel, type LiabilityTermStatus as Status } from "@/components/liability-term-labels";
import { Feedback } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { StatusPill, toneForLabel } from "@/components/ui/status-pill";

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

  const titleId = `term-title-${studentId}`;

  return (
    <section className="section-block term-review" aria-labelledby={titleId}>
      <div className="section-head">
        <div>
          <h2 className="section-title" id={titleId}>Termo de responsabilidade</h2>
          <p className="section-lead">{status === "SUBMITTED" ? "Confira a assinatura no VALIDAR do ITI antes de aprovar." : status === "APPROVED" ? "Documento assinado digitalmente e validado pela administração." : status === "REJECTED" ? "O aluno pode enviar um novo PDF assinado." : "O aluno ainda não enviou o PDF assinado."}</p>
        </div>
        <StatusPill tone={toneForLabel(statusLabel[status])}>{statusLabel[status]}</StatusPill>
      </div>

      {hasSignedPdf ? <div className="term-file">
        <Icon name="file" />
        <div className="term-file-copy">
          <strong>{fileName || "Termo assinado em PDF"}</strong>
          <small>{submittedAt ? `Enviado em ${submittedAt}` : "PDF enviado pelo aluno"}{reviewedAt ? ` · Revisado em ${reviewedAt}` : ""}</small>
        </div>
        <a className="btn btn-secondary" href={`/api/admin/students/${encodeURIComponent(studentId)}/liability-term`} target="_blank" rel="noreferrer">Abrir PDF<Icon name="external" className="icon-sm" /><span className="visually-hidden"> (abre em nova aba)</span></a>
      </div> : null}

      {status === "SUBMITTED" ? <div className="term-decision">
        <div className="message term-validation" data-tone="info">
          <Icon name="info" />
          <div>
            <strong>Valide a assinatura digital</strong>
            <p>Abra o arquivo, envie-o ao VALIDAR do ITI e confirme a validade antes de liberar o aluno.</p>
            <a href="https://validar.iti.gov.br" target="_blank" rel="noreferrer">Validar no ITI<Icon name="external" className="icon-sm" /><span className="visually-hidden"> (abre em nova aba)</span></a>
          </div>
        </div>
        <div className="form-field">
          <label htmlFor={`term-review-note-${studentId}`}>Observação da validação</label>
          <textarea className="control" id={`term-review-note-${studentId}`} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Opcional ao aprovar; obrigatória se solicitar novo envio." rows={3} />
        </div>
        <div className="btn-row">
          <button className="btn btn-primary" type="button" disabled={pending} aria-busy={pending} onClick={() => review("APPROVE")}>{pending ? "Salvando..." : "Aprovar e liberar aluno"}</button>
          <button className="btn btn-secondary" type="button" disabled={pending} onClick={() => review("REJECT")}>Solicitar novo envio</button>
        </div>
      </div> : reviewNote ? <p className="term-note"><strong>Observação:</strong> {reviewNote}</p> : null}
      <Feedback error={error} />
    </section>
  );
}
