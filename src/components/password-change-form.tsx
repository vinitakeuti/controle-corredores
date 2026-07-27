"use client";

import { FormEvent, useState } from "react";

export function PasswordChangeForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Não foi possível alterar a senha."); return; }
      setMessage("Senha alterada com sucesso."); setCurrentPassword(""); setNewPassword("");
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setLoading(false); }
  }

  return <form className="security-form" onSubmit={submit}><div className="checkout-form-grid"><div className="field"><label htmlFor="current-password">Senha atual</label><input id="current-password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required /></div><div className="field"><label htmlFor="new-password">Nova senha</label><input id="new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={8} required /></div></div>{error ? <p className="error-message">{error}</p> : null}{message ? <p className="success-message">{message}</p> : null}<button className="button button-secondary" type="submit" disabled={loading}>{loading ? "Salvando..." : "Alterar senha"}</button></form>;
}
