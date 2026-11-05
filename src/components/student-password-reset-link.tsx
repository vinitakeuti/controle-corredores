"use client";

import { useRef, useState } from "react";
import { Feedback } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";

type Result = { resetUrl: string; expiresAt: string; emailSent: boolean; emailError: string | null; sentByEmail: boolean };

const expiryFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Maceio", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// Ferramenta pouco usada: fica recolhida no perfil e abre no próprio fluxo da página.
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

  const inputId = `reset-link-${studentId}`;

  return <details className="disclosure" open={Boolean(result) || undefined}>
    <summary>
      <span>
        <span className="section-title">Redefinição de senha</span>
        <span className="section-lead disclosure-lead">Gere um link para o aluno criar uma nova senha e envie por WhatsApp ou outro canal quando o e-mail não chegar.</span>
      </span>
      <Icon name="chevronRight" />
    </summary>
    <div className="disclosure-body">
      {active ? <div className="btn-row">
        <button className="btn btn-secondary" type="button" onClick={() => void generate(false)} disabled={pending !== null} aria-busy={pending === "link"}><Icon name="link" />{pending === "link" ? "Gerando..." : "Gerar link"}</button>
        <button className="btn btn-quiet" type="button" onClick={() => void generate(true)} disabled={pending !== null} aria-busy={pending === "email"}><Icon name="mail" />{pending === "email" ? "Enviando..." : "Gerar e enviar por e-mail"}</button>
      </div> : <p className="field-hint">Reative o aluno para gerar um link de redefinição de senha.</p>}
      {result ? <div className="form-field reset-link-result">
        <label htmlFor={inputId}>Link de redefinição</label>
        <div className="control-group">
          <input className="control" id={inputId} readOnly value={result.resetUrl} onFocus={(event) => event.target.select()} ref={linkInput} aria-describedby={`${inputId}-hint`} />
          <button className="btn btn-secondary" type="button" onClick={() => void copy()}><Icon name={copied ? "check" : "copy"} />{copied ? "Copiado" : "Copiar"}</button>
        </div>
        <p className="field-hint" id={`${inputId}-hint`}>Válido até {expiryFormat.format(new Date(result.expiresAt))} e apenas para um uso. Gerar um novo link invalida os anteriores.</p>
        <span className="visually-hidden" aria-live="polite">{copied ? "Link copiado." : ""}</span>
      </div> : null}
      <Feedback
        success={result?.sentByEmail && result.emailSent ? `Link também enviado para ${studentEmail}.` : undefined}
        error={error || (result?.sentByEmail && !result.emailSent ? `O e-mail não foi enviado. ${result.emailError ?? "Falha no envio."} Copie o link acima e envie manualmente.` : undefined)}
      />
    </div>
  </details>;
}
