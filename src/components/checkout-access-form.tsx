"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Feedback } from "@/components/ui/feedback";
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
    <form className="access-form" onSubmit={handleSubmit}>
      {mode === "register" ? <>
        <div className="form-field"><label htmlFor="checkout-name">Nome completo</label><input className="control" id="checkout-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required /></div>
        <div className="form-grid"><div className="form-field"><label htmlFor="checkout-phone">Telefone</label><input className="control" id="checkout-phone" value={phone} onChange={(event) => setPhone(formatPhoneInput(event.target.value))} autoComplete="tel" inputMode="tel" maxLength={15} required /></div><div className="form-field"><label htmlFor="checkout-cpf">CPF</label><input className="control" id="checkout-cpf" value={cpf} onChange={(event) => setCpf(formatCpfInput(event.target.value))} inputMode="numeric" maxLength={14} required /></div></div>
        <div className="form-field"><label htmlFor="checkout-birth-date">Data de nascimento <span className="optional-tag">opcional</span></label><input className="control" id="checkout-birth-date" type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} /></div>
      </> : null}
      <div className="form-field"><label htmlFor="checkout-email">E-mail</label><input className="control" id="checkout-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></div>
      <div className="form-field"><label htmlFor="checkout-password">Senha</label><input className="control" id="checkout-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required aria-describedby={mode === "register" ? "checkout-password-hint" : undefined} />{mode === "register" ? <p className="field-hint" id="checkout-password-hint">Mínimo de 8 caracteres.</p> : null}</div>
      <Feedback error={error} />
      <button className="btn btn-primary btn-block" type="submit" disabled={loading} aria-busy={loading}>{loading ? "Aguarde..." : mode === "login" ? "Entrar e continuar" : "Criar acesso e continuar"}</button>
    </form>
  );
}
