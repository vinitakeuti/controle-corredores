"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Period = "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL";
type Method = "PIX" | "BOLETO" | "CARD";
type Plan = { id: string; period: Period; priceCents: number; allowedMethods: Method[]; automaticPixEnabled: boolean; active: boolean };
type Service = { id: string; name: string; plans: Plan[] };
type DeleteTarget = { kind: "plan" | "service"; id: string; name: string } | null;

const periods: { value: Period; label: string }[] = [{ value: "MONTHLY", label: "Mensal" }, { value: "QUARTERLY", label: "Trimestral" }, { value: "SEMIANNUAL", label: "Semestral" }, { value: "ANNUAL", label: "Anual" }];
const methods: Method[] = ["PIX", "CARD", "BOLETO"];
const methodLabels: Record<Method, string> = { PIX: "Pix", CARD: "Cartão", BOLETO: "Boleto" };

function MethodsEditor({ methods: selected, onChange, legend, automaticPixEnabled, onAutomaticPixChange }: { methods: Method[]; onChange: (method: Method) => void; legend: string; automaticPixEnabled: boolean; onAutomaticPixChange: () => void }) {
  return <fieldset className="method-options plan-method-options"><legend>{legend}</legend>{methods.map((method) => <label key={method}><input type="checkbox" checked={selected.includes(method)} onChange={() => onChange(method)} />{methodLabels[method]}</label>)}<label><input type="checkbox" checked={automaticPixEnabled} onChange={onAutomaticPixChange} />Pix Automático</label></fieldset>;
}

