"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Seller = { id: string; name: string };

export function SaleOwnerSelect({ studentId, value, sellers }: { studentId: string; value: string | null; sellers: Seller[] }) {
  const router = useRouter();
  const [current, setCurrent] = useState(value ?? "");
  const [pending, setPending] = useState(false);
  async function update(next: string) {
    setCurrent(next); setPending(true);
    try {
      const response = await fetch("/api/admin/sales", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId, saleOwnerId: next || null }) });
      if (!response.ok) setCurrent(value ?? "");
      else router.refresh();
    } catch { setCurrent(value ?? ""); } finally { setPending(false); }
  }
  return <select className="sale-owner-select" value={current} disabled={pending} onChange={(event) => void update(event.target.value)} aria-label="Responsável pela venda"><option value="">Não definido</option>{sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}</select>;
}
