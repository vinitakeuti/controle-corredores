"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Feedback } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { StatusPill } from "@/components/ui/status-pill";

type Period = "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL";
type Method = "PIX" | "BOLETO" | "CARD";
type Plan = { id: string; period: Period; priceCents: number; allowedMethods: Method[]; automaticPixEnabled: boolean; isFeatured: boolean; active: boolean };
type Service = { id: string; name: string; plans: Plan[] };
type DeleteTarget = { kind: "plan" | "service"; id: string; name: string } | null;

const periods: { value: Period; label: string }[] = [{ value: "MONTHLY", label: "Mensal" }, { value: "QUARTERLY", label: "Trimestral" }, { value: "SEMIANNUAL", label: "Semestral" }, { value: "ANNUAL", label: "Anual" }];
const methods: Method[] = ["PIX", "CARD", "BOLETO"];
const methodLabels: Record<Method, string> = { PIX: "Pix", CARD: "Cartão", BOLETO: "Boleto" };

function MethodsEditor({ methods: selected, onChange, legend, automaticPixEnabled, onAutomaticPixChange, isFeatured, onFeaturedChange }: { methods: Method[]; onChange: (method: Method) => void; legend: string; automaticPixEnabled: boolean; onAutomaticPixChange: () => void; isFeatured: boolean; onFeaturedChange: () => void }) {
  return <fieldset className="option-checks">
    <legend className="form-label">{legend}</legend>
    <div className="option-checks-list">
      {methods.map((method) => <label className="option-check" key={method}><input type="checkbox" checked={selected.includes(method)} onChange={() => onChange(method)} />{methodLabels[method]}</label>)}
      <label className="option-check"><input type="checkbox" checked={automaticPixEnabled} onChange={onAutomaticPixChange} />Pix Automático</label>
      <label className="option-check"><input type="checkbox" checked={isFeatured} onChange={onFeaturedChange} />Mais escolhido</label>
    </div>
  </fieldset>;
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
  const [featuredForNewPlan, setFeaturedForNewPlan] = useState(false);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>(() => Object.fromEntries(initialServices.flatMap((service) => service.plans.map((plan) => [plan.id, (plan.priceCents / 100).toFixed(2)]))));
  const [methodDrafts, setMethodDrafts] = useState<Record<string, Method[]>>(() => Object.fromEntries(initialServices.flatMap((service) => service.plans.map((plan) => [plan.id, plan.allowedMethods]))));
  const [automaticPixDrafts, setAutomaticPixDrafts] = useState<Record<string, boolean>>(() => Object.fromEntries(initialServices.flatMap((service) => service.plans.map((plan) => [plan.id, plan.automaticPixEnabled]))));
  const [featuredDrafts, setFeaturedDrafts] = useState<Record<string, boolean>>(() => Object.fromEntries(initialServices.flatMap((service) => service.plans.map((plan) => [plan.id, plan.isFeatured]))));
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  function resetPlanForm() { setAddingServiceId(null); setPeriod("MONTHLY"); setPrice(""); setMethodsForNewPlan(["PIX", "CARD", "BOLETO"]); setAutomaticPixForNewPlan(true); setFeaturedForNewPlan(false); }
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
      const response = await fetch("/api/admin/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serviceId, serviceName: serviceId ? undefined : serviceName, period, priceCents, allowedMethods: methodsForNewPlan, automaticPixEnabled: automaticPixForNewPlan, isFeatured: featuredForNewPlan }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível adicionar o plano.");
      setPriceDrafts((current) => ({ ...current, [data.plan.id]: (data.plan.priceCents / 100).toFixed(2) })); setMethodDrafts((current) => ({ ...current, [data.plan.id]: data.plan.allowedMethods })); setAutomaticPixDrafts((current) => ({ ...current, [data.plan.id]: data.plan.automaticPixEnabled })); setFeaturedDrafts((current) => ({ ...current, [data.plan.id]: data.plan.isFeatured }));
      setMessage(serviceId ? "Plano adicionado à categoria." : "Categoria e primeiro plano criados."); setNewServiceOpen(false); setServiceName(""); resetPlanForm(); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }
  async function savePrice(plan: Plan) {
    const priceCents = Math.round(Number((priceDrafts[plan.id] ?? "").replace(",", ".")) * 100);
    if (!Number.isInteger(priceCents) || priceCents < 100) { setError("Informe um valor válido."); return; }
    setPending(true); setError(""); setMessage("");
    try { const data = await patchPlan(plan.id, { priceCents }); setMessage(data.updatedStudents ? `Valor atualizado para ${data.updatedStudents} ${data.updatedStudents === 1 ? "aluno" : "alunos"}.` : "Valor do plano atualizado."); router.refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }
  async function saveOptions(plan: Plan) {
    const allowedMethods = methodDrafts[plan.id] ?? [];
    if (!allowedMethods.length) { setError("Selecione pelo menos um método de pagamento."); return; }
    setPending(true); setError(""); setMessage("");
    try { await patchPlan(plan.id, { allowedMethods, automaticPixEnabled: automaticPixDrafts[plan.id] ?? false, isFeatured: featuredDrafts[plan.id] ?? false }); setMessage("Opções do plano atualizadas."); router.refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível conectar ao servidor."); } finally { setPending(false); }
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

  const planForm = (serviceId?: string) => {
    const suffix = serviceId ?? "service";
    return <>
      <div className="form-grid">
        <div className="form-field"><label htmlFor={`new-plan-period-${suffix}`}>Período</label><select className="control" id={`new-plan-period-${suffix}`} value={period} onChange={(event) => setPeriod(event.target.value as Period)}>{periods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
        <div className="form-field"><label htmlFor={`new-plan-price-${suffix}`}>Valor mensal (R$)</label><input className="control" id={`new-plan-price-${suffix}`} type="number" min="1" step="0.01" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="0,00" /></div>
      </div>
      <MethodsEditor methods={methodsForNewPlan} onChange={toggleMethod} automaticPixEnabled={automaticPixForNewPlan} onAutomaticPixChange={() => setAutomaticPixForNewPlan((current) => !current)} isFeatured={featuredForNewPlan} onFeaturedChange={() => setFeaturedForNewPlan((current) => !current)} legend="Opções deste plano" />
      <Feedback error={error} />
      <div className="btn-row btn-row-split sheet-actions">
        <button className="btn btn-quiet" type="button" onClick={() => { resetPlanForm(); setNewServiceOpen(false); setError(""); }} disabled={pending}>Cancelar</button>
        <button className="btn btn-primary" type="submit" disabled={pending} aria-busy={pending}>{pending ? "Salvando..." : "Adicionar"}</button>
      </div>
    </>;
  };
  const addingService = initialServices.find((service) => service.id === addingServiceId);

  return <section className="section-block plans" aria-labelledby="plans-title">
    <div className="section-head">
      <div><h2 className="section-title" id="plans-title">Categorias e planos</h2><p className="section-lead">Cadastre o valor mensal, a duração e os métodos disponíveis para cada plano.</p></div>
      <button className="btn btn-primary" type="button" onClick={() => { resetPlanForm(); setError(""); setNewServiceOpen(true); }}><Icon name="plus" />Nova categoria</button>
    </div>
    <Feedback success={message} error={!newServiceOpen && !addingServiceId && !deleteTarget ? error : ""} />

    {initialServices.length ? initialServices.map((service) => <section className="plan-group" key={service.id} aria-labelledby={`service-${service.id}`}>
      <div className="plan-group-head">
        <div><h3 className="section-title" id={`service-${service.id}`}>{service.name}</h3><p className="section-lead">{service.plans.length} {service.plans.length === 1 ? "plano cadastrado" : "planos cadastrados"}</p></div>
        <div className="btn-row">
          <button className="btn btn-secondary" type="button" onClick={() => { resetPlanForm(); setError(""); setAddingServiceId(service.id); setPrice(""); }} disabled={pending}><Icon name="plus" />Adicionar plano</button>
          <button className="btn btn-danger" type="button" onClick={() => setDeleteTarget({ kind: "service", id: service.id, name: service.name })} disabled={pending}><Icon name="trash" />Excluir categoria</button>
        </div>
      </div>
      {service.plans.length ? <ul className="plan-rows">{service.plans.map((plan) => {
        const label = periods.find((item) => item.value === plan.period)?.label;
        return <li className="plan-row-item" key={plan.id}>
          <div className="plan-row-name"><strong>{label}</strong><StatusPill tone={plan.active ? "positive" : "neutral"}>{plan.active ? "Disponível" : "Pausado"}</StatusPill></div>
          <div className="plan-row-price-field">
            <label className="form-label" htmlFor={`plan-price-${plan.id}`}>Valor do plano <span className="optional-tag">/ mês</span></label>
            <div className="control-group"><input className="control" id={`plan-price-${plan.id}`} type="number" min="1" step="0.01" inputMode="decimal" value={priceDrafts[plan.id] ?? ""} onChange={(event) => setPriceDrafts((current) => ({ ...current, [plan.id]: event.target.value }))} /><button className="btn btn-secondary" type="button" onClick={() => savePrice(plan)} disabled={pending}>Salvar valor</button></div>
          </div>
          <div className="plan-row-options">
            <MethodsEditor methods={methodDrafts[plan.id] ?? []} onChange={(method) => toggleMethod(method, plan.id)} automaticPixEnabled={automaticPixDrafts[plan.id] ?? false} onAutomaticPixChange={() => setAutomaticPixDrafts((current) => ({ ...current, [plan.id]: !(current[plan.id] ?? false) }))} isFeatured={featuredDrafts[plan.id] ?? false} onFeaturedChange={() => setFeaturedDrafts((current) => ({ ...current, [plan.id]: !(current[plan.id] ?? false) }))} legend="Opções" />
            <button className="btn btn-secondary" type="button" onClick={() => saveOptions(plan)} disabled={pending}>Salvar opções</button>
          </div>
          <div className="btn-row plan-row-tools">
            <button className="btn btn-quiet" type="button" onClick={() => togglePlan(plan)} disabled={pending}>{plan.active ? "Pausar" : "Reativar"}</button>
            <button className="icon-btn plan-row-delete" type="button" onClick={() => setDeleteTarget({ kind: "plan", id: plan.id, name: `${service.name} · ${label}` })} disabled={pending} aria-label={`Excluir o plano ${service.name} ${label}`} title="Excluir"><Icon name="trash" /></button>
          </div>
        </li>;
      })}</ul> : <p className="ledger-empty">Esta categoria ainda não tem planos.</p>}
    </section>) : <div className="state-empty"><strong>Nenhuma categoria ainda.</strong><p>Crie a primeira categoria para começar a montar seus planos.</p></div>}

    {newServiceOpen ? <Sheet open onClose={() => { setNewServiceOpen(false); setError(""); }} title="Nova categoria" className="sheet-wide">
      <form className="sheet-form" onSubmit={(event) => { event.preventDefault(); void createPlan(); }}>
        <div className="form-field"><label htmlFor="new-service-name">Nome da categoria</label><input className="control" id="new-service-name" value={serviceName} onChange={(event) => setServiceName(event.target.value)} placeholder="Ex.: Corrida" maxLength={80} data-autofocus /></div>
        {planForm()}
      </form>
    </Sheet> : null}

    {addingService ? <Sheet open onClose={() => { resetPlanForm(); setError(""); }} title={`Novo plano em ${addingService.name}`} className="sheet-wide">
      <form className="sheet-form" onSubmit={(event) => { event.preventDefault(); void createPlan(addingService.id); }}>{planForm(addingService.id)}</form>
    </Sheet> : null}

    {deleteTarget ? <Sheet open onClose={() => setDeleteTarget(null)} title={`Excluir ${deleteTarget.kind === "plan" ? "plano" : "categoria"}?`}>
      <div className="sheet-form">
        <p className="message" data-tone="danger"><Icon name="alert" /><span>{deleteTarget.kind === "plan" ? `“${deleteTarget.name}” será removido permanentemente.` : `“${deleteTarget.name}” e os planos sem vínculos ativos serão removidos.`}</span></p>
        <Feedback error={error} />
        <div className="btn-row btn-row-split sheet-actions"><button className="btn btn-secondary" type="button" onClick={() => setDeleteTarget(null)} disabled={pending}>Cancelar</button><button className="btn btn-danger-solid" type="button" onClick={confirmDelete} disabled={pending} aria-busy={pending}>{pending ? "Excluindo..." : "Confirmar exclusão"}</button></div>
      </div>
    </Sheet> : null}
  </section>;
}
