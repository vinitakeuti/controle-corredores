"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Period = "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL";
type Service = { id: string; name: string };
type Plan = { id: string; period: Period; priceCents: number; active: boolean; service: Service };
const periods: { value: Period; label: string }[] = [{ value: "MONTHLY", label: "Mensal" }, { value: "QUARTERLY", label: "Trimestral" }, { value: "SEMIANNUAL", label: "Semestral" }, { value: "ANNUAL", label: "Anual" }];
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export function PlansManager({ initialPlans }: { initialPlans: Plan[] }) {
  const router = useRouter();
  const [serviceMode, setServiceMode] = useState<"existing" | "new">(initialPlans.length ? "existing" : "new");
  const [serviceId, setServiceId] = useState(initialPlans[0]?.service.id ?? "");
  const [serviceName, setServiceName] = useState("");
  const [period, setPeriod] = useState<Period>("MONTHLY");
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const services = [...new Map(initialPlans.map((plan) => [plan.service.id, plan.service])).values()];
  const grouped = initialPlans.reduce<Map<string, Plan[]>>((items, plan) => {
    items.set(plan.service.name, [...(items.get(plan.service.name) ?? []), plan]);
    return items;
  }, new Map());

  async function createPlan() {
    const priceCents = Math.round(Number(price.replace(",", ".")) * 100);
    if ((!serviceId && !serviceName.trim()) || !Number.isInteger(priceCents) || priceCents < 100) { setError("Informe um serviço e um valor válido."); return; }
    setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serviceId: serviceMode === "existing" ? serviceId : undefined, serviceName: serviceMode === "new" ? serviceName : undefined, period, priceCents }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Não foi possível criar o plano."); return; }
      setPrice(""); setServiceName(""); setMessage("Plano criado e disponível para novas assinaturas."); router.refresh();
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }

  async function togglePlan(plan: Plan) {
    setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/plans/${encodeURIComponent(plan.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !plan.active }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Não foi possível atualizar o plano."); return; }
      setMessage(plan.active ? "Plano removido das novas escolhas." : "Plano reativado."); router.refresh();
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }

  return <div className="plans-layout"><section className="panel plans-form"><div className="panel-heading"><div><h2>Novo plano</h2><p>Crie primeiro o serviço e depois seus períodos de assinatura.</p></div></div><div className="plan-service-switch"><button type="button" className={serviceMode === "existing" ? "active" : ""} onClick={() => setServiceMode("existing")} disabled={!services.length}>Usar serviço existente</button><button type="button" className={serviceMode === "new" ? "active" : ""} onClick={() => setServiceMode("new")}>Criar serviço</button></div>{serviceMode === "existing" ? <div className="field"><label htmlFor="plan-service">Serviço</label><select id="plan-service" value={serviceId} onChange={(event) => setServiceId(event.target.value)}>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></div> : <div className="field"><label htmlFor="plan-service-name">Nome do serviço</label><input id="plan-service-name" value={serviceName} onChange={(event) => setServiceName(event.target.value)} placeholder="Ex.: Corrida" maxLength={80} /></div>}<div className="plan-form-fields"><div className="field"><label htmlFor="plan-period">Período</label><select id="plan-period" value={period} onChange={(event) => setPeriod(event.target.value as Period)}>{periods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div><div className="field"><label htmlFor="plan-price">Valor mensal (R$)</label><input id="plan-price" type="number" min="1" max="100000" step="0.01" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="0,00" /></div></div>{error ? <p className="error-message">{error}</p> : null}{message ? <p className="success-message">{message}</p> : null}<div className="creation-actions"><button className="button button-dark" type="button" onClick={createPlan} disabled={pending}>{pending ? "Salvando..." : "Adicionar plano"}</button></div></section><section className="panel plans-list"><div className="panel-heading"><div><h2>Planos disponíveis</h2><p>{initialPlans.length ? "Os alunos escolhem entre os planos ativos." : "Nenhum plano criado ainda."}</p></div></div>{[...grouped.entries()].map(([serviceName, plans]) => <section className="plan-service-group" key={serviceName}><h3>{serviceName}</h3><div className="plan-table">{plans.map((plan) => <div className="plan-row" key={plan.id}><span><strong>{periods.find((item) => item.value === plan.period)?.label}</strong><small>{plan.active ? "Disponível" : "Pausado"}</small></span><b>{money(plan.priceCents)}<small>/ mês</small></b><button className="button button-quiet" type="button" onClick={() => togglePlan(plan)} disabled={pending}>{plan.active ? "Pausar" : "Reativar"}</button></div>)}</div></section>)}</section></div>;
}
