"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Feedback } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";

type Method = "PIX" | "CARD" | "BOLETO";
type Period = "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL";
type Plan = { id: string; period: Period; priceCents: number; allowedMethods: Method[]; automaticPixEnabled: boolean; name: string | null; isHidden: boolean; isCourtesy: boolean; service: { name: string } };

const periodLabel: Record<Period, string> = { MONTHLY: "Mensal", QUARTERLY: "Trimestral", SEMIANNUAL: "Semestral", ANNUAL: "Anual" };
const formatPrice = (value: number) => (value / 100).toFixed(2);
const formatMoney = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
const methodsLabel = (methods: Method[]) => methods.map((method) => method === "PIX" ? "Pix" : method === "CARD" ? "Cartão" : "Boleto").join(", ");
const planOption = (plan: Plan) => plan.isCourtesy ? `${plan.service.name} · ${plan.name} · Cortesia` : `${plan.service.name} · ${plan.name ? `${plan.name} · ` : ""}${periodLabel[plan.period]} · ${formatMoney(plan.priceCents)}/mês`;

export function StudentBillingControls({ studentId, initialPriceCents, initialPlanId, initialAllowedMethods, initialManualMonthlyBilling, initialIsCourtesy, automaticPixActive, hasCustomPrice, plans, canDelete, canManageCourtesy }: { studentId: string; initialPriceCents: number; initialPlanId: string | null; initialAllowedMethods: Method[]; initialManualMonthlyBilling: boolean; initialIsCourtesy: boolean; automaticPixActive: boolean; hasCustomPrice: boolean; plans: Plan[]; canDelete: boolean; canManageCourtesy: boolean }) {
  const router = useRouter();
  const [planId, setPlanId] = useState(initialPlanId ?? "");
  const [price, setPrice] = useState(formatPrice(initialPriceCents));
  const [manualMonthlyBilling, setManualMonthlyBilling] = useState(initialManualMonthlyBilling);
  const [isCourtesy, setIsCourtesy] = useState(initialIsCourtesy);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const selectedPlan = plans.find((plan) => plan.id === planId);
  const courtesyPlan = Boolean(selectedPlan?.isCourtesy);
  const publicPlans = plans.filter((plan) => !plan.isHidden);
  const hiddenPlans = plans.filter((plan) => plan.isHidden);
  const manualMonthlyAvailable = !courtesyPlan && (selectedPlan?.allowedMethods.includes("PIX") ?? initialAllowedMethods.includes("PIX"));
  const methods = manualMonthlyBilling ? ["PIX" as const] : selectedPlan?.allowedMethods ?? initialAllowedMethods;
  const showsCourtesy = isCourtesy || courtesyPlan;

  function selectPlan(nextPlanId: string) {
    const previous = plans.find((item) => item.id === planId);
    setPlanId(nextPlanId);
    const plan = plans.find((item) => item.id === nextPlanId);
    if (plan) {
      setPrice(plan.isCourtesy ? "" : formatPrice(plan.priceCents));
      if (!plan.allowedMethods.includes("PIX") || plan.isCourtesy) setManualMonthlyBilling(false);
      // Plano de cortesia liga a cortesia; sair dele a desliga.
      if (plan.isCourtesy) setIsCourtesy(true);
      else if (previous?.isCourtesy) setIsCourtesy(false);
    }
    setError(""); setMessage("");
  }

  async function save() {
    const priceCents = courtesyPlan ? 0 : Math.round(Number(price.replace(",", ".")) * 100);
    if (!planId || !Number.isInteger(priceCents) || (!courtesyPlan && priceCents < 100)) {
      setError("Selecione um plano e informe um valor válido.");
      return;
    }
    setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/students/${encodeURIComponent(studentId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId, ...(courtesyPlan ? {} : { priceCents, manualMonthlyBilling }), ...(canManageCourtesy ? { isCourtesy: showsCourtesy } : {}) }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Não foi possível atualizar a condição comercial."); return; }
      setMessage(showsCourtesy ? "Cortesia concedida. A assinatura foi aprovada sem registrar pagamento." : data.reauthorizationRequired ? "Plano e valor atualizados. O Pix Automático anterior foi cancelado; o aluno deverá autorizar um novo Pix no próximo pagamento." : "Plano e valor atualizados para os próximos pagamentos.");
      router.refresh();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/admin/students/${encodeURIComponent(studentId)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Não foi possível excluir o aluno."); return; }
      router.push("/admin/alunos");
      router.refresh();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setPending(false);
    }
  }

  const titleId = `billing-title-${studentId}`;

  return <section className="section-block billing-controls" aria-labelledby={titleId}>
    <div className="section-head">
      <div>
        <h2 className="section-title" id={titleId}>Plano e condição comercial</h2>
        <p className="section-lead">Escolha o plano do aluno e, se necessário, defina um valor exclusivo.</p>
      </div>
    </div>

    {hasCustomPrice || automaticPixActive ? <div className="message-stack billing-notices">
      {hasCustomPrice ? <div className="message" data-tone="info"><Icon name="info" /><div><strong>Valor exclusivo ativo</strong><p>O aluno verá este valor na área dele e não acompanhará reajustes do plano enquanto a condição estiver ativa.</p></div></div> : null}
      {automaticPixActive ? <div className="message" data-tone="warning"><Icon name="alert" /><div><strong>Pix Automático ativo</strong><p>Ao alterar plano ou valor, a autorização atual será cancelada e o aluno precisará consentir novamente.</p></div></div> : null}
    </div> : null}

    <div className="form-grid">
      <div className="form-field">
        <label htmlFor="student-plan">Plano</label>
        <select className="control" id="student-plan" value={planId} onChange={(event) => selectPlan(event.target.value)}>
          <option value="">Selecione um plano</option>
          {hiddenPlans.length ? <>
            <optgroup label="Planos públicos">{publicPlans.map((plan) => <option key={plan.id} value={plan.id}>{planOption(plan)}</option>)}</optgroup>
            <optgroup label="Planos ocultos (condição especial)">{hiddenPlans.map((plan) => <option key={plan.id} value={plan.id}>{planOption(plan)}</option>)}</optgroup>
          </> : plans.map((plan) => <option key={plan.id} value={plan.id}>{planOption(plan)}</option>)}
        </select>
      </div>
      <div className="form-field">
        <label htmlFor="student-price">Valor mensal exclusivo (R$)</label>
        <input className="control" id="student-price" type="number" min="1" max="100000" step="0.01" inputMode="decimal" value={courtesyPlan ? "" : price} onChange={(event) => setPrice(event.target.value)} disabled={courtesyPlan} placeholder={courtesyPlan ? "Cortesia, sem cobrança" : undefined} />
      </div>
    </div>
    {selectedPlan?.isHidden ? <p className="message" data-tone="info"><Icon name="info" /><span>{courtesyPlan ? "Plano oculto de cortesia: ao salvar, o aluno fica ativo sem cobrança." : "Plano oculto: o aluno paga esta condição, mas não consegue trocar de plano sozinho."}</span></p> : null}

    <div className="billing-options">
      {canManageCourtesy ? <label className="check"><input type="checkbox" checked={showsCourtesy} disabled={courtesyPlan} onChange={(event) => setIsCourtesy(event.target.checked)} /><span className="check-copy"><strong>Conceder cortesia</strong><small>Ativa este aluno sem cobrança ou pagamento registrado. Ao remover a cortesia, ele volta a aguardar pagamento.</small></span></label> : null}
      <label className="check"><input type="checkbox" checked={manualMonthlyBilling} disabled={!manualMonthlyAvailable && !manualMonthlyBilling} onChange={(event) => setManualMonthlyBilling(event.target.checked)} /><span className="check-copy"><strong>Cobrança mensal manual via Pix</strong><small>Em um plano trimestral, semestral ou anual, o aluno receberá uma cobrança avulsa em Pix pelo valor mensal, todos os meses. Pix Automático não será usado.</small>{!manualMonthlyAvailable ? <em>{courtesyPlan ? "Não se aplica à cortesia." : "Disponível apenas em planos que aceitam Pix."}</em> : null}</span></label>
    </div>

    <dl className="kv-list billing-methods">
      <div><dt>{showsCourtesy ? "Condição ativa" : manualMonthlyBilling ? "Método da cobrança mensal" : "Métodos deste plano"}</dt><dd>{showsCourtesy ? "Cortesia — sem cobrança" : methods.length ? methodsLabel(methods) : "Nenhum método configurado"}</dd></div>
    </dl>

    <Feedback success={message} error={error} />

    <div className="btn-row btn-row-split billing-actions">
      <button className="btn btn-primary" type="button" onClick={save} disabled={pending || !plans.length} aria-busy={pending}>{pending ? "Salvando..." : "Salvar condição comercial"}</button>
      {canDelete && !confirmDelete ? <button className="btn btn-danger" type="button" onClick={() => setConfirmDelete(true)} disabled={pending}><Icon name="trash" />Excluir aluno</button> : null}
    </div>
    {canDelete && confirmDelete ? <div className="message-stack billing-delete">
      <p className="message" data-tone="danger"><Icon name="alert" /><span>Excluir remove o cadastro, pagamentos e links abertos.</span></p>
      <div className="btn-row">
        <button className="btn btn-secondary" type="button" onClick={() => setConfirmDelete(false)} disabled={pending}>Cancelar</button>
        <button className="btn btn-danger-solid" type="button" onClick={remove} disabled={pending} aria-busy={pending}>Confirmar exclusão</button>
      </div>
    </div> : null}
  </section>;
}
