"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Feedback } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";

type Method = "PIX" | "CARD" | "BOLETO";
type Period = "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL";
type Plan = { id: string; period: Period; priceCents: number; allowedMethods: Method[]; automaticPixEnabled: boolean; service: { name: string } };

const periodLabel: Record<Period, string> = { MONTHLY: "Mensal", QUARTERLY: "Trimestral", SEMIANNUAL: "Semestral", ANNUAL: "Anual" };
const formatPrice = (value: number) => (value / 100).toFixed(2);
const methodsLabel = (methods: Method[]) => methods.map((method) => method === "PIX" ? "Pix" : method === "CARD" ? "Cartão" : "Boleto").join(", ");

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
  const manualMonthlyAvailable = selectedPlan?.allowedMethods.includes("PIX") ?? initialAllowedMethods.includes("PIX");
  const methods = manualMonthlyBilling ? ["PIX" as const] : selectedPlan?.allowedMethods ?? initialAllowedMethods;

  function selectPlan(nextPlanId: string) {
    setPlanId(nextPlanId);
    const plan = plans.find((item) => item.id === nextPlanId);
    if (plan) {
      setPrice(formatPrice(plan.priceCents));
      if (!plan.allowedMethods.includes("PIX")) setManualMonthlyBilling(false);
    }
    setError(""); setMessage("");
  }

  async function save() {
    const priceCents = Math.round(Number(price.replace(",", ".")) * 100);
    if (!planId || !Number.isInteger(priceCents) || priceCents < 100) {
      setError("Selecione um plano e informe um valor válido.");
      return;
    }
    setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/students/${encodeURIComponent(studentId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId, priceCents, manualMonthlyBilling, ...(canManageCourtesy ? { isCourtesy } : {}) }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Não foi possível atualizar a condição comercial."); return; }
      setMessage(isCourtesy ? "Cortesia concedida. A assinatura foi aprovada sem registrar pagamento." : data.reauthorizationRequired ? "Plano e valor atualizados. O Pix Automático anterior foi cancelado; o aluno deverá autorizar um novo Pix no próximo pagamento." : "Plano e valor atualizados para os próximos pagamentos.");
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
          {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.service.name} · {periodLabel[plan.period]} · R$ {formatPrice(plan.priceCents)}/mês</option>)}
        </select>
      </div>
      <div className="form-field">
        <label htmlFor="student-price">Valor mensal exclusivo (R$)</label>
        <input className="control" id="student-price" type="number" min="1" max="100000" step="0.01" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} />
      </div>
    </div>

    <div className="billing-options">
      {canManageCourtesy ? <label className="check"><input type="checkbox" checked={isCourtesy} onChange={(event) => setIsCourtesy(event.target.checked)} /><span className="check-copy"><strong>Conceder cortesia</strong><small>Ativa este aluno sem cobrança ou pagamento registrado. Ao remover a cortesia, ele volta a aguardar pagamento.</small></span></label> : null}
      <label className="check"><input type="checkbox" checked={manualMonthlyBilling} disabled={!manualMonthlyAvailable && !manualMonthlyBilling} onChange={(event) => setManualMonthlyBilling(event.target.checked)} /><span className="check-copy"><strong>Cobrança mensal manual via Pix</strong><small>Em um plano trimestral, semestral ou anual, o aluno receberá uma cobrança avulsa em Pix pelo valor mensal, todos os meses. Pix Automático não será usado.</small>{!manualMonthlyAvailable ? <em>Disponível apenas em planos que aceitam Pix.</em> : null}</span></label>
    </div>

    <dl className="kv-list billing-methods">
      <div><dt>{isCourtesy ? "Condição ativa" : manualMonthlyBilling ? "Método da cobrança mensal" : "Métodos deste plano"}</dt><dd>{isCourtesy ? "Cortesia — sem cobrança" : methods.length ? methodsLabel(methods) : "Nenhum método configurado"}</dd></div>
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
