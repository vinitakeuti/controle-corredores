"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SubscriptionDateControl({ studentId, subscriptionId, initialDate }: { studentId: string; subscriptionId: string; initialDate: Date | null }) {
  const router = useRouter();
  const [value, setValue] = useState(initialDate ? initialDate.toISOString().slice(0, 10) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    if (!value) { setError("Escolha uma data."); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/admin/students/${studentId}/subscriptions/${subscriptionId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nextBillingAt: value }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Não foi possível atualizar a data."); return; }
      router.refresh();
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setSaving(false); }
  }
  return <div className="subscription-date-control"><input aria-label="Próxima cobrança" type="date" value={value} onChange={(event) => setValue(event.target.value)} /><button className="button button-secondary" type="button" onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar data"}</button>{error ? <small className="error-message">{error}</small> : null}</div>;
}
