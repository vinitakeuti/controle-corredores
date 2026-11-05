"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Feedback } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { MenuButton } from "@/components/ui/menu-button";
import { Sheet } from "@/components/ui/sheet";
import { StatusPill } from "@/components/ui/status-pill";
import { formatCurrency } from "@/lib/format";

type Period = "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL";
type Method = "PIX" | "BOLETO" | "CARD";
type Plan = { id: string; period: Period; priceCents: number; allowedMethods: Method[]; automaticPixEnabled: boolean; isFeatured: boolean; active: boolean; _count?: { subscriptions: number } };
type Service = { id: string; name: string; plans: Plan[] };
type DeleteTarget = { kind: "plan" | "service"; id: string; name: string } | null;
type Editing = { plan: Plan; serviceName: string } | null;

const periods: { value: Period; label: string }[] = [{ value: "MONTHLY", label: "Mensal" }, { value: "QUARTERLY", label: "Trimestral" }, { value: "SEMIANNUAL", label: "Semestral" }, { value: "ANNUAL", label: "Anual" }];
const periodOrder = Object.fromEntries(periods.map((item, index) => [item.value, index])) as Record<Period, number>;
const periodLabel = (period: Period) => periods.find((item) => item.value === period)?.label ?? period;
const methods: Method[] = ["PIX", "CARD", "BOLETO"];
const methodLabels: Record<Method, string> = { PIX: "Pix", CARD: "Cartão", BOLETO: "Boleto" };
const toCents = (value: string) => Math.round(Number(value.replace(",", ".")) * 100);
const methodsText = (plan: Plan) => methods.filter((method) => plan.allowedMethods.includes(method)).map((method) => methodLabels[method]).join(", ");
const studentsText = (count: number) => `${count} ${count === 1 ? "aluno" : "alunos"}`;

