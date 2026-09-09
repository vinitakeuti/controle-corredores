"use client";

import { useState } from "react";

type TermStatus = "PENDING" | "SUBMITTED" | "REJECTED";

export function LiabilityTermAcceptance({ status, reviewNote }: { status: TermStatus; reviewNote: string | null }) {
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(status === "SUBMITTED");
  const [error, setError] = useState("");

  async function upload() {
    if (!file) {
      setError("Selecione o PDF que foi assinado no GOV.BR.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const formData = new FormData();
      formData.set("signedTerm", file);
      const response = await fetch("/api/student/liability-term", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Não foi possível enviar o termo.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setPending(false);
    }
  }

  if (submitted) return <section className="liability-term-panel"><header className="liability-term-heading"><p className="eyebrow">Termo enviado</p><h1>Aguardando validação.</h1><p>Recebemos seu PDF assinado. A equipe Pace Lab fará a validação do documento antes de liberar sua área.</p></header><section className="panel term-waiting-panel"><strong>Documento em análise</strong><p>Você não precisa realizar nenhuma outra ação agora.</p></section></section>;

  return <section className="liability-term-panel">
    <header className="liability-term-heading"><p className="eyebrow">Termo obrigatório</p><h1>Assine seu termo digitalmente.</h1><p>Baixe o documento, assine gratuitamente com sua conta GOV.BR e envie o PDF assinado para validação da Pace Lab.</p></header>
    {status === "REJECTED" ? <div className="notice term-rejected-notice"><strong>Precisamos de um novo envio</strong><p>{reviewNote || "O documento não pôde ser validado. Confira a assinatura e envie novamente."}</p></div> : null}
    <ol className="term-signing-steps">
      <li><span>1</span><div><strong>Baixe o termo</strong><small>O PDF já vem preenchido com seus dados. Confira as informações e guarde uma cópia.</small><a className="button button-quiet" href="/api/student/liability-term/download">Baixar termo em PDF</a></div></li>
      <li><span>2</span><div><strong>Assine no GOV.BR</strong><small>Use sua conta GOV.BR nível prata ou ouro para assinar o PDF.</small><a className="button button-dark" href="https://assinador.iti.br" target="_blank" rel="noreferrer">Abrir Assinador GOV.BR</a></div></li>
      <li><span>3</span><div><strong>Envie o PDF assinado</strong><small>Envie o arquivo baixado após a assinatura. Aceitamos PDF de até 10 MB.</small><input className="term-file-input" type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />{file ? <em>{file.name}</em> : null}</div></li>
    </ol>
    {error ? <p className="error-message">{error}</p> : null}
    <button className="button button-dark" type="button" onClick={upload} disabled={pending || !file}>{pending ? "Enviando documento..." : "Enviar para validação"}</button>
  </section>;
}
