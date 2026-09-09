"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Plan = { id: string; period: "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL"; priceCents: number; allowedMethods: ("PIX" | "BOLETO" | "CARD")[]; automaticPixEnabled: boolean; isFeatured: boolean; service: { name: string } };
const periodLabels = { MONTHLY: "Mensal", QUARTERLY: "Trimestral", SEMIANNUAL: "Semestral", ANNUAL: "Anual" };
const periodMonths = { MONTHLY: 1, QUARTERLY: 3, SEMIANNUAL: 6, ANNUAL: 12 };
const periodOrder = { MONTHLY: 0, QUARTERLY: 1, SEMIANNUAL: 2, ANNUAL: 3 };
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const paymentSummary = (plan: Plan) => `${money(plan.priceCents)} por mês · ${periodMonths[plan.period]}x no cartão`;

function serviceDescription(name: string) {
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (normalized.includes("corrida") && (normalized.includes("fortalecimento") || normalized.includes("forca"))) return "O plano completo para uma rotina mais consistente.";
  if (normalized.includes("corrida")) return "Planos de treino para sua evolução na corrida.";
  if (normalized.includes("fortalecimento") || normalized.includes("forca")) return "Treinos de força e mobilidade para sua performance.";
  return "Escolha a duração que melhor se encaixa na sua rotina.";
}

function sortPlans(plans: Plan[]) {
  return [...plans].sort((a, b) => periodOrder[a.period] - periodOrder[b.period]);
}

export function StudentPlanPicker({ plans, currentPlanId, compact = false, confirmLabel, onPlanSelected }: { plans: Plan[]; currentPlanId: string | null; compact?: boolean; confirmLabel?: string; onPlanSelected?: (plan: Plan) => void }) {
  const router = useRouter();
  const groups = plans.reduce<Map<string, Plan[]>>((items, plan) => { items.set(plan.service.name, [...(items.get(plan.service.name) ?? []), plan]); return items; }, new Map());
  const groupEntries = [...groups.entries()];
  const currentPlan = plans.find((plan) => plan.id === currentPlanId) ?? null;
  const initialService = currentPlan?.service.name ?? groupEntries[0]?.[0] ?? "";
  const initialPlanId = currentPlanId ?? sortPlans(groups.get(initialService) ?? [])[0]?.id ?? "";
  const [selectedPlanId, setSelectedPlanId] = useState(initialPlanId);
  const [selectedService, setSelectedService] = useState(initialService);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const isCheckoutFlow = Boolean(onPlanSelected) && !compact;
  const selectedServicePlans = sortPlans(groups.get(selectedService) ?? []);

  function selectService(service: string) {
    setSelectedService(service);
    const firstPlan = sortPlans(groups.get(service) ?? [])[0];
    if (firstPlan) setSelectedPlanId(firstPlan.id);
  }

  async function save() {
    if (!selectedPlanId) { setError("Selecione um plano para continuar."); return; }
    const selected = plans.find((plan) => plan.id === selectedPlanId);
    if (!selected) return;
    if (selectedPlanId === currentPlanId && onPlanSelected) { onPlanSelected(selected); return; }
    setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/student/plan", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId: selectedPlanId }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Não foi possível escolher o plano."); return; }
      if (onPlanSelected) { onPlanSelected(selected); return; }
      setMessage(data.reauthorizationRequired ? "Plano atualizado. Para Pix Automático, autorize novamente no próximo pagamento." : "Plano atualizado para a próxima cobrança.");
      router.refresh();
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }

  if (isCheckoutFlow) return <section className="plan-picker plan-picker-checkout">
    <section className="plan-service-selection" aria-labelledby="service-choice-title">
      <div className="plan-choice-heading"><h2 id="service-choice-title">Escolha o serviço</h2><p>Qual plano você deseja contratar?</p></div>
      <div className="plan-service-options" role="radiogroup" aria-label="Serviço">
        {groupEntries.map(([service]) => <label className={selectedService === service ? "selected" : ""} key={service}>
          <input type="radio" name="student-service" value={service} checked={selectedService === service} onChange={() => selectService(service)} />
          <span><strong>{service}</strong><small>{serviceDescription(service)}</small></span>
          <i aria-hidden="true" />
        </label>)}
      </div>
    </section>
    <section className="plan-duration-selection" aria-labelledby="duration-choice-title">
      <div className="plan-choice-heading"><h2 id="duration-choice-title">Escolha a duração</h2><p>Defina por quanto tempo você quer seu plano.</p></div>
      <div className="plan-duration-options" role="radiogroup" aria-label="Duração do plano">
        {selectedServicePlans.map((plan) => <label className={selectedPlanId === plan.id ? "selected" : ""} key={plan.id}>
          <input type="radio" name="student-plan" value={plan.id} checked={selectedPlanId === plan.id} onChange={() => setSelectedPlanId(plan.id)} />
          <strong>{periodLabels[plan.period]}</strong>
          <b>{money(plan.priceCents)}</b>
          <small>por mês</small>
          <em>{periodMonths[plan.period] === 1 ? "Pagamento único" : `${periodMonths[plan.period]}x no cartão`}</em>
          {plan.isFeatured ? <span className="plan-featured-badge">Mais escolhido</span> : null}
          <i aria-hidden="true" />
        </label>)}
      </div>
    </section>
    {error ? <p className="error-message">{error}</p> : null}
    <div className="plan-picker-checkout-actions"><button className="button plan-picker-continue" type="button" onClick={save} disabled={pending}>{pending ? "Salvando..." : "Continuar para o pagamento"} <span aria-hidden="true">→</span></button><p>Pagamento seguro e dados protegidos</p></div>
  </section>;

  return <section className={`plan-picker ${compact ? "plan-picker-compact" : ""}`}><div className="panel-heading"><div><h2>{currentPlanId ? "Trocar plano" : "Escolha seu plano"}</h2><p>Selecione o serviço e a duração que fazem sentido para sua rotina.</p></div></div><div className="student-plan-options">{groupEntries.map(([service, options]) => <div className="student-plan-service" key={service}><h3>{service}</h3><div>{options.map((plan) => <label className={selectedPlanId === plan.id ? "selected" : ""} key={plan.id}><input type="radio" name="student-plan" value={plan.id} checked={selectedPlanId === plan.id} onChange={() => setSelectedPlanId(plan.id)} /><span><strong>{periodLabels[plan.period]}</strong><small>{paymentSummary(plan)}</small></span></label>)}</div></div>)}</div>{error ? <p className="error-message">{error}</p> : null}{message ? <p className="success-message">{message}</p> : null}<div className="creation-actions"><button className="button button-dark" type="button" onClick={save} disabled={pending}>{pending ? "Salvando..." : confirmLabel ?? (currentPlanId ? "Atualizar plano" : "Confirmar plano")}</button></div></section>;
}
