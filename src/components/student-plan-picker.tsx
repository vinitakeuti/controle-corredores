"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Plan = { id: string; period: "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL"; priceCents: number; service: { name: string } };
const periodLabels = { MONTHLY: "Mensal", QUARTERLY: "Trimestral", SEMIANNUAL: "Semestral", ANNUAL: "Anual" };
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export function StudentPlanPicker({ plans, currentPlanId, compact = false }: { plans: Plan[]; currentPlanId: string | null; compact?: boolean }) {
  const router = useRouter();
  const [selectedPlanId, setSelectedPlanId] = useState(currentPlanId ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const groups = plans.reduce<Map<string, Plan[]>>((items, plan) => { items.set(plan.service.name, [...(items.get(plan.service.name) ?? []), plan]); return items; }, new Map());

  async function save() {
    if (!selectedPlanId) { setError("Selecione um plano para continuar."); return; }
    setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/student/plan", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId: selectedPlanId }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Não foi possível escolher o plano."); return; }
      setMessage(data.reauthorizationRequired ? "Plano atualizado. Para Pix Automático, autorize novamente no próximo pagamento." : "Plano atualizado para a próxima cobrança.");
      router.refresh();
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }

  return <section className={`plan-picker ${compact ? "plan-picker-compact" : ""}`}><div className="panel-heading"><div><h2>{currentPlanId ? "Trocar plano" : "Escolha seu plano"}</h2><p>Selecione o serviço e a duração que fazem sentido para sua rotina.</p></div></div><div className="student-plan-options">{[...groups.entries()].map(([service, options]) => <div className="student-plan-service" key={service}><h3>{service}</h3><div>{options.map((plan) => <label className={selectedPlanId === plan.id ? "selected" : ""} key={plan.id}><input type="radio" name="student-plan" value={plan.id} checked={selectedPlanId === plan.id} onChange={() => setSelectedPlanId(plan.id)} /><span><strong>{periodLabels[plan.period]}</strong><small>{money(plan.priceCents)} por mês</small></span></label>)}</div></div>)}</div>{error ? <p className="error-message">{error}</p> : null}{message ? <p className="success-message">{message}</p> : null}<div className="creation-actions"><button className="button button-dark" type="button" onClick={save} disabled={pending || selectedPlanId === currentPlanId}>{pending ? "Salvando..." : currentPlanId ? "Atualizar plano" : "Confirmar plano"}</button></div></section>;
}
