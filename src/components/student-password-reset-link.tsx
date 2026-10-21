"use client";

import { useRef, useState } from "react";

type Result = { resetUrl: string; expiresAt: string; emailSent: boolean; emailError: string | null; sentByEmail: boolean };

const expiryFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Maceio", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function StudentPasswordResetLink({ studentId, studentEmail, active }: { studentId: string; studentEmail: string; active: boolean }) {
  const [pending, setPending] = useState<"link" | "email" | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const linkInput = useRef<HTMLInputElement>(null);

  async function generate(sendEmail: boolean) {
    setPending(sendEmail ? "email" : "link");
    setError("");
    setCopied(false);
    try {
      const response = await fetch(`/api/admin/students/${encodeURIComponent(studentId)}/password-reset-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendEmail }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "Não foi possível gerar o link.");
        return;
      }
      setResult({ ...data, sentByEmail: sendEmail });
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setPending(null);
    }
  }

  async function copy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.resetUrl);
    } catch {
      linkInput.current?.select();
      document.execCommand("copy");
    }
    setCopied(true);
  }

  return <section className="panel student-reset-link">
    <div className="panel-heading"><div><p className="eyebrow">Acesso do aluno</p><h2>Redefinição de senha</h2><p>Gere um link para o aluno criar uma nova senha e envie por WhatsApp ou outro canal quando o e-mail não chegar.</p></div></div>
    {active ? <div className="student-reset-link-actions">
      <button className="button button-dark" type="button" onClick={() => void generate(false)} disabled={pending !== null}>{pending === "link" ? "Gerando..." : "Gerar link"}</button>
      <button className="button button-quiet" type="button" onClick={() => void generate(true)} disabled={pending !== null}>{pending === "email" ? "Enviando..." : "Gerar e enviar por e-mail"}</button>
    </div> : <p className="student-account-status-note">Reative o aluno para gerar um link de redefinição de senha.</p>}
    {error ? <p className="error-message">{error}</p> : null}
    {result ? <div className="student-reset-link-result">
      <label htmlFor={`reset-link-${studentId}`}>Link de redefinição</label>
      <div><input id={`reset-link-${studentId}`} readOnly value={result.resetUrl} onFocus={(event) => event.target.select()} ref={linkInput} /><button className="button button-dark" type="button" onClick={() => void copy()}>{copied ? "Copiado ✓" : "Copiar"}</button></div>
      <small>Válido até {expiryFormat.format(new Date(result.expiresAt))} e apenas para um uso. Gerar um novo link invalida os anteriores.</small>
      {result.sentByEmail ? result.emailSent ? <p className="success-message">Link também enviado para {studentEmail}.</p> : <p className="error-message">O e-mail não foi enviado. {result.emailError ?? "Falha no envio."} Copie o link acima e envie manualmente.</p> : null}
    </div> : null}
  </section>;
}