export function PlansManager({ initialServices }: { initialServices: Service[] }) {
  const router = useRouter();
  const [newServiceOpen, setNewServiceOpen] = useState(false);
  const [serviceName, setServiceName] = useState("");
  const [addingServiceId, setAddingServiceId] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("MONTHLY");
  const [price, setPrice] = useState("");
  const [methodsForNewPlan, setMethodsForNewPlan] = useState<Method[]>(["PIX", "CARD", "BOLETO"]);
  const [automaticPixForNewPlan, setAutomaticPixForNewPlan] = useState(true);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>(() => Object.fromEntries(initialServices.flatMap((service) => service.plans.map((plan) => [plan.id, (plan.priceCents / 100).toFixed(2)]))));
  const [methodDrafts, setMethodDrafts] = useState<Record<string, Method[]>>(() => Object.fromEntries(initialServices.flatMap((service) => service.plans.map((plan) => [plan.id, plan.allowedMethods]))));
  const [automaticPixDrafts, setAutomaticPixDrafts] = useState<Record<string, boolean>>(() => Object.fromEntries(initialServices.flatMap((service) => service.plans.map((plan) => [plan.id, plan.automaticPixEnabled]))));
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  function resetPlanForm() { setAddingServiceId(null); setPeriod("MONTHLY"); setPrice(""); setMethodsForNewPlan(["PIX", "CARD", "BOLETO"]); setAutomaticPixForNewPlan(true); }
  function toggleMethod(method: Method, planId?: string) {
    const toggle = (items: Method[]) => items.includes(method) ? items.filter((item) => item !== method) : [...items, method];
    if (planId) setMethodDrafts((current) => ({ ...current, [planId]: toggle(current[planId] ?? []) }));
    else setMethodsForNewPlan((current) => toggle(current));
  }
  async function patchPlan(planId: string, body: Record<string, unknown>) {
    const response = await fetch(`/api/admin/plans/${encodeURIComponent(planId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Não foi possível atualizar o plano.");
    return data;
  }
  async function createPlan(serviceId?: string) {
    const priceCents = Math.round(Number(price.replace(",", ".")) * 100);
    if ((!serviceId && serviceName.trim().length < 2) || !Number.isInteger(priceCents) || priceCents < 100 || !methodsForNewPlan.length) { setError("Informe uma categoria, valor e pelo menos um método de pagamento."); return; }
    setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serviceId, serviceName: serviceId ? undefined : serviceName, period, priceCents, allowedMethods: methodsForNewPlan, automaticPixEnabled: automaticPixForNewPlan }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível adicionar o plano.");
      setPriceDrafts((current) => ({ ...current, [data.plan.id]: (data.plan.priceCents / 100).toFixed(2) })); setMethodDrafts((current) => ({ ...current, [data.plan.id]: data.plan.allowedMethods })); setAutomaticPixDrafts((current) => ({ ...current, [data.plan.id]: data.plan.automaticPixEnabled }));
      setMessage(serviceId ? "Plano adicionado à categoria." : "Categoria e primeiro plano criados."); setNewServiceOpen(false); setServiceName(""); resetPlanForm(); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }
  async function savePrice(plan: Plan) {
    const priceCents = Math.round(Number((priceDrafts[plan.id] ?? "").replace(",", ".")) * 100);
    if (!Number.isInteger(priceCents) || priceCents < 100) { setError("Informe um valor válido."); return; }
    setPending(true); setError(""); setMessage("");
    try { const data = await patchPlan(plan.id, { priceCents }); setMessage(data.updatedStudents ? `Valor atualizado para ${data.updatedStudents} aluno(s).` : "Valor do plano atualizado."); router.refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }
  async function saveMethods(plan: Plan) {
    const allowedMethods = methodDrafts[plan.id] ?? [];
    if (!allowedMethods.length) { setError("Selecione pelo menos um método de pagamento."); return; }
    setPending(true); setError(""); setMessage("");
    try { await patchPlan(plan.id, { allowedMethods, automaticPixEnabled: automaticPixDrafts[plan.id] ?? false }); setMessage("Métodos de pagamento atualizados."); router.refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }
  async function togglePlan(plan: Plan) {
    setPending(true); setError(""); setMessage("");
    try { await patchPlan(plan.id, { active: !plan.active }); setMessage(plan.active ? "Plano pausado para novas escolhas." : "Plano reativado."); router.refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }
  async function confirmDelete() {
    if (!deleteTarget) return;
    setPending(true); setError(""); setMessage("");
    try { const path = deleteTarget.kind === "plan" ? `/api/admin/plans/${encodeURIComponent(deleteTarget.id)}` : `/api/admin/services/${encodeURIComponent(deleteTarget.id)}`; const response = await fetch(path, { method: "DELETE" }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Não foi possível excluir."); setMessage(deleteTarget.kind === "plan" ? "Plano excluído." : "Categoria e seus planos foram excluídos."); setDeleteTarget(null); router.refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }

  const planForm = (serviceId?: string) => <div className="inline-plan-form"><div className="field"><label htmlFor={`new-plan-period-${serviceId ?? "service"}`}>Período</label><select id={`new-plan-period-${serviceId ?? "service"}`} value={period} onChange={(event) => setPeriod(event.target.value as Period)}>{periods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div><div className="field"><label htmlFor={`new-plan-price-${serviceId ?? "service"}`}>Valor mensal (R$)</label><input id={`new-plan-price-${serviceId ?? "service"}`} type="number" min="1" step="0.01" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="0,00" /></div><MethodsEditor methods={methodsForNewPlan} onChange={toggleMethod} automaticPixEnabled={automaticPixForNewPlan} onAutomaticPixChange={() => setAutomaticPixForNewPlan((current) => !current)} legend="Métodos deste plano" /><div className="inline-plan-actions"><button className="button button-dark" type="button" onClick={() => createPlan(serviceId)} disabled={pending}>{pending ? "Salvando..." : "Adicionar"}</button><button className="button button-quiet" type="button" onClick={resetPlanForm} disabled={pending}>Cancelar</button></div></div>;

  return <section className="plans-catalog">
    <div className="plans-catalog-heading"><div><h2>Categorias e planos</h2><p>Cadastre o valor mensal, a duração e os métodos disponíveis para cada plano.</p></div><button className="button button-dark" type="button" onClick={() => { setNewServiceOpen((open) => !open); resetPlanForm(); }}>{newServiceOpen ? "Fechar" : "Nova categoria"}</button></div>
    {newServiceOpen ? <section className="new-service-card"><div className="field"><label htmlFor="new-service-name">Nome da categoria</label><input id="new-service-name" value={serviceName} onChange={(event) => setServiceName(event.target.value)} placeholder="Ex.: Corrida" maxLength={80} /></div>{planForm()}</section> : null}
    {error ? <p className="error-message">{error}</p> : null}
    {message ? <p className="success-message">{message}</p> : null}
    <div className="service-catalog-list">{initialServices.length ? initialServices.map((service) => <section className="service-catalog-card" key={service.id}>
      <div className="service-catalog-header"><div><p className="eyebrow">Categoria</p><h3>{service.name}</h3><span>{service.plans.length} plano(s) cadastrado(s)</span></div><div className="service-catalog-actions"><button className="button button-secondary" type="button" onClick={() => { setAddingServiceId(addingServiceId === service.id ? null : service.id); setPrice(""); }} disabled={pending}>{addingServiceId === service.id ? "Fechar" : "Adicionar plano"}</button><button className="button button-danger-quiet" type="button" onClick={() => setDeleteTarget({ kind: "service", id: service.id, name: service.name })} disabled={pending}>Excluir categoria</button></div></div>
      {addingServiceId === service.id ? planForm(service.id) : null}
      <div className="plan-table">{service.plans.length ? service.plans.map((plan) => <div className="plan-row" key={plan.id}>
        <span><strong>{periods.find((item) => item.value === plan.period)?.label}</strong><small>{plan.active ? "Disponível" : "Pausado"}</small></span>
        <div className="plan-row-price"><label className="sr-only" htmlFor={`plan-price-${plan.id}`}>Valor do plano</label><input id={`plan-price-${plan.id}`} type="number" min="1" step="0.01" inputMode="decimal" value={priceDrafts[plan.id] ?? ""} onChange={(event) => setPriceDrafts((current) => ({ ...current, [plan.id]: event.target.value }))} /><small>/ mês</small></div>
        <MethodsEditor methods={methodDrafts[plan.id] ?? []} onChange={(method) => toggleMethod(method, plan.id)} automaticPixEnabled={automaticPixDrafts[plan.id] ?? false} onAutomaticPixChange={() => setAutomaticPixDrafts((current) => ({ ...current, [plan.id]: !(current[plan.id] ?? false) }))} legend="Métodos" />
        <div className="plan-row-actions"><button className="button button-secondary" type="button" onClick={() => savePrice(plan)} disabled={pending}>Salvar valor</button><button className="button button-secondary" type="button" onClick={() => saveMethods(plan)} disabled={pending}>Salvar métodos</button><button className="button button-quiet" type="button" onClick={() => togglePlan(plan)} disabled={pending}>{plan.active ? "Pausar" : "Reativar"}</button><button className="button button-danger-quiet" type="button" onClick={() => setDeleteTarget({ kind: "plan", id: plan.id, name: `${service.name} · ${periods.find((item) => item.value === plan.period)?.label}` })} disabled={pending}>Excluir</button></div>
      </div>) : <p className="service-no-plans">Esta categoria ainda não tem planos.</p>}</div>
    </section>) : <div className="empty-state">Crie a primeira categoria para começar a montar seus planos.</div>}</div>
    {deleteTarget ? <section className="plan-delete-confirm"><strong>Excluir {deleteTarget.kind === "plan" ? "plano" : "categoria"}?</strong><p>{deleteTarget.kind === "plan" ? `“${deleteTarget.name}” será removido permanentemente.` : `“${deleteTarget.name}” e os planos sem vínculos ativos serão removidos.`}</p><div><button className="button button-quiet" type="button" onClick={() => setDeleteTarget(null)} disabled={pending}>Cancelar</button><button className="button button-danger" type="button" onClick={confirmDelete} disabled={pending}>{pending ? "Excluindo..." : "Confirmar exclusão"}</button></div></section> : null}
  </section>;
}
