"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Feedback } from "@/components/ui/feedback";
import { StatusPill } from "@/components/ui/status-pill";
import { formatCpfInput, formatPhoneInput } from "@/lib/format";

export type SignupPlanOption = { id: string; title: string; price: string; per: string | null; detail: string; isFeatured: boolean };

// Cadastro feito pela própria pessoa (QR de evento ou link de indicação):
// escolher o plano e preencher os dados numa tela só. Com lockedCoupon, o cupom
// vem do link e não pode ser trocado.
export function SelfSignupForm({ endpoint, plans, lockedCoupon = null }: { endpoint: string; plans: SignupPlanOption[]; lockedCoupon?: string | null }) {
  const router = useRouter();
  const [planId, setPlanId] = useState(() => (plans.find((plan) => plan.isFeatured) ?? plans[0])?.id ?? "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [password, setPassword] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!planId) { setError("Escolha um plano para continuar."); return; }
    setLoading(true);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId, name, email, phone, cpf, birthDate, password, ...(lockedCoupon ? {} : { couponCode }) }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Não foi possível continuar."); return; }
      // O plano já foi escolhido aqui: a área do aluno abre direto no pagamento.
      router.replace("/aluno?etapa=pagamento");
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  }

  return <form className="access-form card-signup" onSubmit={submit}>
    <fieldset className="choice-set">
      <legend><span className="section-title">Escolha seu plano</span></legend>
      <div className="choice-cards card-signup-plans">
        {plans.map((plan) => <label className="choice-card" key={plan.id}>
          <input type="radio" name="card-plan" value={plan.id} checked={planId === plan.id} onChange={() => setPlanId(plan.id)} />
          <span className="choice-card-copy">
            <strong>{plan.title}{plan.isFeatured ? <StatusPill tone="info">Mais escolhido</StatusPill> : null}</strong>
            <span className="choice-card-price">{plan.price}{plan.per ? <small> {plan.per}</small> : null}</span>
            <small>{plan.detail}</small>
          </span>
        </label>)}
      </div>
    </fieldset>
    <fieldset className="choice-set card-signup-fields">
      <legend><span className="section-title">Seus dados</span></legend>
      <div className="form-field"><label htmlFor="card-name">Nome completo</label><input className="control" id="card-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required /></div>
      <div className="form-grid"><div className="form-field"><label htmlFor="card-phone">Telefone</label><input className="control" id="card-phone" value={phone} onChange={(event) => setPhone(formatPhoneInput(event.target.value))} autoComplete="tel" inputMode="tel" maxLength={15} required /></div><div className="form-field"><label htmlFor="card-cpf">CPF</label><input className="control" id="card-cpf" value={cpf} onChange={(event) => setCpf(formatCpfInput(event.target.value))} inputMode="numeric" maxLength={14} required /></div></div>
      <div className="form-field"><label htmlFor="card-birth-date">Data de nascimento <span className="optional-tag">opcional</span></label><input className="control" id="card-birth-date" type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} /></div>
      <div className="form-field"><label htmlFor="card-email">E-mail</label><input className="control" id="card-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></div>
      <div className="form-field"><label htmlFor="card-password">Crie uma senha</label><input className="control" id="card-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={8} required aria-describedby="card-password-hint" /><p className="field-hint" id="card-password-hint">Mínimo de 8 caracteres.</p></div>
      {lockedCoupon ? null : <div className="form-field"><label htmlFor="card-coupon">Cupom <span className="optional-tag">opcional</span></label><input className="control coupon-input" id="card-coupon" value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase().replace(/\s+/g, ""))} maxLength={20} autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="Ex.: PACELAB10" /></div>}
    </fieldset>
    <Feedback error={error} />
    <button className="btn btn-primary btn-block" type="submit" disabled={loading} aria-busy={loading}>{loading ? "Aguarde..." : "Criar acesso e continuar"}</button>
  </form>;
}
