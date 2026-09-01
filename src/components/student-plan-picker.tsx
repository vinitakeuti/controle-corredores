"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type StudentPlan = { id: string; period: "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL"; priceCents: number; allowedMethods: ("PIX" | "BOLETO" | "CARD")[]; automaticPixEnabled: boolean; service: { id?: string; name: string } };
const periodLabels = { MONTHLY: "Mensal", QUARTERLY: "Trimestral", SEMIANNUAL: "Semestral", ANNUAL: "Anual" };
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export function StudentPlanPicker({ plans, currentPlanIds = [], compact = false, confirmLabel, onPlansSelected }: { plans: StudentPlan[]; currentPlanIds?: string[]; compact?: boolean; confirmLabel?: string; onPlansSelected?: (plans: StudentPlan[]) => void }) {
  const router = useRouter();
  const [selectedByService, setSelectedByService] = useState<Record<string, string>>(() => Object.fromEntries(plans.filter((plan) => currentPlanIds.includes(plan.id)).map((plan) => [plan.service.id ?? plan.service.name, plan.id])));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const groups = plans.reduce<Map<string, StudentPlan[]>>((items, plan) => { items.set(plan.service.name, [...(items.get(plan.service.name) ?? []), plan]); return items; }, new Map());
  const selectedPlans = Object.values(selectedByService).map((id) => plans.find((plan) => plan.id === id)).filter((plan): plan is StudentPlan => Boolean(plan));

  async function save() {
    if (!selectedPlans.length) { setError("Selecione ao menos um produto para continuar."); return; }
    setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/student/plan", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planIds: selectedPlans.map((plan) => plan.id) }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Não foi possível escolher os planos."); return; }
      if (onPlansSelected) { onPlansSelected(selectedPlans); return; }
      setMessage("Produtos atualizados para as próximas cobranças.");
      router.refresh();
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }

  return <section className={`plan-picker ${compact ? "plan-picker-compact" : ""}`}><div className="panel-heading"><div><h2>{currentPlanIds.length ? "Adicionar ou trocar produtos" : "Escolha seus produtos"}</h2><p>Você pode selecionar um plano para cada serviço.</p></div></div><div className="student-plan-options">{[...groups.entries()].map(([service, options]) => <div className="student-plan-service" key={service}><h3>{service}</h3><div>{options.map((plan) => { const serviceKey = plan.service.id ?? plan.service.name; return <label className={selectedByService[serviceKey] === plan.id ? "selected" : ""} key={plan.id}><input type="radio" name={`student-plan-${serviceKey}`} value={plan.id} checked={selectedByService[serviceKey] === plan.id} onChange={() => setSelectedByService((current) => ({ ...current, [serviceKey]: plan.id }))} /><span><strong>{periodLabels[plan.period]}</strong><small>{money(plan.priceCents)} por mês</small></span></label>; })}</div></div>)}</div>{selectedPlans.length ? <p className="plan-picker-selection">{selectedPlans.length} {selectedPlans.length === 1 ? "produto selecionado" : "produtos selecionados"}</p> : null}{error ? <p className="error-message">{error}</p> : null}{message ? <p className="success-message">{message}</p> : null}<div className="creation-actions"><button className="button button-dark" type="button" onClick={save} disabled={pending}>{pending ? "Salvando..." : confirmLabel ?? "Confirmar produtos"}</button></div></section>;
}
