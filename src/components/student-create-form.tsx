"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Feedback } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { QrPanel } from "@/components/ui/qr-code";
import { formatCpfInput, formatPhoneInput } from "@/lib/format";

type CreatedStudent = { name: string; email: string; temporaryPassword: string; paymentUrl: string; firstAccessUrl?: string | null; isCourtesy?: boolean };
type CreationMode = "student" | "link";
export type SpecialPlan = { id: string; label: string; isCourtesy: boolean };

function buildMessage(result: CreatedStudent) {
  if (result.isCourtesy) return `Olá, ${result.name}!\n\nSeu acesso à Pace Lab foi criado com uma cortesia. Para entrar, acesse:\n${result.paymentUrl}\n\nE-mail: ${result.email}\nSenha temporária: ${result.temporaryPassword}\n\nNão há pagamento a fazer. Bons treinos!`;
  return `Olá, ${result.name}!\n\nSeu acesso à Pace Lab foi criado. Para concluir sua inscrição, acesse o link de pagamento:\n${result.paymentUrl}\n\nE-mail: ${result.email}\nSenha temporária: ${result.temporaryPassword}\n\nDepois da confirmação do pagamento, sua área de aluno ficará disponível.`;
}

// Condição do novo aluno: planos públicos (ele escolhe) ou um plano oculto,
// que só a equipe vê e aplica.
function PlanChoice({ id, plans, value, onChange }: { id: string; plans: SpecialPlan[]; value: string; onChange: (value: string) => void }) {
  if (!plans.length) return null;
  return <div className="form-field create-field-wide">
    <label htmlFor={id}>Condição</label>
    <select className="control" id={id} value={value} onChange={(event) => onChange(event.target.value)} aria-describedby={`${id}-hint`}>
      <option value="">Planos públicos (o aluno escolhe)</option>
      <optgroup label="Planos ocultos">{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.label}</option>)}</optgroup>
    </select>
    <p className="field-hint" id={`${id}-hint`}>Planos ocultos não aparecem para os alunos. Com um deles, o aluno entra direto nessa condição.</p>
  </div>;
}

const steps = ["Dados", "Revisar", "Concluído"] as const;

