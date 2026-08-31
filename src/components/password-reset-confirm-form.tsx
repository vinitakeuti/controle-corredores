"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function PasswordResetConfirmForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (password !== confirmation) { setError("As senhas não coincidem."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/password-reset/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Não foi possível redefinir a senha."); return; }
      router.replace("/login?password=updated");
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setLoading(false); }
  }
  return <form onSubmit={submit}><div className="field"><label htmlFor="new-password">Nova senha</label><input id="new-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} required /></div><div className="field"><label htmlFor="confirm-password">Confirme a nova senha</label><input id="confirm-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></div>{error ? <p className="error-message">{error}</p> : null}<button className="button button-primary" type="submit" disabled={loading}>{loading ? "Salvando..." : "Redefinir senha"}</button></form>;
}
