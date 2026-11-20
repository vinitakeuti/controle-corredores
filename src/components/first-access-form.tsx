"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Feedback } from "@/components/ui/feedback";

export function FirstAccessForm({ token, email }: { token: string; email: string }) {
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
      const response = await fetch("/api/auth/first-access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Não foi possível criar sua senha."); return; }
      router.replace(typeof data.redirectTo === "string" ? data.redirectTo : "/aluno");
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setLoading(false); }
  }
  return <form className="auth-form" onSubmit={submit}>
    <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
    <div className="form-field"><label htmlFor="first-password">Crie sua senha</label><input className="control" id="first-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} required aria-describedby="first-password-hint" /><p className="field-hint" id="first-password-hint">Mínimo de 8 caracteres.</p></div>
    <div className="form-field"><label htmlFor="first-password-confirm">Confirme a senha</label><input className="control" id="first-password-confirm" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required aria-invalid={error === "As senhas não coincidem." || undefined} /></div>
    <Feedback error={error} />
    <button className="btn btn-primary btn-block" type="submit" disabled={loading} aria-busy={loading}>{loading ? "Entrando..." : "Criar senha e entrar"}</button>
  </form>;
}