export function StudentCreateForm({ specialPlans = [], canUseSalesCards = false }: { specialPlans?: SpecialPlan[]; canUseSalesCards?: boolean }) {
  const [mode, setMode] = useState<CreationMode | null>(null);
  const [planId, setPlanId] = useState("");
  const [linkPlanLabel, setLinkPlanLabel] = useState<string | null>(null);
  const [linkCourtesy, setLinkCourtesy] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [result, setResult] = useState<CreatedStudent | null>(null);
  const [freeLink, setFreeLink] = useState<string | null>(null);
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function reset() {
    setStep(1);
    setName(""); setEmail(""); setPhone(""); setCpf(""); setBirthDate(""); setCouponCode("");
    setResult(null); setFreeLink(null); setLinkPlanLabel(null); setError(""); setCopied(""); setPlanId("");
  }
  const chosenPlan = specialPlans.find((plan) => plan.id === planId) ?? null;

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
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/students", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, phone, cpf, birthDate, couponCode, ...(planId ? { planId } : {}) }) });
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
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/payment-links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(planId ? { planId } : {}) });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Não foi possível gerar o link.");
        return;
      }
      setFreeLink(data.paymentUrl);
      setLinkPlanLabel(data.planName ? `${data.planName}${data.isCourtesy ? " (cortesia)" : ""}` : null);
      setLinkCourtesy(Boolean(data.isCourtesy));
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

  if (!mode) {
    return (
      <section className="section-block create-options" aria-labelledby="creation-options-title">
        <div className="section-head">
          <div><h2 className="section-title" id="creation-options-title">Como deseja começar?</h2><p className="section-lead">Escolha uma das duas formas de iniciar o cadastro.</p></div>
        </div>
        <ul className="choice-list">
          <li><button className="choice" type="button" onClick={() => changeMode("student")}>
            <Icon name="users" />
            <span className="choice-copy"><strong>Pré-cadastrar</strong><span>Informe os dados do aluno e mostre um QR Code para ele criar a senha, ou envie as credenciais.</span></span>
            <Icon name="chevronRight" />
          </button></li>
          <li><button className="choice" type="button" onClick={() => changeMode("link")}>
            <Icon name="link" />
            <span className="choice-copy"><strong>Link de pagamento</strong><span>Gere um link ou QR Code para o aluno preencher os dados e pagar por conta própria.</span></span>
            <Icon name="chevronRight" />
          </button></li>
          {canUseSalesCards ? <li><Link className="choice" href="/admin/vendas/cartoes">
            <Icon name="store" />
            <span className="choice-copy"><strong>Cartão de venda para eventos</strong><span>Um QR Code em exibição para várias pessoas se cadastrarem sozinhas, com prazo de validade.</span></span>
            <Icon name="chevronRight" />
          </Link></li> : null}
        </ul>
        <div className="btn-row create-actions-start"><Link className="btn btn-quiet" href="/admin/alunos">Cancelar e voltar para Alunos</Link></div>
      </section>
    );
  }

  return (
    <section className="section-block create-flow" aria-label={mode === "student" ? "Pré-cadastro" : "Link de pagamento"}>
      <div className="create-mode-bar">
        <button className="btn btn-quiet" type="button" onClick={backToOptions}><Icon name="arrowLeft" />Escolher outra forma</button>
        <span className="status-pill" data-tone="neutral">{mode === "student" ? "Pré-cadastro" : "Link de pagamento"}</span>
      </div>

      {mode === "student" ? <>
        <ol className="stepper" aria-label="Etapas do cadastro">
          {steps.map((label, index) => {
            const number = (index + 1) as 1 | 2 | 3;
            const state = step === number ? "current" : step > number ? "done" : "todo";
            const canGoBack = state === "done" && step < 3;
            return <li key={label} className="stepper-item" data-state={state} aria-current={state === "current" ? "step" : undefined}>
              {canGoBack ? <button type="button" onClick={() => setStep(number)}><span className="stepper-index">{number}</span>{label}</button> : <span><span className="stepper-index">{state === "done" ? <Icon name="check" className="icon-sm" /> : number}</span>{label}</span>}
            </li>;
          })}
        </ol>

        {step === 1 ? <form className="create-stage" onSubmit={reviewDetails}>
          <div className="section-head"><div><h3 className="section-title">Dados do aluno</h3><p className="section-lead">{chosenPlan ? "Informe o essencial para criar o acesso. O aluno entra direto na condição escolhida." : "Informe o essencial para criar o acesso. O aluno escolherá plano e pagamento na própria área."}</p></div></div>
          <div className="create-fields">
            <div className="form-field create-field-wide"><label htmlFor="new-student-name">Nome completo</label><input className="control" id="new-student-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required /></div>
            <div className="form-field create-field-wide"><label htmlFor="new-student-email">E-mail</label><input className="control" id="new-student-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></div>
            <div className="form-field"><label htmlFor="new-student-phone">Telefone</label><input className="control" id="new-student-phone" value={phone} onChange={(event) => setPhone(formatPhoneInput(event.target.value))} inputMode="tel" autoComplete="tel" maxLength={15} required /></div>
            <div className="form-field"><label htmlFor="new-student-cpf">CPF</label><input className="control" id="new-student-cpf" value={cpf} onChange={(event) => setCpf(formatCpfInput(event.target.value))} inputMode="numeric" maxLength={14} required /></div>
            <div className="form-field"><label htmlFor="new-student-birth-date">Data de nascimento <span className="optional-tag">opcional</span></label><input className="control" id="new-student-birth-date" type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} /></div>
            <div className="form-field"><label htmlFor="new-student-coupon">Cupom de Expert ou Creator <span className="optional-tag">opcional</span></label><input className="control coupon-input" id="new-student-coupon" value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase().replace(/\s+/g, ""))} maxLength={20} autoComplete="off" spellCheck={false} placeholder="Ex.: PACELAB10" /></div>
            <PlanChoice id="new-student-plan" plans={specialPlans} value={planId} onChange={setPlanId} />
          </div>
          <Feedback error={error} />
          <div className="btn-row btn-row-split create-actions">
            <Link className="btn btn-quiet" href="/admin/alunos">Cancelar</Link>
            <button className="btn btn-primary" type="submit">Continuar para revisão<Icon name="arrowRight" /></button>
          </div>
        </form> : null}

        {step === 2 ? <section className="create-stage" aria-labelledby="create-review-title">
          <div className="section-head"><div><h3 className="section-title" id="create-review-title">Confira os dados</h3><p className="section-lead">Revise antes de criar o acesso. Você ainda pode voltar e editar.</p></div></div>
          <dl className="kv-list create-review">
            <div><dt>Nome</dt><dd>{name}</dd></div>
            <div><dt>E-mail</dt><dd>{email}</dd></div>
            <div><dt>Telefone</dt><dd>{phone}</dd></div>
            <div><dt>CPF</dt><dd>{cpf}</dd></div>
            <div><dt>Nascimento</dt><dd>{birthDate ? birthDate.split("-").reverse().join("/") : "Não informado"}</dd></div>
            {couponCode ? <div><dt>Cupom</dt><dd>{couponCode}</dd></div> : null}
            {specialPlans.length ? <div><dt>Condição</dt><dd>{chosenPlan?.label ?? "Planos públicos (o aluno escolhe)"}</dd></div> : null}
          </dl>
          <Feedback error={error} />
          <div className="btn-row btn-row-split create-actions">
            <Link className="btn btn-quiet" href="/admin/alunos">Cancelar</Link>
            <div className="btn-row">
              <button className="btn btn-secondary" type="button" onClick={() => setStep(1)}><Icon name="arrowLeft" />Voltar</button>
              <button className="btn btn-primary" type="button" onClick={createStudent} disabled={loading} aria-busy={loading}>{loading ? "Criando acesso..." : "Criar acesso e gerar link"}</button>
            </div>
          </div>
        </section> : null}

        {step === 3 && result ? <section className="create-stage" aria-labelledby="create-done-title">
          <div className="section-head"><div><h3 className="section-title" id="create-done-title">Acesso criado.</h3><p className="section-lead">{result.firstAccessUrl ? "Mostre o QR Code para o aluno escanear agora ou envie a mensagem com a senha temporária. Nada disso será exibido novamente." : "Envie a mensagem abaixo. A senha não será exibida novamente."}</p></div></div>
          {result.firstAccessUrl ? <>
            <QrPanel value={result.firstAccessUrl} label={`QR Code de primeiro acesso de ${result.name}`} title="Escaneie com a câmera do celular">
              <p>{result.name.split(" ")[0]} cria a própria senha e {result.isCourtesy ? "já entra com a cortesia ativa" : "segue direto para o pagamento"}.</p>
              <p>Vale por 24 horas e só pode ser usado uma vez. Quando o aluno cria a senha, a senha temporária deixa de valer.</p>
            </QrPanel>
            <h4 className="create-subtitle">Ou envie por mensagem</h4>
          </> : null}
          <dl className="summary-strip create-credentials">
            <div><dt>Aluno</dt><dd>{result.name}</dd></div>
            <div><dt>E-mail</dt><dd>{result.email}</dd></div>
            <div><dt>Senha temporária</dt><dd className="create-password">{result.temporaryPassword}</dd></div>
          </dl>
          <div className="form-field create-url"><span className="form-label">{result.isCourtesy ? "Link de acesso (cortesia ativa)" : "Link de pagamento"}</span><code className="code-box">{result.paymentUrl}</code></div>
          <Feedback error={error} />
          <span className="visually-hidden" aria-live="polite">{copied === "link" ? "Link copiado." : copied === "message" ? "Mensagem copiada." : ""}</span>
          <div className="btn-row btn-row-split create-actions">
            <button className="btn btn-quiet" type="button" onClick={reset}>Cadastrar outro aluno</button>
            <div className="btn-row">
              <button className="btn btn-secondary" type="button" onClick={() => copyText("link", result.paymentUrl)}><Icon name={copied === "link" ? "check" : "copy"} />{copied === "link" ? "Link copiado" : "Copiar apenas o link"}</button>
              <button className="btn btn-primary" type="button" onClick={() => copyText("message", buildMessage(result))}><Icon name={copied === "message" ? "check" : "copy"} />{copied === "message" ? "Mensagem copiada" : "Copiar mensagem completa"}</button>
            </div>
          </div>
        </section> : null}
      </> : <section className="create-stage" aria-labelledby="create-link-title">
        <div className="section-head"><div><h3 className="section-title" id="create-link-title">Gere um link ou QR Code.</h3><p className="section-lead">{chosenPlan?.isCourtesy ? "O aluno informa seus dados e a cortesia é ativada na hora, sem pagamento." : chosenPlan ? "O aluno informa seus dados e paga a condição escolhida, sem ver outros planos." : "O aluno informa seus dados, escolhe o plano e vê os métodos de pagamento disponíveis antes de pagar."}</p></div></div>
        {!freeLink ? <PlanChoice id="link-plan" plans={specialPlans} value={planId} onChange={setPlanId} /> : null}
        <Feedback error={error} />
        <span className="visually-hidden" aria-live="polite">{copied === "link" ? "Link copiado." : ""}</span>
        {freeLink ? <div className="create-link-output">
          <QrPanel value={freeLink} label="QR Code do link de cadastro" title="Peça para a pessoa escanear">
            <p>{linkCourtesy ? "Ela preenche os próprios dados e a cortesia é ativada na hora." : linkPlanLabel ? "Ela preenche os próprios dados e paga a condição escolhida." : "Ela preenche os próprios dados, escolhe o plano e paga por conta própria."}</p>
            <p>Uso único: vale para a primeira pessoa que se cadastrar. Para outra pessoa, gere outro.</p>
          </QrPanel>
          <div className="form-field"><span className="form-label">{linkPlanLabel ? `Link pronto para enviar · ${linkPlanLabel}` : "Link pronto para enviar"}</span><code className="code-box">{freeLink}</code></div>
          <div className="btn-row btn-row-split create-actions">
            <button className="btn btn-quiet" type="button" onClick={() => setFreeLink(null)}>Gerar outro</button>
            <button className="btn btn-primary" type="button" onClick={() => copyText("link", freeLink)}><Icon name={copied === "link" ? "check" : "copy"} />{copied === "link" ? "Link copiado" : "Copiar link"}</button>
          </div>
        </div> : <div className="btn-row btn-row-split create-actions">
          <Link className="btn btn-quiet" href="/admin/alunos">Cancelar</Link>
          <button className="btn btn-primary" type="button" onClick={createFreeLink} disabled={loading} aria-busy={loading}><Icon name="link" />{loading ? "Gerando..." : "Gerar link e QR Code"}</button>
        </div>}
      </section>}
    </section>
  );
}
