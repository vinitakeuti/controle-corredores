"use client";

import { FormEvent, useState } from "react";
import { Feedback } from "@/components/ui/feedback";

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

  return <form className="password-form" onSubmit={submit}>
    <div className="form-grid">
      <div className="form-field"><label htmlFor="current-password">Senha atual</label><input className="control" id="current-password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required /></div>
      <div className="form-field"><label htmlFor="new-password">Nova senha</label><input className="control" id="new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={8} required aria-describedby="new-password-hint" /><p className="field-hint" id="new-password-hint">Mínimo de 8 caracteres.</p></div>
    </div>
    <Feedback success={message} error={error} />
    <div className="btn-row"><button className="btn btn-secondary" type="submit" disabled={loading} aria-busy={loading}>{loading ? "Salvando..." : "Alterar senha"}</button></div>
  </form>;
}
