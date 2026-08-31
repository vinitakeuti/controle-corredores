"use client";

import { FormEvent, useState } from "react";

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
  return <form onSubmit={submit}><div className="field"><label htmlFor="reset-email">E-mail</label><input id="reset-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>{error ? <p className="error-message">{error}</p> : null}{message ? <p className="success-message">{message}</p> : null}<button className="button button-primary" type="submit" disabled={loading}>{loading ? "Enviando..." : "Enviar link de redefinição"}</button></form>;
}
