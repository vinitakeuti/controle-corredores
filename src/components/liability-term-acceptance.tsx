"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { liabilityTermDeclarations, liabilityTermSections } from "@/lib/liability-term";

type Props = {
  name: string;
  cpf: string | null;
  birthDate: string | null;
  phone: string | null;
  email: string;
  joinedAt: string;
  planName: string;
};

function valueOrFallback(value: string | null) {
  return value || "Não informado";
}

export function LiabilityTermAcceptance({ name, cpf, birthDate, phone, email, joinedAt, planName }: Props) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [signature, setSignature] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);

  async function accept() {
    if (!confirmed || !signature.trim()) {
      setError("Confirme a leitura e escreva seu nome completo para assinar.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/student/liability-term", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: confirmed, signature }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Não foi possível registrar sua assinatura.");
        return;
      }
      setAccepted(true);
      router.refresh();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setPending(false);
    }
  }

  return <section className="liability-term-panel">
    <header className="liability-term-heading"><p className="eyebrow">Termo obrigatório</p><h1>Seu termo de responsabilidade.</h1><p>Seu pagamento foi confirmado. Leia o documento e assine uma única vez para iniciar sua jornada na Pace Lab.</p></header>
    <article className="liability-term-document">
      <h2>Termo de responsabilidade, ciência e compromisso para prática de corrida</h2>
      <dl className="liability-term-data"><div><dt>Assessoria esportiva</dt><dd>Pace Lab</dd></div><div><dt>Aluno(a)/atleta</dt><dd>{name}</dd></div><div><dt>CPF</dt><dd>{valueOrFallback(cpf)}</dd></div><div><dt>Data de nascimento</dt><dd>{valueOrFallback(birthDate)}</dd></div><div><dt>Telefone</dt><dd>{valueOrFallback(phone)}</dd></div><div><dt>E-mail</dt><dd>{email}</dd></div><div><dt>Data de início</dt><dd>{joinedAt}</dd></div><div><dt>Tipo de plano</dt><dd>{planName}</dd></div></dl>
      {liabilityTermSections.map((section) => <section key={section.title}><h3>{section.title}</h3>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.items ? <ol>{section.items.map((item) => <li key={item}>{item}</li>)}</ol> : null}</section>)}
      <section><h3>10. Declaração de ciência e compromisso</h3><p>Declaro que:</p><ol>{liabilityTermDeclarations.map((item) => <li key={item}>{item}</li>)}</ol><p>Assim sendo, declaro que li, compreendi e concordo com as condições estabelecidas neste Termo.</p></section>
    </article>
    <div className="liability-term-signature">{accepted ? <p className="success-message">Assinatura registrada. Abrindo sua área…</p> : <><label className="term-confirmation"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />Li, compreendi e concordo com este Termo de Responsabilidade.</label><div className="field"><label htmlFor="liability-term-signature">Assine digitando seu nome completo</label><input id="liability-term-signature" value={signature} onChange={(event) => setSignature(event.target.value)} placeholder={name} autoComplete="name" /></div>{error ? <p className="error-message">{error}</p> : null}<button className="button button-dark" type="button" onClick={accept} disabled={pending}>{pending ? "Registrando assinatura..." : "Assinar e acessar minha área"}</button></>}</div>
  </section>;
}
