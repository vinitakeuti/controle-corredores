"use client";

import { FormEvent, useState } from "react";
import { Feedback } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { STORE_URL } from "@/lib/store-url";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [inactive, setInactive] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setInactive(false);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "E-mail ou senha inválidos.");
        setInactive(data.inactive === true);
        return;
      }
      window.location.assign(data.redirectTo);
    } catch {
      setError("Não foi possível conectar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="form-field">
        <label htmlFor="email">E-mail</label>
        <input className="control" id="email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </div>
      <div className="form-field">
        <label htmlFor="password">Senha</label>
        <input className="control" id="password" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
      </div>
      <p className="auth-helper auth-helper-inline"><a className="link" href="/recuperar-senha">Esqueci minha senha</a></p>
      <Feedback error={error} />
      {error && inactive ? <a className="btn btn-secondary" href={STORE_URL}><Icon name="store" />IR PARA A LOJA</a> : null}
      <button className="btn btn-primary btn-block" type="submit" disabled={loading} aria-busy={loading}>{loading ? "Entrando..." : "Entrar"}</button>
    </form>
  );
}
