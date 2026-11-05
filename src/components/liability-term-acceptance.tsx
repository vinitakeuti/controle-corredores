"use client";

import { useId, useState } from "react";
import { Feedback } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";

type TermStatus = "PENDING" | "SUBMITTED" | "REJECTED";

export function LiabilityTermAcceptance({ status, reviewNote, downloadError }: { status: TermStatus; reviewNote: string | null; downloadError?: boolean }) {
  const fileInputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(status === "SUBMITTED");
  const [error, setError] = useState(downloadError ? "Não foi possível gerar o termo agora. Tente novamente em alguns instantes." : "");

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

  if (submitted) return <section className="term-flow">
    <PageHeader context={{ label: "Termo enviado" }} title="Aguardando validação." lead="Recebemos seu PDF assinado. A equipe Pace Lab fará a validação do documento antes de liberar sua área." />
    <div className="message" data-tone="info" role="status"><Icon name="info" /><div><strong>Documento em análise</strong><p>Você não precisa realizar nenhuma outra ação agora.</p></div></div>
  </section>;

  return <section className="term-flow">
    <PageHeader context={{ label: "Termo obrigatório" }} title="Assine seu termo digitalmente." lead="Baixe o documento, assine gratuitamente com sua conta GOV.BR e envie o PDF assinado para validação da Pace Lab." />
    {status === "REJECTED" ? <div className="message" data-tone="danger"><Icon name="alert" /><div><strong>Precisamos de um novo envio</strong><p>{reviewNote || "O documento não pôde ser validado. Confira a assinatura e envie novamente."}</p></div></div> : null}
    <ol className="term-steps">
      <li><span className="term-step-number" aria-hidden="true">1</span><div className="term-step-copy"><strong>Baixe o termo</strong><small>O PDF já vem preenchido com seus dados. Confira as informações e guarde uma cópia.</small><a className="btn btn-secondary" href="/api/student/liability-term/download" download><Icon name="file" />Baixar termo preenchido</a></div></li>
      <li><span className="term-step-number" aria-hidden="true">2</span><div className="term-step-copy"><strong>Assine no GOV.BR</strong><small>Use sua conta GOV.BR nível prata ou ouro para assinar o PDF.</small><a className="btn btn-secondary" href="https://assinador.iti.br" target="_blank" rel="noreferrer">Abrir Assinador GOV.BR<Icon name="external" className="icon-sm" /><span className="visually-hidden"> (abre em nova aba)</span></a></div></li>
      <li><span className="term-step-number" aria-hidden="true">3</span><div className="term-step-copy"><strong>Envie o PDF assinado</strong><small>Envie o arquivo baixado após a assinatura. Aceitamos PDF de até 10 MB.</small><input id={fileInputId} className="visually-hidden term-file-field" type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><label className="btn btn-secondary term-upload" htmlFor={fileInputId}><Icon name="plus" />{file ? "Trocar PDF assinado" : "Selecionar PDF assinado"}</label>{file ? <span className="term-file-chosen"><Icon name="check" className="icon-sm" />{file.name}</span> : <span className="field-hint">Nenhum PDF selecionado ainda.</span>}</div></li>
    </ol>
    <Feedback error={error} />
    <button className="btn btn-primary term-submit" type="button" onClick={upload} disabled={pending || !file} aria-busy={pending}>{pending ? "Enviando documento..." : "Enviar documento para validação"}</button>
  </section>;
}
