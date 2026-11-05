"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Seller = { id: string; name: string };

export function SaleOwnerSelect({ studentId, value, sellers, label = "Responsável pela venda" }: { studentId: string; value: string | null; sellers: Seller[]; label?: string }) {
  const router = useRouter();
  const [current, setCurrent] = useState(value ?? "");
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  async function update(next: string) {
    setCurrent(next); setPending(true); setFailed(false);
    try {
      const response = await fetch("/api/admin/sales", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId, saleOwnerId: next || null }) });
      if (!response.ok) { setCurrent(value ?? ""); setFailed(true); }
      else router.refresh();
    } catch { setCurrent(value ?? ""); setFailed(true); } finally { setPending(false); }
  }
  return <span className="owner-select">
    <select className="control owner-select-control" value={current} disabled={pending} aria-busy={pending} aria-invalid={failed || undefined} onChange={(event) => void update(event.target.value)} aria-label={label}><option value="">Não definido</option>{sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}</select>
    <span className="visually-hidden" aria-live="polite">{failed ? "Não foi possível alterar o vendedor." : ""}</span>
  </span>;
}
