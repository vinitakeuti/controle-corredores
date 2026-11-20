"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Feedback } from "@/components/ui/feedback";

type Option = { id: string; label: string };

// Quem indicou este aluno (cupom de Expert/Creator). A venda do 1º pagamento acompanha a indicação.
export function StudentReferralControl({ studentId, current, options }: { studentId: string; current: string | null; options: Option[] }) {
  const router = useRouter();
  const [value, setValue] = useState(current ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function save() {
    setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/students/${encodeURIComponent(studentId)}/referral`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ influencerId: value || null }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível salvar a indicação.");
      setMessage(value ? "Indicação salva. Se o aluno já pagou, a venda foi atribuída." : "Indicação removida.");
      router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }
  return <div className="referral-control">
    <div className="form-field">
      <label htmlFor="student-referral">Indicado por</label>
      <select className="control" id="student-referral" value={value} onChange={(event) => setValue(event.target.value)}>
        <option value="">Sem indicação</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    </div>
    <button className="btn btn-secondary" type="button" onClick={save} disabled={pending || value === (current ?? "")} aria-busy={pending}>{pending ? "Salvando..." : "Salvar indicação"}</button>
    <Feedback success={message} error={error} />
  </div>;
}
