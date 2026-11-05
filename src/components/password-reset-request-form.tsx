"use client";

import { FormEvent, useState } from "react";
import { Feedback } from "@/components/ui/feedback";

export function PasswordResetRequestForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/auth/password-reset/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Não foi possível enviar o e-mail."); return; }
      setMessage(data.message);
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setLoading(false); }
  }
  return <form className="auth-form" onSubmit={submit}>
    <div className="form-field"><label htmlFor="reset-email">E-mail</label><input className="control" id="reset-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
    <Feedback success={message} error={error} />
    <button className="btn btn-primary btn-block" type="submit" disabled={loading} aria-busy={loading}>{loading ? "Enviando..." : "Enviar link de redefinição"}</button>
  </form>;
}
