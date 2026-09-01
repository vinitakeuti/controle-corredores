"use client";

import { useState } from "react";
import { CheckoutPayment, type CheckoutPaymentChoice } from "@/components/checkout-payment";
import { StudentPlanPicker, type StudentPlan } from "@/components/student-plan-picker";
import { formatCurrency } from "@/lib/format";

type Method = "PIX" | "BOLETO" | "CARD";
type Plan = StudentPlan;

type Props = {
  token?: string;
  plans: Plan[];
  initialPlanIds?: string[];
  name: string;
  cpf: string;
  gatewayEnabled: boolean;
  activeProvider: "APPMAX" | "ASAAS" | null;
  appmaxExternalId: string | null;
  recurrenceEnabled: boolean;
  allowedMethods: Method[];
  automaticPixEnabled?: boolean;
};

const periodLabel = {
  MONTHLY: "Mensal",
  QUARTERLY: "Trimestral",
  SEMIANNUAL: "Semestral",
  ANNUAL: "Anual",
};

const periodMonths = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMIANNUAL: 6,
  ANNUAL: 12,
};

function paymentChoices(methods: Method[], provider: "APPMAX" | "ASAAS" | null, automaticPixEnabled: boolean): CheckoutPaymentChoice[] {
  return [
    ...(methods.includes("PIX") ? ["PIX" as const] : []),
    ...(provider === "ASAAS" && automaticPixEnabled ? ["PIX_AUTOMATIC" as const] : []),
    ...(methods.includes("CARD") ? ["CARD" as const] : []),
    ...(methods.includes("BOLETO") ? ["BOLETO" as const] : []),
  ];
}

export function StudentSubscriptionFlow({
  token,
  plans,
  initialPlanIds = [],
  name,
  cpf,
  gatewayEnabled,
  activeProvider,
  appmaxExternalId,
  recurrenceEnabled,
  allowedMethods,
  automaticPixEnabled = false,
}: Props) {
  const [stage, setStage] = useState<"plan" | "method" | "payment">("plan");
  const [selectedPlans, setSelectedPlans] = useState<Plan[]>(() => plans.filter((plan) => initialPlanIds.includes(plan.id)));
  const planMethods = selectedPlans.reduce<Method[]>((methods, plan, index) => index === 0 ? plan.allowedMethods : methods.filter((method) => plan.allowedMethods.includes(method)), selectedPlans.length ? [] : allowedMethods);
  const selectedAutomaticPixEnabled = selectedPlans.length === 1 && (selectedPlans[0]?.automaticPixEnabled ?? automaticPixEnabled);
  const totalCents = selectedPlans.reduce((total, plan) => total + plan.priceCents * periodMonths[plan.period], 0);
  const installmentLimit = Math.max(1, ...selectedPlans.map((plan) => periodMonths[plan.period]));
  const choices: Array<{ id: CheckoutPaymentChoice; title: string; description: string }> = paymentChoices(planMethods, activeProvider, selectedAutomaticPixEnabled).map((id) => ({
    id,
    title: id === "PIX" ? "Pix" : id === "PIX_AUTOMATIC" ? "Pix Automático" : id === "CARD" ? "Cartão" : "Boleto",
    description: id === "PIX" ? "gere o QR Code para pagar agora" : id === "PIX_AUTOMATIC" ? "autorize as cobranças do plano" : id === "CARD" ? "pagamento em ambiente seguro" : "gere a linha digitável",
  }));
  const [method, setMethod] = useState<CheckoutPaymentChoice | null>(choices[0]?.id ?? null);

  function continueWithPlans(nextPlans: Plan[]) {
    setSelectedPlans(nextPlans);
    const common = nextPlans.reduce<Method[]>((methods, plan, index) => index === 0 ? plan.allowedMethods : methods.filter((item) => plan.allowedMethods.includes(item)), []);
    setMethod(paymentChoices(common, activeProvider, nextPlans.length === 1 && nextPlans[0].automaticPixEnabled)[0] ?? null);
    setStage("method");
  }

  return (
    <section className="student-subscription-flow" data-tutorial-anchor="student-payment">
      <ol className="subscription-steps" aria-label="Etapas da assinatura">
        <li className={stage === "plan" ? "active" : "complete"}><span>1</span>Plano</li>
        <li className={stage === "method" ? "active" : stage === "payment" ? "complete" : ""}><span>2</span>Pagamento</li>
        <li className={stage === "payment" ? "active" : ""}><span>3</span>Concluir</li>
      </ol>

      {stage === "plan" ? <StudentPlanPicker plans={plans} currentPlanIds={initialPlanIds} confirmLabel="Prosseguir" onPlansSelected={continueWithPlans} /> : null}

      {stage === "method" && selectedPlans.length ? <div className="subscription-flow-stage">
        <div className="panel-heading">
          <div><p className="eyebrow">Etapa 2 de 3</p><h2>Como você prefere pagar?</h2><p>Selecione uma opção para continuar.</p></div>
        </div>
        <div className="selected-plan-summary"><div><small>{selectedPlans.length === 1 ? "Plano escolhido" : "Produtos escolhidos"}</small><strong>{selectedPlans.map((plan) => `${plan.service.name} · ${periodLabel[plan.period]}`).join(" + ")}</strong></div><b>{formatCurrency(totalCents)}<small>{installmentLimit === 1 ? " à vista" : ` em até ${installmentLimit}x`}</small></b></div>
        {choices.length ? <div className="subscription-method-options" role="radiogroup" aria-label="Método de pagamento">
          {choices.map((choice) => <button className={method === choice.id ? "active" : ""} type="button" role="radio" aria-checked={method === choice.id} key={choice.id} onClick={() => setMethod(choice.id)}><strong>{choice.title}</strong><span>{choice.description}</span></button>)}
        </div> : <div className="payment-configuration-notice"><strong>Nenhum método disponível</strong><p>Peça à assessoria para liberar uma forma de pagamento.</p></div>}
        <div className="creation-actions subscription-flow-actions"><button className="button button-quiet" type="button" onClick={() => setStage("plan")}>Voltar</button><button className="button button-dark" type="button" disabled={!method} onClick={() => setStage("payment")}>Prosseguir para pagamento</button></div>
      </div> : null}

      {stage === "payment" && selectedPlans.length && method ? <div className="subscription-flow-stage">
        <div className="subscription-flow-payment-heading"><div><p className="eyebrow">Etapa 3 de 3</p><h2>Conclua seu pagamento</h2><p>{selectedPlans.map((plan) => `${plan.service.name} · ${periodLabel[plan.period]}`).join(" + ")} · {formatCurrency(totalCents)}</p></div></div>
        <button className="subscription-flow-change-method" type="button" onClick={() => setStage("method")}>← Trocar método de pagamento</button>
        <CheckoutPayment token={token} name={name} cpf={cpf} amountCents={totalCents} subscriptionIds={selectedPlans.map((plan) => plan.id)} gatewayEnabled={gatewayEnabled} activeProvider={activeProvider} appmaxExternalId={appmaxExternalId} recurrenceEnabled={recurrenceEnabled} allowedMethods={planMethods} automaticPixEnabled={selectedAutomaticPixEnabled} installmentLimit={installmentLimit} embedded hideHeading hideMethodSelector initialMethod={method} />
      </div> : null}
    </section>
  );
}
