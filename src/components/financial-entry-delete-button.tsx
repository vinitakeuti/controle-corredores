"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function FinancialEntryDeleteButton({ entryId, title, isFixed }: { entryId: string; title: string; isFixed: boolean }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    const fixedWarning = isFixed ? " Este lançamento é recorrente e deixará de aparecer nos próximos meses." : "";
    if (!window.confirm(`Excluir o lançamento “${title}”?${fixedWarning}`)) return;

    setDeleting(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/financial-entries?id=${encodeURIComponent(entryId)}`, { method: "DELETE" });
      const payload = await response.json().catch(() => null) as { error?: unknown } | null;
      if (!response.ok) {
        setError(typeof payload?.error === "string" ? payload.error : "Não foi possível excluir o lançamento.");
        return;
      }
      router.refresh();
    } catch {
      setError("Não foi possível excluir o lançamento. Tente novamente.");
    } finally {
      setDeleting(false);
    }
  }

  return <span className="financial-entry-delete-control">
    <button type="button" onClick={remove} disabled={deleting}>{deleting ? "Excluindo..." : "Excluir"}</button>
    {error ? <small role="alert">{error}</small> : null}
  </span>;
}
