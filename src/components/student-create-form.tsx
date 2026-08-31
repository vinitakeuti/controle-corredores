"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { formatCpfInput, formatPhoneInput } from "@/lib/format";

type CreatedStudent = { name: string; email: string; temporaryPassword: string; paymentUrl: string };
type CreationMode = "student" | "link";
type Method = "PIX" | "CARD" | "BOLETO";
type Plan = { id: string; period: "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL"; priceCents: number; service: { name: string } };
const periodLabels = { MONTHLY: "Mensal", QUARTERLY: "Trimestral", SEMIANNUAL: "Semestral", ANNUAL: "Anual" };

function buildMessage(result: CreatedStudent) {
  return `Olá, ${result.name}!\n\nSeu acesso à Pace Lab foi criado. Para concluir sua inscrição, acesse o link de pagamento:\n${result.paymentUrl}\n\nE-mail: ${result.email}\nSenha temporária: ${result.temporaryPassword}\n\nDepois da confirmação do pagamento, sua área de aluno ficará disponível.`;
}

export function StudentCreateForm({ initialAllowedMethods, plans }: { initialAllowedMethods: Method[]; plans: Plan[] }) {
  const [mode, setMode] = useState<CreationMode | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [planId, setPlanId] = useState("");
  const [allowedMethods, setAllowedMethods] = useState<Method[]>(initialAllowedMethods);
  const [result, setResult] = useState<CreatedStudent | null>(null);
  const [freeLink, setFreeLink] = useState<string | null>(null);
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const selectedPlan = plans.find((plan) => plan.id === planId);

  function reset() {
    setStep(1);
    setName(""); setEmail(""); setPhone(""); setCpf(""); setBirthDate(""); setPlanId(""); setAllowedMethods(initialAllowedMethods);
    setResult(null); setFreeLink(null); setError(""); setCopied("");
  }

  function changeMode(nextMode: CreationMode) {
    setMode(nextMode);
    reset();
  }

  function backToOptions() {
    reset();
    setMode(null);
  }

  function reviewDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStep(2);
  }

  async function createStudent() {
    if (allowedMethods.length === 0) {
      setError("Selecione pelo menos um método de pagamento.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/students", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, phone, cpf, birthDate, planId: planId || undefined, allowedMethods }) });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Não foi possível cadastrar o aluno.");
        return;
      }
      setResult(data);
      setStep(3);
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  }

  async function createFreeLink() {
    if (allowedMethods.length === 0) {
      setError("Selecione pelo menos um método de pagamento.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/payment-links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId: planId || undefined, allowedMethods }) });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Não foi possível gerar o link.");
        return;
      }
      setFreeLink(data.paymentUrl);
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  }

  async function copyText(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 1800);
    } catch {
      setError("Não foi possível copiar. Selecione o conteúdo manualmente.");
    }
  }

  function toggleMethod(method: Method) {
    setAllowedMethods((current) => current.includes(method) ? current.filter((item) => item !== method) : [...current, method]);
  }

  const billingFields = <div className="billing-fields plan-billing-fields">{plans.length ? <div className="field"><label htmlFor="new-student-plan">Plano inicial <span className="optional-label">opcional</span></label><select id="new-student-plan" value={planId} onChange={(event) => setPlanId(event.target.value)}><option value="">Aluno escolhe na área dele</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.service.name} · {periodLabels[plan.period]} — R$ {(plan.priceCents / 100).toFixed(2)}</option>)}</select></div> : <p className="billing-plans-empty">Cadastre planos antes de enviar acessos para os alunos.</p>}<fieldset className="method-options"><legend>Métodos permitidos</legend>{(["PIX", "CARD", "BOLETO"] as Method[]).map((method) => <label key={method}><input type="checkbox" checked={allowedMethods.includes(method)} onChange={() => toggleMethod(method)} />{method === "PIX" ? "Pix" : method === "CARD" ? "Cartão" : "Boleto"}</label>)}</fieldset></div>;

  if (!mode) {
    return (
      <section className="creation-options" aria-labelledby="creation-options-title">
        <div className="creation-options-heading">
          <p className="eyebrow">Adicionar aluno</p>
          <h2 id="creation-options-title">Como deseja começar?</h2>
          <p>Escolha uma das duas formas de iniciar o cadastro.</p>
        </div>
        <div className="creation-option-list">
          <button className="creation-option" type="button" onClick={() => changeMode("student")}>
            <span className="creation-option-index">01</span>
            <span className="creation-option-copy"><strong>Pré-cadastrar</strong><span>Informe os dados do aluno e receba as credenciais para enviar.</span></span>
            <span className="creation-option-arrow" aria-hidden="true">→</span>
          </button>
          <button className="creation-option" type="button" onClick={() => changeMode("link")}>
            <span className="creation-option-index">02</span>
            <span className="creation-option-copy"><strong>Link de pagamento</strong><span>Gere um link para o aluno preencher os dados e pagar.</span></span>
            <span className="creation-option-arrow" aria-hidden="true">→</span>
          </button>
        </div>
        <div className="creation-options-actions">
          <Link className="button button-quiet" href="/admin/alunos">Cancelar e voltar para Alunos</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="creation-flow">
      <div className="creation-mode-header">
        <button className="creation-back-button" type="button" onClick={backToOptions}>← Escolher outra forma</button>
        <span>{mode === "student" ? "Pré-cadastro" : "Link de pagamento"}</span>
      </div>

      {mode === "student" ? <>
        <div className="creation-stepper" aria-label="Etapas do cadastro"><button className={step >= 1 ? "active" : ""} type="button" onClick={() => step > 1 && setStep(1)}>01 <span>Dados</span></button><i /><button className={step >= 2 ? "active" : ""} type="button" onClick={() => step > 2 && setStep(2)}>02 <span>Revisar</span></button><i /><button className={step >= 3 ? "active" : ""} type="button">03 <span>Concluído</span></button></div>
        {step === 1 ? <form className="creation-stage" onSubmit={reviewDetails}><div className="creation-stage-heading"><div><p className="eyebrow">Etapa 1 de 3</p><h2>Dados do aluno</h2><p>Informe o essencial para criar o acesso e vincular o primeiro pagamento.</p></div></div><div className="creation-fields"><div className="field"><label htmlFor="new-student-name">Nome completo</label><input id="new-student-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required /></div><div className="field"><label htmlFor="new-student-email">E-mail</label><input id="new-student-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></div><div className="checkout-form-grid"><div className="field"><label htmlFor="new-student-phone">Telefone</label><input id="new-student-phone" value={phone} onChange={(event) => setPhone(formatPhoneInput(event.target.value))} inputMode="tel" autoComplete="tel" maxLength={15} required /></div><div className="field"><label htmlFor="new-student-cpf">CPF</label><input id="new-student-cpf" value={cpf} onChange={(event) => setCpf(formatCpfInput(event.target.value))} inputMode="numeric" maxLength={14} required /></div></div><div className="field"><label htmlFor="new-student-birth-date">Data de nascimento <span className="optional-label">opcional</span></label><input id="new-student-birth-date" type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} /></div>{billingFields}</div>{error ? <p className="error-message">{error}</p> : null}<div className="creation-actions"><div className="action-group action-group-left"><Link className="button button-quiet" href="/admin/alunos">Cancelar</Link></div><div className="action-group action-group-right"><button className="button button-dark" type="submit">Continuar para revisão</button></div></div></form> : null}
        {step === 2 ? <section className="creation-stage"><div className="creation-stage-heading"><div><p className="eyebrow">Etapa 2 de 3</p><h2>Confira os dados</h2><p>Revise antes de criar o acesso. Você ainda pode voltar e editar.</p></div></div><dl className="review-list"><div><dt>Nome</dt><dd>{name}</dd></div><div><dt>E-mail</dt><dd>{email}</dd></div><div><dt>Telefone</dt><dd>{phone}</dd></div><div><dt>CPF</dt><dd>{cpf}</dd></div><div><dt>Nascimento</dt><dd>{birthDate || "Não informado"}</dd></div><div><dt>Plano</dt><dd>{selectedPlan ? `${selectedPlan.service.name} · ${periodLabels[selectedPlan.period]}` : "Aluno escolhe na área dele"}</dd></div><div><dt>Pagamento</dt><dd>{allowedMethods.map((method) => method === "PIX" ? "Pix" : method === "CARD" ? "Cartão" : "Boleto").join(", ")}</dd></div></dl>{error ? <p className="error-message">{error}</p> : null}<div className="creation-actions review-actions"><div className="action-group action-group-left"><Link className="button button-quiet" href="/admin/alunos">Cancelar</Link></div><div className="action-group action-group-right"><button className="button button-quiet" type="button" onClick={() => setStep(1)}>Voltar</button><button className="button button-dark" type="button" onClick={createStudent} disabled={loading}>{loading ? "Criando acesso..." : "Criar acesso e gerar link"}</button></div></div></section> : null}
        {step === 3 && result ? <section className="creation-stage creation-success"><div className="creation-stage-heading"><div><p className="eyebrow">Etapa 3 de 3</p><h2>Acesso criado.</h2><p>Envie a mensagem abaixo. A senha não será exibida novamente.</p></div></div><div className="credential-grid"><div><span>Aluno</span><strong>{result.name}</strong></div><div><span>E-mail</span><strong>{result.email}</strong></div><div><span>Senha temporária</span><strong>{result.temporaryPassword}</strong></div></div><code className="creation-url">{result.paymentUrl}</code><div className="creation-actions"><div className="action-group action-group-left"><button className="button button-quiet" type="button" onClick={reset}>Cadastrar outro aluno</button></div><div className="action-group action-group-right"><button className="button button-secondary" type="button" onClick={() => copyText("link", result.paymentUrl)}>{copied === "link" ? "Link copiado" : "Copiar apenas o link"}</button><button className="button button-dark" type="button" onClick={() => copyText("message", buildMessage(result))}>{copied === "message" ? "Mensagem copiada" : "Copiar mensagem completa"}</button></div></div></section> : null}
      </> : <section className="creation-stage open-link-stage"><div className="creation-stage-heading"><div><p className="eyebrow">Link de pagamento</p><h2>Gere um link para enviar.</h2><p>O aluno informa nome, e-mail, telefone, CPF e cria a própria senha antes de pagar.</p></div></div>{billingFields}{error ? <p className="error-message">{error}</p> : null}{freeLink ? <div className="link-output"><span>Link pronto para enviar</span><code>{freeLink}</code><div className="creation-actions"><div className="action-group action-group-left"><button className="button button-quiet" type="button" onClick={() => setFreeLink(null)}>Gerar outro</button></div><div className="action-group action-group-right"><button className="button button-dark" type="button" onClick={() => copyText("link", freeLink)}>{copied === "link" ? "Link copiado" : "Copiar link"}</button></div></div></div> : <div className="creation-actions"><div className="action-group action-group-left"><Link className="button button-quiet" href="/admin/alunos">Cancelar</Link></div><div className="action-group action-group-right"><button className="button button-dark" type="button" onClick={createFreeLink} disabled={loading}>{loading ? "Gerando..." : "Gerar link de pagamento"}</button></div></div>}</section>}
    </section>
  );
}
