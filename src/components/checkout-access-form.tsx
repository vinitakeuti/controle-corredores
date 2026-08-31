"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCpfInput, formatPhoneInput } from "@/lib/format";

type CheckoutAccessFormProps = { token: string; mode: "login" | "register"; initialEmail?: string };

export function CheckoutAccessForm({ token, mode, initialEmail = "" }: CheckoutAccessFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const endpoint = mode === "login" ? "login" : "register";
    const body = mode === "login" ? { email, password } : { name, email, phone, cpf, birthDate, password };
    try {
      const response = await fetch(`/api/checkout/${encodeURIComponent(token)}/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Não foi possível continuar.");
        return;
      }
      router.replace("/aluno");
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="checkout-form" onSubmit={handleSubmit}>
      {mode === "register" ? <>
        <div className="field"><label htmlFor="checkout-name">Nome completo</label><input id="checkout-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required /></div>
        <div className="checkout-form-grid"><div className="field"><label htmlFor="checkout-phone">Telefone</label><input id="checkout-phone" value={phone} onChange={(event) => setPhone(formatPhoneInput(event.target.value))} autoComplete="tel" inputMode="tel" maxLength={15} required /></div><div className="field"><label htmlFor="checkout-cpf">CPF</label><input id="checkout-cpf" value={cpf} onChange={(event) => setCpf(formatCpfInput(event.target.value))} inputMode="numeric" maxLength={14} required /></div></div>
        <div className="field"><label htmlFor="checkout-birth-date">Data de nascimento <span className="optional-label">opcional</span></label><input id="checkout-birth-date" type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} /></div>
      </> : null}
      <div className="field"><label htmlFor="checkout-email">E-mail</label><input id="checkout-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></div>
      <div className="field"><label htmlFor="checkout-password">Senha</label><input id="checkout-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required /></div>
      {error ? <p className="error-message">{error}</p> : null}
      <button className="button button-primary" type="submit" disabled={loading}>{loading ? "Aguarde..." : mode === "login" ? "Entrar e continuar" : "Criar acesso e continuar"}</button>
    </form>
  );
}
