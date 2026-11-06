"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Feedback } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";

export function AiAssistantSettings({ initial }: { initial: { generalInstructions: string; businessInfo: string; monthlyBudgetUsd: number | null } }) {
  const router = useRouter();
  const [generalInstructions, setGeneralInstructions] = useState(initial.generalInstructions);
  const [businessInfo, setBusinessInfo] = useState(initial.businessInfo);
  const [budget, setBudget] = useState(initial.monthlyBudgetUsd != null ? String(initial.monthlyBudgetUsd).replace(".", ",") : "");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setSuccess(""); setError("");
    const normalizedBudget = budget.trim().replace(/\./g, "").replace(",", ".");
    try {
      const response = await fetch("/api/admin/ai/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ generalInstructions, businessInfo, monthlyBudgetUsd: normalizedBudget ? Number(normalizedBudget) : null }) });
      const data = await response.json();
      if (response.ok) { setSuccess("Instruções do assistente salvas."); router.refresh(); } else setError(data.error ?? "Não foi possível salvar.");
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setSaving(false); }
  }

  return (
    <section className="section-block" aria-labelledby="ai-settings-title">
      <div className="section-head">
        <div>
          <h2 className="section-title" id="ai-settings-title">Instruções do assistente</h2>
          <p className="section-lead">Complementam a instrução geral, que já define o tom, as regras de segurança e a confirmação das ações. As permissões de cada pessoa não dependem deste texto: são conferidas pelo sistema.</p>
        </div>
      </div>
      <form className="ai-settings-form" onSubmit={onSubmit}>
        <div className="form-field">
          <label htmlFor="ai-business">Sobre a assessoria</label>
          <textarea className="control ai-textarea" id="ai-business" rows={7} maxLength={12000} value={businessInfo} onChange={(event) => setBusinessInfo(event.target.value)} placeholder="Ex.: local e horários dos treinos em grupo, como funciona a planilha, eventos, Lab Educa, política de cancelamento..." />
          <p className="field-hint">O assistente usa isto para responder dúvidas sobre a Pace Lab. Escreva só o que é verdade hoje.</p>
        </div>
        <div className="form-field">
          <label htmlFor="ai-general">Instruções da equipe</label>
          <textarea className="control ai-textarea" id="ai-general" rows={5} maxLength={8000} value={generalInstructions} onChange={(event) => setGeneralInstructions(event.target.value)} placeholder="Ex.: chame os alunos pelo primeiro nome; ao listar inadimplentes, ordene pelo vencimento mais antigo..." />
        </div>
        <div className="form-field ai-budget">
          <label htmlFor="ai-budget">Limite de gasto mensal (US$)</label>
          <input className="control" id="ai-budget" inputMode="decimal" value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="Sem limite" />
          <p className="field-hint">Ao atingir o limite, o assistente para de responder até o mês seguinte. Deixe vazio para não limitar.</p>
        </div>
        <div className="ai-settings-actions">
          <button className="btn btn-primary" type="submit" disabled={saving} aria-busy={saving}><Icon name="check" />{saving ? "Salvando..." : "Salvar instruções"}</button>
        </div>
        <Feedback success={success} error={error} />
      </form>
    </section>
  );
}
