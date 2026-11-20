"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Feedback } from "@/components/ui/feedback";
import { Icon, type IconName } from "@/components/ui/icon";
import { MenuButton } from "@/components/ui/menu-button";
import { QrPanel } from "@/components/ui/qr-code";
import { Sheet } from "@/components/ui/sheet";
import { StatusPill } from "@/components/ui/status-pill";
import { formatCurrency } from "@/lib/format";

type Period = "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL";
type Method = "PIX" | "BOLETO" | "CARD";
type Plan = { id: string; period: Period; priceCents: number; name: string | null; isHidden: boolean; isCourtesy: boolean; allowedMethods: Method[]; automaticPixEnabled: boolean; isFeatured: boolean; active: boolean; _count?: { subscriptions: number } };
type Service = { id: string; name: string; plans: Plan[] };
type DeleteTarget = { kind: "plan" | "service"; id: string; name: string } | null;
type Editing = { plan: Plan; serviceName: string } | null;
type LinkTarget = { plan: Plan; label: string; url: string | null; copied: boolean } | null;

const periods: { value: Period; label: string }[] = [{ value: "MONTHLY", label: "Mensal" }, { value: "QUARTERLY", label: "Trimestral" }, { value: "SEMIANNUAL", label: "Semestral" }, { value: "ANNUAL", label: "Anual" }];
const periodOrder = Object.fromEntries(periods.map((item, index) => [item.value, index])) as Record<Period, number>;
const periodLabel = (period: Period) => periods.find((item) => item.value === period)?.label ?? period;
const methods: Method[] = ["PIX", "CARD", "BOLETO"];
const methodLabels: Record<Method, string> = { PIX: "Pix", CARD: "Cartão", BOLETO: "Boleto" };
const toCents = (value: string) => Math.round(Number(value.replace(",", ".")) * 100);
const methodsText = (plan: Plan) => methods.filter((method) => plan.allowedMethods.includes(method)).map((method) => methodLabels[method]).join(", ");
const studentsText = (count: number) => `${count} ${count === 1 ? "aluno" : "alunos"}`;
// Nome curto dentro da categoria: período (público), nome (oculto).
const planTitle = (plan: Plan) => plan.isHidden && plan.name ? plan.name : periodLabel(plan.period);
const planFullName = (plan: Plan, serviceName: string) => plan.isHidden && plan.name ? `${serviceName} · ${plan.name}${plan.isCourtesy ? "" : ` · ${periodLabel(plan.period)}`}` : `${serviceName} · ${periodLabel(plan.period)}`;
// Públicos primeiro, por período; depois os ocultos, por nome.
const sortPlans = (plans: Plan[]) => [...plans].sort((a, b) => Number(a.isHidden) - Number(b.isHidden) || (a.isHidden ? (a.name ?? "").localeCompare(b.name ?? "", "pt-BR") : 0) || periodOrder[a.period] - periodOrder[b.period]);

type Visibility = { hidden: boolean; onHiddenChange: () => void; courtesy: boolean; onCourtesyChange: () => void };

