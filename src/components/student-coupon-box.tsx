"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Feedback } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";

// Cupom de Expert/Creator na área do aluno: só antes do primeiro pagamento.
export function StudentCouponBox({ appliedCode, discountPercent }: { appliedCode: string | null; discountPercent: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  if (appliedCode) {
    return <p className="message student-note coupon-applied" data-tone="positive" role="status"><Icon name="ticket" /><span>Cupom <strong>{appliedCode}</strong> aplicado.{discountPercent ? ` Você tem ${discountPercent}% de desconto no primeiro pagamento.` : ""}</span></p>;
  }

  async function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setError("");
    try {
      const response = await fetch("/api/student/coupon", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Não foi possível aplicar o cupom."); return; }
      router.refresh();
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }

  if (!open) return <button className="btn btn-quiet coupon-toggle" type="button" onClick={() => setOpen(true)}><Icon name="ticket" />Tem um cupom?</button>;
  return <form className="coupon-form" onSubmit={apply}>
    <div className="form-field"><label htmlFor="student-coupon">Cupom</label><input className="control coupon-input" id="student-coupon" value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/\s+/g, ""))} maxLength={20} autoComplete="off" spellCheck={false} placeholder="Ex.: PACELAB10" data-autofocus required /></div>
    <button className="btn btn-secondary" type="submit" disabled={pending || code.length < 3} aria-busy={pending}>{pending ? "Aplicando..." : "Aplicar cupom"}</button>
    <Feedback error={error} />
  </form>;
}
