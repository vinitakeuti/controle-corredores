"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Feedback } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { StatusPill } from "@/components/ui/status-pill";

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

  if (isCheckoutFlow) return <section className="plan-choose">
    <fieldset className="choice-set">
      <legend><span className="section-title">Escolha o serviço</span><span className="section-lead">Qual plano você deseja contratar?</span></legend>
      <div className="choice-cards">
        {groupEntries.map(([service]) => <label className="choice-card" key={service}>
          <input type="radio" name="student-service" value={service} checked={selectedService === service} onChange={() => selectService(service)} />
          <span className="choice-card-copy"><strong>{service}</strong><small>{serviceDescription(service)}</small></span>
        </label>)}
      </div>
    </fieldset>
    <fieldset className="choice-set">
      <legend><span className="section-title">Escolha a duração</span><span className="section-lead">Defina por quanto tempo você quer seu plano.</span></legend>
      <div className="choice-cards choice-cards-grid">
        {selectedServicePlans.map((plan) => <label className="choice-card" key={plan.id}>
          <input type="radio" name="student-plan" value={plan.id} checked={selectedPlanId === plan.id} onChange={() => setSelectedPlanId(plan.id)} />
          <span className="choice-card-copy">
            <strong>{periodLabels[plan.period]}{plan.isFeatured ? <StatusPill tone="info">Mais escolhido</StatusPill> : null}</strong>
            <span className="choice-card-price">{money(plan.priceCents)}<small> por mês</small></span>
            <small>{periodMonths[plan.period] === 1 ? "Pagamento único" : `${periodMonths[plan.period]}x no cartão`}</small>
          </span>
        </label>)}
      </div>
    </fieldset>
    <Feedback error={error} />
    <div className="plan-choose-actions"><button className="btn btn-primary" type="button" onClick={save} disabled={pending} aria-busy={pending}>{pending ? "Salvando..." : "Continuar para o pagamento"}<Icon name="arrowRight" /></button><p className="field-hint">Pagamento seguro e dados protegidos</p></div>
  </section>;

  return <section className="plan-switch">
    {compact ? null : <div className="section-head"><div><h2 className="section-title">{currentPlanId ? "Trocar plano" : "Escolha seu plano"}</h2><p className="section-lead">Selecione o serviço e a duração que fazem sentido para sua rotina.</p></div></div>}
    {groupEntries.map(([service, options]) => <fieldset className="choice-set" key={service}>
      <legend><span className="form-label">{service}</span></legend>
      <div className="choice-cards choice-cards-grid">{options.map((plan) => <label className="choice-card" key={plan.id}><input type="radio" name="student-plan" value={plan.id} checked={selectedPlanId === plan.id} onChange={() => setSelectedPlanId(plan.id)} /><span className="choice-card-copy"><strong>{periodLabels[plan.period]}</strong><small>{paymentSummary(plan)}</small></span></label>)}</div>
    </fieldset>)}
    <Feedback success={message} error={error} />
    <div className="btn-row"><button className="btn btn-secondary" type="button" onClick={save} disabled={pending} aria-busy={pending}>{pending ? "Salvando..." : confirmLabel ?? (currentPlanId ? "Atualizar plano" : "Confirmar plano")}</button></div>
  </section>;
}