// Campos de um plano: os mesmos para criar e para editar. Oculto e cortesia
// só se escolhem na criação; o nome do plano oculto pode ser editado depois.
function PlanFields({ idPrefix, visibility, hidden, courtesy, name, onNameChange, period, onPeriodChange, usedPeriods = [], price, onPriceChange, selected, onToggleMethod, automaticPix, onAutomaticPixChange, featured, onFeaturedChange, autofocusPrice = false }: {
  idPrefix: string; visibility?: Visibility; hidden: boolean; courtesy: boolean; name: string; onNameChange: (value: string) => void;
  period?: Period; onPeriodChange?: (period: Period) => void; usedPeriods?: Period[];
  price: string; onPriceChange: (value: string) => void;
  selected: Method[]; onToggleMethod: (method: Method) => void;
  automaticPix: boolean; onAutomaticPixChange: () => void;
  featured: boolean; onFeaturedChange: () => void; autofocusPrice?: boolean;
}) {
  return <>
    {visibility ? <label className="check plan-hidden-check"><input type="checkbox" checked={visibility.hidden} onChange={visibility.onHiddenChange} /><span className="check-copy"><strong>Plano oculto</strong><small>Não aparece para alunos nem leads. Só a equipe aplica no perfil do aluno ou envia por um link de cadastro.</small></span></label> : null}
    {hidden ? <div className="form-field">
      <label htmlFor={`${idPrefix}-name`}>Nome do plano</label>
      <input className="control" id={`${idPrefix}-name`} value={name} onChange={(event) => onNameChange(event.target.value)} maxLength={60} placeholder="Ex.: Parceria Academia X" aria-describedby={`${idPrefix}-name-hint`} />
      <p className="field-hint" id={`${idPrefix}-name-hint`}>O aluno vê este nome na área dele.</p>
    </div> : null}
    {visibility && hidden ? <label className="check"><input type="checkbox" checked={visibility.courtesy} onChange={visibility.onCourtesyChange} /><span className="check-copy"><strong>Cortesia</strong><small>Sem valor e sem cobrança: o aluno fica ativo assim que se cadastra.</small></span></label> : null}
    {courtesy ? null : <>
      <div className="form-grid plan-form-grid">
        {onPeriodChange ? <div className="form-field">
          <label htmlFor={`${idPrefix}-period`}>Período</label>
          <select className="control" id={`${idPrefix}-period`} value={period} onChange={(event) => onPeriodChange(event.target.value as Period)}>
            {periods.map((item) => { const used = !hidden && usedPeriods.includes(item.value); return <option key={item.value} value={item.value} disabled={used}>{item.label}{used ? " (já cadastrado)" : ""}</option>; })}
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
    </>}
    {hidden ? null : <label className="check plan-featured-check"><input type="checkbox" checked={featured} onChange={onFeaturedChange} /><span className="check-copy"><strong>Mais escolhido</strong><small>Destaca este plano para o aluno. Só um plano por categoria fica em destaque.</small></span></label>}
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
  const [hiddenForNewPlan, setHiddenForNewPlan] = useState(false);
  const [courtesyForNewPlan, setCourtesyForNewPlan] = useState(false);
  const [nameForNewPlan, setNameForNewPlan] = useState("");
  const [editing, setEditing] = useState<Editing>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editMethods, setEditMethods] = useState<Method[]>([]);
  const [editAutomaticPix, setEditAutomaticPix] = useState(false);
  const [editFeatured, setEditFeatured] = useState(false);
  const [editName, setEditName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [linkTarget, setLinkTarget] = useState<LinkTarget>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  const services = initialServices.map((service) => ({ ...service, plans: sortPlans(service.plans) }));
  const toggle = (items: Method[], method: Method) => items.includes(method) ? items.filter((item) => item !== method) : [...items, method];
  const visiblePeriods = (service: Service | undefined) => service?.plans.filter((plan) => !plan.isHidden).map((plan) => plan.period) ?? [];

  function resetPlanForm() { setAddingServiceId(null); setPeriod("MONTHLY"); setPrice(""); setMethodsForNewPlan(["PIX", "CARD", "BOLETO"]); setAutomaticPixForNewPlan(true); setFeaturedForNewPlan(false); setHiddenForNewPlan(false); setCourtesyForNewPlan(false); setNameForNewPlan(""); }
  function openAddPlan(service: Service) {
    resetPlanForm(); setError("");
    const used = visiblePeriods(service);
    const free = periods.find((item) => !used.includes(item.value));
    setPeriod(free?.value ?? "MONTHLY");
    // Todos os períodos públicos ocupados: o que sobra é criar um plano oculto.
    if (!free) setHiddenForNewPlan(true);
    setAddingServiceId(service.id);
  }
  function toggleHiddenForNewPlan(service: Service | undefined) {
    const next = !hiddenForNewPlan;
    setHiddenForNewPlan(next);
    if (!next) {
      setCourtesyForNewPlan(false);
      const used = visiblePeriods(service);
      if (used.includes(period)) setPeriod(periods.find((item) => !used.includes(item.value))?.value ?? period);
    } else setFeaturedForNewPlan(false);
  }
  const newPlanVisibility = (service: Service | undefined): Visibility => ({ hidden: hiddenForNewPlan, onHiddenChange: () => toggleHiddenForNewPlan(service), courtesy: courtesyForNewPlan, onCourtesyChange: () => setCourtesyForNewPlan((current) => !current) });
  function openEdit(plan: Plan, name: string) {
    setError("");
    setEditPrice((plan.priceCents / 100).toFixed(2)); setEditMethods(plan.allowedMethods); setEditAutomaticPix(plan.automaticPixEnabled); setEditFeatured(plan.isFeatured); setEditName(plan.name ?? "");
    setEditing({ plan, serviceName: name });
  }
  async function patchPlan(planId: string, body: Record<string, unknown>) {
    const response = await fetch(`/api/admin/plans/${encodeURIComponent(planId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Não foi possível atualizar o plano.");
    return data;
  }
  async function createPlan(serviceId?: string) {
    const priceCents = courtesyForNewPlan ? 0 : toCents(price);
    if (!serviceId && serviceName.trim().length < 2) { setError("Informe o nome da categoria."); return; }
    if (hiddenForNewPlan && nameForNewPlan.trim().length < 2) { setError("Dê um nome ao plano oculto para a equipe reconhecê-lo."); return; }
    if (!courtesyForNewPlan && (!Number.isInteger(priceCents) || priceCents < 100 || !methodsForNewPlan.length)) { setError("Informe um valor e pelo menos um método de pagamento."); return; }
    setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serviceId, serviceName: serviceId ? undefined : serviceName, period, priceCents, allowedMethods: methodsForNewPlan, automaticPixEnabled: automaticPixForNewPlan, isFeatured: featuredForNewPlan, isHidden: hiddenForNewPlan, isCourtesy: hiddenForNewPlan && courtesyForNewPlan, name: hiddenForNewPlan ? nameForNewPlan : undefined }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível adicionar o plano.");
      setMessage(hiddenForNewPlan ? "Plano oculto criado. Aplique no perfil do aluno ou gere um link de cadastro no menu do plano." : serviceId ? "Plano adicionado à categoria." : "Categoria e primeiro plano criados.");
      setNewServiceOpen(false); setServiceName(""); resetPlanForm(); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }
  // Envia só o que mudou: valor e opções seguem as mesmas regras da API de antes.
  async function saveEdit() {
    if (!editing) return;
    const { plan } = editing;
    const body: Record<string, unknown> = {};
    if (plan.isHidden) {
      if (editName.trim().length < 2) { setError("Dê um nome ao plano oculto."); return; }
      if (editName.trim() !== plan.name) body.name = editName;
    }
    if (!plan.isCourtesy) {
      const priceCents = toCents(editPrice);
      if (!Number.isInteger(priceCents) || priceCents < 100) { setError("Informe um valor válido."); return; }
      if (!editMethods.length) { setError("Selecione pelo menos um método de pagamento."); return; }
      if (priceCents !== plan.priceCents) body.priceCents = priceCents;
      if (editMethods.length !== plan.allowedMethods.length || editMethods.some((method) => !plan.allowedMethods.includes(method))) body.allowedMethods = editMethods;
      if (editAutomaticPix !== plan.automaticPixEnabled) body.automaticPixEnabled = editAutomaticPix;
      if (!plan.isHidden && editFeatured !== plan.isFeatured) body.isFeatured = editFeatured;
    }
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
    try { await patchPlan(plan.id, { active: !plan.active }); setMessage(plan.active ? (plan.isHidden ? "Plano pausado. Links de cadastro ainda não usados deixam de funcionar." : "Plano pausado para novas escolhas.") : "Plano reativado."); router.refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }
  async function confirmDelete() {
    if (!deleteTarget) return;
    setPending(true); setError(""); setMessage("");
    try { const path = deleteTarget.kind === "plan" ? `/api/admin/plans/${encodeURIComponent(deleteTarget.id)}` : `/api/admin/services/${encodeURIComponent(deleteTarget.id)}`; const response = await fetch(path, { method: "DELETE" }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Não foi possível excluir."); setMessage(deleteTarget.kind === "plan" ? "Plano excluído." : "Categoria e seus planos foram excluídos."); setDeleteTarget(null); router.refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }
  async function generateLink() {
    if (!linkTarget) return;
    setPending(true); setError("");
    try {
      const response = await fetch("/api/admin/payment-links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId: linkTarget.plan.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível gerar o link.");
      setLinkTarget({ ...linkTarget, url: data.paymentUrl, copied: false });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }
  async function copyLink() {
    if (!linkTarget?.url) return;
    try { await navigator.clipboard.writeText(linkTarget.url); setLinkTarget({ ...linkTarget, copied: true }); } catch { setError("Não foi possível copiar. Selecione o link manualmente."); }
  }

  const planActions = (plan: Plan, service: Service): { label: string; icon: IconName; tone?: "danger"; onSelect: () => void }[] => [
    ...(plan.isHidden && plan.active ? [{ label: "Gerar link de cadastro", icon: "link" as const, onSelect: () => { setError(""); setLinkTarget({ plan, label: planFullName(plan, service.name), url: null, copied: false }); } }] : []),
    { label: plan.active ? "Pausar plano" : "Reativar plano", icon: plan.active ? "eyeOff" : "eye", onSelect: () => { void togglePlan(plan); } },
    { label: "Excluir plano", icon: "trash", tone: "danger", onSelect: () => setDeleteTarget({ kind: "plan", id: plan.id, name: planFullName(plan, service.name) }) },
  ];
  const statusPill = (plan: Plan) => <StatusPill tone={plan.active ? "positive" : "neutral"}>{plan.active ? "Disponível" : "Pausado"}</StatusPill>;
  const planPills = (plan: Plan) => <>
    {plan.isFeatured ? <StatusPill tone="info">Mais escolhido</StatusPill> : null}
    {plan.isHidden ? <StatusPill tone="neutral">Oculto</StatusPill> : null}
    {plan.isCourtesy ? <StatusPill tone="info">Cortesia</StatusPill> : null}
  </>;
  const priceText = (plan: Plan) => plan.isCourtesy ? "Sem cobrança" : formatCurrency(plan.priceCents);

  const addingService = services.find((service) => service.id === addingServiceId);
  const addingUsed = visiblePeriods(addingService);
  const addingFull = !hiddenForNewPlan && addingUsed.length >= periods.length;
  const priceChanged = editing && !editing.plan.isCourtesy ? toCents(editPrice) !== editing.plan.priceCents : false;
  const sheetOpen = newServiceOpen || Boolean(addingServiceId) || Boolean(deleteTarget) || Boolean(editing) || Boolean(linkTarget);

  return <div className="plans">
    <div className="plans-toolbar">
      <p className="plans-summary">{services.length} {services.length === 1 ? "categoria" : "categorias"} · {services.reduce((sum, service) => sum + service.plans.length, 0)} planos</p>
      <button className="btn btn-primary" type="button" onClick={() => { resetPlanForm(); setError(""); setNewServiceOpen(true); }}><Icon name="plus" />Nova categoria</button>
    </div>
    <Feedback success={message} error={!sheetOpen ? error : ""} />

    {services.length ? services.map((service) => {
      const available = service.plans.filter((plan) => plan.active).length;
      const hiddenCount = service.plans.filter((plan) => plan.isHidden).length;
      return <section className="section-block plan-group" key={service.id} aria-labelledby={`service-${service.id}`}>
        <div className="section-head plan-group-head">
          <div>
            <h2 className="section-title" id={`service-${service.id}`}>{service.name}</h2>
            <p className="section-lead">{service.plans.length} {service.plans.length === 1 ? "plano" : "planos"}{service.plans.length ? ` · ${available} ${available === 1 ? "disponível" : "disponíveis"}` : ""}{hiddenCount ? ` · ${hiddenCount} ${hiddenCount === 1 ? "oculto" : "ocultos"}` : ""}</p>
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
              <thead><tr><th scope="col">Plano</th><th scope="col" className="num">Valor mensal</th><th scope="col">Pagamento</th><th scope="col" className="num">Alunos</th><th scope="col">Situação</th><th scope="col"><span className="visually-hidden">Ações</span></th></tr></thead>
              <tbody>{service.plans.map((plan) => <tr key={plan.id} data-paused={plan.active ? undefined : true} data-hidden-plan={plan.isHidden || undefined}>
                <td><span className="plan-period">{planTitle(plan)}{planPills(plan)}</span>{plan.isHidden && !plan.isCourtesy ? <span className="cell-secondary">{periodLabel(plan.period)}</span> : null}</td>
                <td className="num"><span className="plan-price">{priceText(plan)}</span></td>
                <td>{plan.isCourtesy ? <span className="cell-secondary">Não se aplica</span> : <><span className="cell-primary plan-methods">{methodsText(plan)}</span>{plan.automaticPixEnabled ? <span className="cell-secondary">Pix Automático</span> : null}</>}</td>
                <td className="num">{plan._count?.subscriptions ?? "—"}</td>
                <td>{statusPill(plan)}</td>
                <td><div className="plan-actions">
                  <button className="btn btn-quiet" type="button" onClick={() => openEdit(plan, service.name)} disabled={pending} aria-label={`Editar plano ${planFullName(plan, service.name)}`}>Editar</button>
                  <MenuButton label={`Mais ações do plano ${planTitle(plan)}`} items={planActions(plan, service)} />
                </div></td>
              </tr>)}</tbody>
            </table>
          </div>
          <ul className="data-rows responsive-rows plan-rows" aria-label={`Planos de ${service.name}`}>
            {service.plans.map((plan) => <li key={plan.id} data-paused={plan.active ? undefined : true}>
              <span className="row-title plan-period">{planTitle(plan)}{planPills(plan)}</span>
              {statusPill(plan)}
              <span className="row-meta">
                <span className="plan-price">{plan.isCourtesy ? "Sem cobrança" : `${formatCurrency(plan.priceCents)}/mês`}</span>
                {plan.isCourtesy ? null : <span>{plan.isHidden ? `${periodLabel(plan.period)} · ` : ""}{methodsText(plan)}{plan.automaticPixEnabled ? " + Pix Automático" : ""}</span>}
              </span>
              <span className="plan-row-count">{plan._count ? studentsText(plan._count.subscriptions) : null}</span>
              <div className="plan-row-actions">
                <button className="btn btn-quiet" type="button" onClick={() => openEdit(plan, service.name)} disabled={pending} aria-label={`Editar plano ${planFullName(plan, service.name)}`}>Editar</button>
                <MenuButton label={`Mais ações do plano ${planTitle(plan)}`} items={planActions(plan, service)} />
              </div>
            </li>)}
          </ul>
        </> : <p className="plan-empty">Esta categoria ainda não tem planos.</p>}
      </section>;
    }) : <div className="state-empty"><strong>Nenhuma categoria ainda.</strong><p>Crie a primeira categoria para começar a montar seus planos.</p></div>}

    {editing ? <Sheet open onClose={() => { setEditing(null); setError(""); }} title={planFullName(editing.plan, editing.serviceName)} className="sheet-wide">
      <form className="sheet-form" onSubmit={(event) => { event.preventDefault(); void saveEdit(); }}>
        {editing.plan.isHidden ? <p className="message" data-tone="info"><Icon name="info" /><span>{editing.plan.isCourtesy ? "Plano oculto de cortesia. Só o nome pode ser alterado." : "Plano oculto: não aparece para alunos nem leads."}</span></p> : null}
        <PlanFields idPrefix={`edit-plan-${editing.plan.id}`} hidden={editing.plan.isHidden} courtesy={editing.plan.isCourtesy} name={editName} onNameChange={setEditName} price={editPrice} onPriceChange={setEditPrice} selected={editMethods} onToggleMethod={(method) => setEditMethods((current) => toggle(current, method))} automaticPix={editAutomaticPix} onAutomaticPixChange={() => setEditAutomaticPix((current) => !current)} featured={editFeatured} onFeaturedChange={() => setEditFeatured((current) => !current)} autofocusPrice={!editing.plan.isCourtesy} />
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
        <PlanFields idPrefix="new-service-plan" visibility={newPlanVisibility(undefined)} hidden={hiddenForNewPlan} courtesy={hiddenForNewPlan && courtesyForNewPlan} name={nameForNewPlan} onNameChange={setNameForNewPlan} period={period} onPeriodChange={setPeriod} price={price} onPriceChange={setPrice} selected={methodsForNewPlan} onToggleMethod={(method) => setMethodsForNewPlan((current) => toggle(current, method))} automaticPix={automaticPixForNewPlan} onAutomaticPixChange={() => setAutomaticPixForNewPlan((current) => !current)} featured={featuredForNewPlan} onFeaturedChange={() => setFeaturedForNewPlan((current) => !current)} />
        <Feedback error={error} />
        <div className="btn-row btn-row-split sheet-actions">
          <button className="btn btn-quiet" type="button" onClick={() => { resetPlanForm(); setNewServiceOpen(false); setError(""); }} disabled={pending}>Cancelar</button>
          <button className="btn btn-primary" type="submit" disabled={pending} aria-busy={pending}>{pending ? "Salvando..." : "Criar categoria"}</button>
        </div>
      </form>
    </Sheet> : null}

    {addingService ? <Sheet open onClose={() => { resetPlanForm(); setError(""); }} title={`Novo plano em ${addingService.name}`} className="sheet-wide">
      <form className="sheet-form" onSubmit={(event) => { event.preventDefault(); void createPlan(addingService.id); }}>
        {addingFull ? <p className="message" data-tone="info"><Icon name="info" /><span>Esta categoria já tem plano público para todos os períodos. Edite um plano existente ou crie um plano oculto.</span></p> : null}
        <PlanFields idPrefix={`new-plan-${addingService.id}`} visibility={newPlanVisibility(addingService)} hidden={hiddenForNewPlan} courtesy={hiddenForNewPlan && courtesyForNewPlan} name={nameForNewPlan} onNameChange={setNameForNewPlan} period={period} onPeriodChange={setPeriod} usedPeriods={addingUsed} price={price} onPriceChange={setPrice} selected={methodsForNewPlan} onToggleMethod={(method) => setMethodsForNewPlan((current) => toggle(current, method))} automaticPix={automaticPixForNewPlan} onAutomaticPixChange={() => setAutomaticPixForNewPlan((current) => !current)} featured={featuredForNewPlan} onFeaturedChange={() => setFeaturedForNewPlan((current) => !current)} autofocusPrice />
        <Feedback error={error} />
        <div className="btn-row btn-row-split sheet-actions">
          <button className="btn btn-quiet" type="button" onClick={() => { resetPlanForm(); setError(""); }} disabled={pending}>Cancelar</button>
          <button className="btn btn-primary" type="submit" disabled={pending || addingFull} aria-busy={pending}>{pending ? "Salvando..." : "Adicionar"}</button>
        </div>
      </form>
    </Sheet> : null}

    {linkTarget ? <Sheet open onClose={() => { setLinkTarget(null); setError(""); }} title="Link de cadastro">
      <div className="sheet-form">
        <p className="message" data-tone="info"><Icon name="info" /><span>Link de uso único para <strong>{linkTarget.label}</strong>{linkTarget.plan.isCourtesy ? " (cortesia)" : ""}. A pessoa que se cadastrar por ele entra direto nesse plano. Gere um link para cada aluno.</span></p>
        {linkTarget.url ? <>
          <QrPanel value={linkTarget.url} label={`QR Code do link de cadastro de ${linkTarget.label}`} title="Peça para a pessoa escanear">
            <p>{linkTarget.plan.isCourtesy ? "Ela preenche os próprios dados e a cortesia é ativada na hora." : "Ela preenche os próprios dados e paga esta condição."}</p>
          </QrPanel>
          <div className="form-field"><span className="form-label">Link pronto para enviar</span><code className="code-box">{linkTarget.url}</code></div>
        </> : null}
        <Feedback error={error} />
        <span className="visually-hidden" aria-live="polite">{linkTarget.copied ? "Link copiado." : ""}</span>
        <div className="btn-row btn-row-split sheet-actions">
          <button className="btn btn-quiet" type="button" onClick={() => { setLinkTarget(null); setError(""); }} disabled={pending}>Fechar</button>
          {linkTarget.url
            ? <button className="btn btn-primary" type="button" onClick={copyLink}><Icon name={linkTarget.copied ? "check" : "copy"} />{linkTarget.copied ? "Link copiado" : "Copiar link"}</button>
            : <button className="btn btn-primary" type="button" onClick={generateLink} disabled={pending} aria-busy={pending}><Icon name="link" />{pending ? "Gerando..." : "Gerar link e QR Code"}</button>}
        </div>
      </div>
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
