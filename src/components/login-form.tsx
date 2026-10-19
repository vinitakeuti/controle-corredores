"use client";

import { FormEvent, useState } from "react";
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
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="password">Senha</label>
        <input id="password" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
      </div>
      <p className="login-helper"><a href="/recuperar-senha">Esqueci minha senha</a></p>
      {error ? <div className="login-status-message"><p className="error-message">{error}</p>{inactive ? <a className="button button-secondary login-store-link" href={STORE_URL}>IR PARA A LOJA</a> : null}</div> : null}
      <button className="button button-primary" type="submit" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</button>
    </form>
  );
}