// Campos de um plano: os mesmos para criar e para editar.
function PlanFields({ idPrefix, period, onPeriodChange, usedPeriods = [], price, onPriceChange, selected, onToggleMethod, automaticPix, onAutomaticPixChange, featured, onFeaturedChange, autofocusPrice = false }: {
  idPrefix: string; period?: Period; onPeriodChange?: (period: Period) => void; usedPeriods?: Period[];
  price: string; onPriceChange: (value: string) => void;
  selected: Method[]; onToggleMethod: (method: Method) => void;
  automaticPix: boolean; onAutomaticPixChange: () => void;
  featured: boolean; onFeaturedChange: () => void; autofocusPrice?: boolean;
}) {
  return <>
    <div className="form-grid plan-form-grid">
      {onPeriodChange ? <div className="form-field">
        <label htmlFor={`${idPrefix}-period`}>Período</label>
        <select className="control" id={`${idPrefix}-period`} value={period} onChange={(event) => onPeriodChange(event.target.value as Period)}>
          {periods.map((item) => <option key={item.value} value={item.value} disabled={usedPeriods.includes(item.value)}>{item.label}{usedPeriods.includes(item.value) ? " (já cadastrado)" : ""}</option>)}
        </select>
      </div> : null}
      <div className="form-field">
        <label htmlFor={`${idPrefix}-price`}>Valor mensal (R$)</label>
        <input className="control" id={`${idPrefix}-price`} type="number" min="1" step="0.01" inputMode="decimal" value={price} onChange={(event) => onPriceChange(event.target.value)} placeholder="0,00" data-autofocus={autofocusPrice || undefined} />
      </div>
    </div>
    <fieldset className="plan-fieldset">
      <legend className="form-label">Formas de pagamento</legend>
      <div className="plan-checks">
        {methods.map((method) => <label className="check" key={method}><input type="checkbox" checked={selected.includes(method)} onChange={() => onToggleMethod(method)} /><span className="check-copy"><strong>{methodLabels[method]}</strong></span></label>)}
        <label className="check"><input type="checkbox" checked={automaticPix} onChange={onAutomaticPixChange} /><span className="check-copy"><strong>Pix Automático</strong></span></label>
      </div>
    </fieldset>
    <label className="check plan-featured-check"><input type="checkbox" checked={featured} onChange={onFeaturedChange} /><span className="check-copy"><strong>Mais escolhido</strong><small>Destaca este plano para o aluno. Só um plano por categoria fica em destaque.</small></span></label>
  </>;
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
  const [editing, setEditing] = useState<Editing>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editMethods, setEditMethods] = useState<Method[]>([]);
  const [editAutomaticPix, setEditAutomaticPix] = useState(false);
  const [editFeatured, setEditFeatured] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  const services = initialServices.map((service) => ({ ...service, plans: [...service.plans].sort((a, b) => periodOrder[a.period] - periodOrder[b.period]) }));
  const toggle = (items: Method[], method: Method) => items.includes(method) ? items.filter((item) => item !== method) : [...items, method];

  function resetPlanForm() { setAddingServiceId(null); setPeriod("MONTHLY"); setPrice(""); setMethodsForNewPlan(["PIX", "CARD", "BOLETO"]); setAutomaticPixForNewPlan(true); setFeaturedForNewPlan(false); }
  function openAddPlan(service: Service) {
    resetPlanForm(); setError("");
    const free = periods.find((item) => !service.plans.some((plan) => plan.period === item.value));
    setPeriod(free?.value ?? "MONTHLY");
    setAddingServiceId(service.id);
  }
  function openEdit(plan: Plan, name: string) {
    setError("");
    setEditPrice((plan.priceCents / 100).toFixed(2)); setEditMethods(plan.allowedMethods); setEditAutomaticPix(plan.automaticPixEnabled); setEditFeatured(plan.isFeatured);
    setEditing({ plan, serviceName: name });
  }
  async function patchPlan(planId: string, body: Record<string, unknown>) {
    const response = await fetch(`/api/admin/plans/${encodeURIComponent(planId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Não foi possível atualizar o plano.");
    return data;
  }
  async function createPlan(serviceId?: string) {
    const priceCents = toCents(price);
    if ((!serviceId && serviceName.trim().length < 2) || !Number.isInteger(priceCents) || priceCents < 100 || !methodsForNewPlan.length) { setError("Informe uma categoria, valor e pelo menos um método de pagamento."); return; }
    setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serviceId, serviceName: serviceId ? undefined : serviceName, period, priceCents, allowedMethods: methodsForNewPlan, automaticPixEnabled: automaticPixForNewPlan, isFeatured: featuredForNewPlan }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível adicionar o plano.");
      setMessage(serviceId ? "Plano adicionado à categoria." : "Categoria e primeiro plano criados."); setNewServiceOpen(false); setServiceName(""); resetPlanForm(); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }
  // Envia só o que mudou: valor e opções seguem as mesmas regras da API de antes.
  async function saveEdit() {
    if (!editing) return;
    const { plan } = editing;
    const priceCents = toCents(editPrice);
    if (!Number.isInteger(priceCents) || priceCents < 100) { setError("Informe um valor válido."); return; }
    if (!editMethods.length) { setError("Selecione pelo menos um método de pagamento."); return; }
    const body: Record<string, unknown> = {};
    if (priceCents !== plan.priceCents) body.priceCents = priceCents;
    if (editMethods.length !== plan.allowedMethods.length || editMethods.some((method) => !plan.allowedMethods.includes(method))) body.allowedMethods = editMethods;
    if (editAutomaticPix !== plan.automaticPixEnabled) body.automaticPixEnabled = editAutomaticPix;
    if (editFeatured !== plan.isFeatured) body.isFeatured = editFeatured;
    if (!Object.keys(body).length) { setEditing(null); return; }
    setPending(true); setError(""); setMessage("");
    try {
      const data = await patchPlan(plan.id, body);
      setMessage(body.priceCents !== undefined ? (data.updatedStudents ? `Valor atualizado para ${data.updatedStudents} ${data.updatedStudents === 1 ? "aluno" : "alunos"}.` : "Valor do plano atualizado.") : "Opções do plano atualizadas.");
      setEditing(null); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível conectar ao servidor."); } finally { setPending(false); }
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

  const planActions = (plan: Plan, service: Service): { label: string; icon: "eye" | "eyeOff" | "trash"; tone?: "danger"; onSelect: () => void }[] => [
    { label: plan.active ? "Pausar plano" : "Reativar plano", icon: plan.active ? "eyeOff" : "eye", onSelect: () => { void togglePlan(plan); } },
    { label: "Excluir plano", icon: "trash", tone: "danger", onSelect: () => setDeleteTarget({ kind: "plan", id: plan.id, name: `${service.name} · ${periodLabel(plan.period)}` }) },
  ];
  const statusPill = (plan: Plan) => <StatusPill tone={plan.active ? "positive" : "neutral"}>{plan.active ? "Disponível" : "Pausado"}</StatusPill>;
  const featuredPill = (plan: Plan) => plan.isFeatured ? <StatusPill tone="info">Mais escolhido</StatusPill> : null;

  const addingService = services.find((service) => service.id === addingServiceId);
  const addingUsed = addingService?.plans.map((plan) => plan.period) ?? [];
  const addingFull = addingUsed.length >= periods.length;
  const priceChanged = editing ? toCents(editPrice) !== editing.plan.priceCents : false;
  const sheetOpen = newServiceOpen || Boolean(addingServiceId) || Boolean(deleteTarget) || Boolean(editing);

  return <div className="plans">
    <div className="plans-toolbar">
      <p className="plans-summary">{services.length} {services.length === 1 ? "categoria" : "categorias"} · {services.reduce((sum, service) => sum + service.plans.length, 0)} planos</p>
      <button className="btn btn-primary" type="button" onClick={() => { resetPlanForm(); setError(""); setNewServiceOpen(true); }}><Icon name="plus" />Nova categoria</button>
    </div>
    <Feedback success={message} error={!sheetOpen ? error : ""} />

    {services.length ? services.map((service) => {
      const available = service.plans.filter((plan) => plan.active).length;
      return <section className="section-block plan-group" key={service.id} aria-labelledby={`service-${service.id}`}>
        <div className="section-head plan-group-head">
          <div>
            <h2 className="section-title" id={`service-${service.id}`}>{service.name}</h2>
            <p className="section-lead">{service.plans.length} {service.plans.length === 1 ? "plano" : "planos"}{service.plans.length ? ` · ${available} ${available === 1 ? "disponível" : "disponíveis"}` : ""}</p>
          </div>
          <div className="btn-row plan-group-actions">
            <button className="btn btn-secondary" type="button" onClick={() => openAddPlan(service)} disabled={pending}><Icon name="plus" />Adicionar plano</button>
            <MenuButton label={`Mais ações de ${service.name}`} items={[{ label: "Excluir categoria", icon: "trash", tone: "danger", onSelect: () => setDeleteTarget({ kind: "service", id: service.id, name: service.name }) }]} />
          </div>
        </div>

        {service.plans.length ? <>
          <div className="data-table-wrap plan-table-wrap responsive-table">
            <table className="data-table plan-table">
              <caption className="visually-hidden">Planos de {service.name}</caption>
              <thead><tr><th scope="col">Período</th><th scope="col" className="num">Valor mensal</th><th scope="col">Pagamento</th><th scope="col" className="num">Alunos</th><th scope="col">Situação</th><th scope="col"><span className="visually-hidden">Ações</span></th></tr></thead>
              <tbody>{service.plans.map((plan) => <tr key={plan.id} data-paused={plan.active ? undefined : true}>
                <td><span className="plan-period">{periodLabel(plan.period)}{featuredPill(plan)}</span></td>
                <td className="num"><span className="plan-price">{formatCurrency(plan.priceCents)}</span></td>
                <td><span className="cell-primary plan-methods">{methodsText(plan)}</span>{plan.automaticPixEnabled ? <span className="cell-secondary">Pix Automático</span> : null}</td>
                <td className="num">{plan._count?.subscriptions ?? "—"}</td>
                <td>{statusPill(plan)}</td>
                <td><div className="plan-actions">
                  <button className="btn btn-quiet" type="button" onClick={() => openEdit(plan, service.name)} disabled={pending} aria-label={`Editar plano ${service.name} ${periodLabel(plan.period)}`}>Editar</button>
                  <MenuButton label={`Mais ações do plano ${periodLabel(plan.period)}`} items={planActions(plan, service)} />
                </div></td>
              </tr>)}</tbody>
            </table>
          </div>
          <ul className="data-rows responsive-rows plan-rows" aria-label={`Planos de ${service.name}`}>
            {service.plans.map((plan) => <li key={plan.id} data-paused={plan.active ? undefined : true}>
              <span className="row-title plan-period">{periodLabel(plan.period)}{featuredPill(plan)}</span>
              {statusPill(plan)}
              <span className="row-meta">
                <span className="plan-price">{formatCurrency(plan.priceCents)}/mês</span>
                <span>{methodsText(plan)}{plan.automaticPixEnabled ? " + Pix Automático" : ""}</span>
              </span>
              <span className="plan-row-count">{plan._count ? studentsText(plan._count.subscriptions) : null}</span>
              <div className="plan-row-actions">
                <button className="btn btn-quiet" type="button" onClick={() => openEdit(plan, service.name)} disabled={pending} aria-label={`Editar plano ${service.name} ${periodLabel(plan.period)}`}>Editar</button>
                <MenuButton label={`Mais ações do plano ${periodLabel(plan.period)}`} items={planActions(plan, service)} />
              </div>
            </li>)}
          </ul>
        </> : <p className="plan-empty">Esta categoria ainda não tem planos.</p>}
      </section>;
    }) : <div className="state-empty"><strong>Nenhuma categoria ainda.</strong><p>Crie a primeira categoria para começar a montar seus planos.</p></div>}

    {editing ? <Sheet open onClose={() => { setEditing(null); setError(""); }} title={`${editing.serviceName} · ${periodLabel(editing.plan.period)}`} className="sheet-wide">
      <form className="sheet-form" onSubmit={(event) => { event.preventDefault(); void saveEdit(); }}>
        <PlanFields idPrefix={`edit-plan-${editing.plan.id}`} price={editPrice} onPriceChange={setEditPrice} selected={editMethods} onToggleMethod={(method) => setEditMethods((current) => toggle(current, method))} automaticPix={editAutomaticPix} onAutomaticPixChange={() => setEditAutomaticPix((current) => !current)} featured={editFeatured} onFeaturedChange={() => setEditFeatured((current) => !current)} autofocusPrice />
        {priceChanged ? <div className="message" data-tone="warning"><Icon name="alert" /><div><strong>O novo valor vale para os alunos deste plano</strong><p>Quem não tem valor exclusivo passa a pagar {Number.isFinite(toCents(editPrice)) && toCents(editPrice) >= 100 ? formatCurrency(toCents(editPrice)) : "o novo valor"} por mês. Autorizações de Pix Automático ativas serão canceladas e o aluno precisará autorizar de novo.</p></div></div> : null}
        <Feedback error={error} />
        <div className="btn-row btn-row-split sheet-actions">
          <button className="btn btn-quiet" type="button" onClick={() => { setEditing(null); setError(""); }} disabled={pending}>Cancelar</button>
          <button className="btn btn-primary" type="submit" disabled={pending} aria-busy={pending}>{pending ? "Salvando..." : "Salvar plano"}</button>
        </div>
      </form>
    </Sheet> : null}

    {newServiceOpen ? <Sheet open onClose={() => { setNewServiceOpen(false); setError(""); }} title="Nova categoria" className="sheet-wide">
      <form className="sheet-form" onSubmit={(event) => { event.preventDefault(); void createPlan(); }}>
        <div className="form-field"><label htmlFor="new-service-name">Nome da categoria</label><input className="control" id="new-service-name" value={serviceName} onChange={(event) => setServiceName(event.target.value)} placeholder="Ex.: Corrida" maxLength={80} data-autofocus /></div>
        <p className="plan-form-note">Toda categoria começa com um plano. Os outros períodos podem ser adicionados depois.</p>
        <PlanFields idPrefix="new-service-plan" period={period} onPeriodChange={setPeriod} price={price} onPriceChange={setPrice} selected={methodsForNewPlan} onToggleMethod={(method) => setMethodsForNewPlan((current) => toggle(current, method))} automaticPix={automaticPixForNewPlan} onAutomaticPixChange={() => setAutomaticPixForNewPlan((current) => !current)} featured={featuredForNewPlan} onFeaturedChange={() => setFeaturedForNewPlan((current) => !current)} />
        <Feedback error={error} />
        <div className="btn-row btn-row-split sheet-actions">
          <button className="btn btn-quiet" type="button" onClick={() => { resetPlanForm(); setNewServiceOpen(false); setError(""); }} disabled={pending}>Cancelar</button>
          <button className="btn btn-primary" type="submit" disabled={pending} aria-busy={pending}>{pending ? "Salvando..." : "Criar categoria"}</button>
        </div>
      </form>
    </Sheet> : null}

    {addingService ? <Sheet open onClose={() => { resetPlanForm(); setError(""); }} title={`Novo plano em ${addingService.name}`} className="sheet-wide">
      <form className="sheet-form" onSubmit={(event) => { event.preventDefault(); void createPlan(addingService.id); }}>
        {addingFull ? <p className="message" data-tone="info"><Icon name="info" /><span>Esta categoria já tem plano para todos os períodos. Edite um plano existente para mudar valor ou pagamento.</span></p> : null}
        <PlanFields idPrefix={`new-plan-${addingService.id}`} period={period} onPeriodChange={setPeriod} usedPeriods={addingUsed} price={price} onPriceChange={setPrice} selected={methodsForNewPlan} onToggleMethod={(method) => setMethodsForNewPlan((current) => toggle(current, method))} automaticPix={automaticPixForNewPlan} onAutomaticPixChange={() => setAutomaticPixForNewPlan((current) => !current)} featured={featuredForNewPlan} onFeaturedChange={() => setFeaturedForNewPlan((current) => !current)} autofocusPrice />
        <Feedback error={error} />
        <div className="btn-row btn-row-split sheet-actions">
          <button className="btn btn-quiet" type="button" onClick={() => { resetPlanForm(); setError(""); }} disabled={pending}>Cancelar</button>
          <button className="btn btn-primary" type="submit" disabled={pending || addingFull} aria-busy={pending}>{pending ? "Salvando..." : "Adicionar"}</button>
        </div>
      </form>
    </Sheet> : null}

    {deleteTarget ? <Sheet open onClose={() => setDeleteTarget(null)} title={`Excluir ${deleteTarget.kind === "plan" ? "plano" : "categoria"}?`}>
      <div className="sheet-form">
        <p className="message" data-tone="danger"><Icon name="alert" /><span>{deleteTarget.kind === "plan" ? `“${deleteTarget.name}” será removido permanentemente.` : `“${deleteTarget.name}” e os planos sem vínculos ativos serão removidos.`}</span></p>
        <Feedback error={error} />
        <div className="btn-row btn-row-split sheet-actions"><button className="btn btn-secondary" type="button" onClick={() => setDeleteTarget(null)} disabled={pending}>Cancelar</button><button className="btn btn-danger-solid" type="button" onClick={confirmDelete} disabled={pending} aria-busy={pending}>{pending ? "Excluindo..." : "Confirmar exclusão"}</button></div>
      </div>
    </Sheet> : null}
  </div>;
}
