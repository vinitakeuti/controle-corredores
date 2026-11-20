"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Feedback } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";

export function CopyCouponButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return <button className="btn coupon-copy" type="button" onClick={async () => { try { await navigator.clipboard.writeText(code); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch { /* cópia bloqueada */ } }}>
    <Icon name={copied ? "check" : "copy"} />{copied ? "Copiado" : "Copiar"}
    <span className="visually-hidden" aria-live="polite">{copied ? `Cupom ${code} copiado.` : ""}</span>
  </button>;
}

export function CopyLinkButton({ url, name }: { url: string; name: string }) {
  const [copied, setCopied] = useState(false);
  return <button className="btn coupon-link-copy" type="button" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch { /* cópia bloqueada */ } }} aria-label={`Copiar link ${name}`}>
    <Icon name={copied ? "check" : "copy"} />{copied ? "Copiado" : "Copiar"}
    <span className="visually-hidden" aria-live="polite">{copied ? `Link ${name} copiado.` : ""}</span>
  </button>;
}

const pixTypes = [{ value: "CPF", label: "CPF" }, { value: "CNPJ", label: "CNPJ" }, { value: "EMAIL", label: "E-mail" }, { value: "PHONE", label: "Telefone" }, { value: "RANDOM", label: "Chave aleatória" }] as const;

export function PixKeyForm({ hasKey }: { hasKey: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(!hasKey);
  const [type, setType] = useState<(typeof pixTypes)[number]["value"]>("CPF");
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setError("");
    try {
      const response = await fetch("/api/program/pix-key", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, key }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível salvar a chave.");
      setKey(""); setOpen(false); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }
  if (!open) return <button className="btn btn-secondary" type="button" onClick={() => setOpen(true)}>Trocar chave</button>;
  return <form className="pix-form" onSubmit={submit}>
    <div className="form-field"><label htmlFor="pix-type">Tipo de chave</label><select className="control" id="pix-type" value={type} onChange={(event) => setType(event.target.value as typeof type)}>{pixTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
    <div className="form-field"><label htmlFor="pix-key">Chave Pix</label><input className="control" id="pix-key" value={key} onChange={(event) => setKey(event.target.value)} autoComplete="off" required /></div>
    <div className="btn-row">
      {hasKey ? <button className="btn btn-quiet" type="button" onClick={() => setOpen(false)} disabled={pending}>Cancelar</button> : null}
      <button className="btn btn-primary" type="submit" disabled={pending} aria-busy={pending}>{pending ? "Salvando..." : "Salvar chave"}</button>
    </div>
    <Feedback error={error} />
  </form>;
}
