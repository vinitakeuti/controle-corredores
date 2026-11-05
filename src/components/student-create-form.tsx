"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Feedback } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { formatCpfInput, formatPhoneInput } from "@/lib/format";

type CreatedStudent = { name: string; email: string; temporaryPassword: string; paymentUrl: string };
type CreationMode = "student" | "link";

function buildMessage(result: CreatedStudent) {
  return `Olá, ${result.name}!\n\nSeu acesso à Pace Lab foi criado. Para concluir sua inscrição, acesse o link de pagamento:\n${result.paymentUrl}\n\nE-mail: ${result.email}\nSenha temporária: ${result.temporaryPassword}\n\nDepois da confirmação do pagamento, sua área de aluno ficará disponível.`;
}

const steps = ["Dados", "Revisar", "Concluído"] as const;

export function StudentCreateForm() {
  const [mode, setMode] = useState<CreationMode | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [result, setResult] = useState<CreatedStudent | null>(null);
  const [freeLink, setFreeLink] = useState<string | null>(null);
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function reset() {
    setStep(1);
    setName(""); setEmail(""); setPhone(""); setCpf(""); setBirthDate("");
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
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/students", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, phone, cpf, birthDate }) });
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
      const response = await fetch("/api/admin/payment-links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
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

  if (!mode) {
    return (
      <section className="section-block create-options" aria-labelledby="creation-options-title">
        <div className="section-head">
          <div><h2 className="section-title" id="creation-options-title">Como deseja começar?</h2><p className="section-lead">Escolha uma das duas formas de iniciar o cadastro.</p></div>
        </div>
        <ul className="choice-list">
          <li><button className="choice" type="button" onClick={() => changeMode("student")}>
            <Icon name="users" />
            <span className="choice-copy"><strong>Pré-cadastrar</strong><span>Informe os dados do aluno e receba as credenciais para enviar.</span></span>
            <Icon name="chevronRight" />
          </button></li>
          <li><button className="choice" type="button" onClick={() => changeMode("link")}>
            <Icon name="link" />
            <span className="choice-copy"><strong>Link de pagamento</strong><span>Gere um link para o aluno preencher os dados e pagar.</span></span>
            <Icon name="chevronRight" />
          </button></li>
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
          <div className="section-head"><div><h3 className="section-title">Dados do aluno</h3><p className="section-lead">Informe o essencial para criar o acesso. O aluno escolherá plano e pagamento na própria área.</p></div></div>
          <div className="create-fields">
            <div className="form-field create-field-wide"><label htmlFor="new-student-name">Nome completo</label><input className="control" id="new-student-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required /></div>
            <div className="form-field create-field-wide"><label htmlFor="new-student-email">E-mail</label><input className="control" id="new-student-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></div>
            <div className="form-field"><label htmlFor="new-student-phone">Telefone</label><input className="control" id="new-student-phone" value={phone} onChange={(event) => setPhone(formatPhoneInput(event.target.value))} inputMode="tel" autoComplete="tel" maxLength={15} required /></div>
            <div className="form-field"><label htmlFor="new-student-cpf">CPF</label><input className="control" id="new-student-cpf" value={cpf} onChange={(event) => setCpf(formatCpfInput(event.target.value))} inputMode="numeric" maxLength={14} required /></div>
            <div className="form-field"><label htmlFor="new-student-birth-date">Data de nascimento <span className="optional-tag">opcional</span></label><input className="control" id="new-student-birth-date" type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} /></div>
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
          <div className="section-head"><div><h3 className="section-title" id="create-done-title">Acesso criado.</h3><p className="section-lead">Envie a mensagem abaixo. A senha não será exibida novamente.</p></div></div>
          <dl className="summary-strip create-credentials">
            <div><dt>Aluno</dt><dd>{result.name}</dd></div>
            <div><dt>E-mail</dt><dd>{result.email}</dd></div>
            <div><dt>Senha temporária</dt><dd className="create-password">{result.temporaryPassword}</dd></div>
          </dl>
          <div className="form-field create-url"><span className="form-label">Link de pagamento</span><code className="code-box">{result.paymentUrl}</code></div>
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
        <div className="section-head"><div><h3 className="section-title" id="create-link-title">Gere um link para enviar.</h3><p className="section-lead">O aluno informa seus dados, escolhe o plano e vê os métodos de pagamento disponíveis antes de pagar.</p></div></div>
        <Feedback error={error} />
        <span className="visually-hidden" aria-live="polite">{copied === "link" ? "Link copiado." : ""}</span>
        {freeLink ? <div className="create-link-output">
          <div className="form-field"><span className="form-label">Link pronto para enviar</span><code className="code-box">{freeLink}</code></div>
          <div className="btn-row btn-row-split create-actions">
            <button className="btn btn-quiet" type="button" onClick={() => setFreeLink(null)}>Gerar outro</button>
            <button className="btn btn-primary" type="button" onClick={() => copyText("link", freeLink)}><Icon name={copied === "link" ? "check" : "copy"} />{copied === "link" ? "Link copiado" : "Copiar link"}</button>
          </div>
        </div> : <div className="btn-row btn-row-split create-actions">
          <Link className="btn btn-quiet" href="/admin/alunos">Cancelar</Link>
          <button className="btn btn-primary" type="button" onClick={createFreeLink} disabled={loading} aria-busy={loading}><Icon name="link" />{loading ? "Gerando..." : "Gerar link de pagamento"}</button>
        </div>}
      </section>}
    </section>
  );
}
