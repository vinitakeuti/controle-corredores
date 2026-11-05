"use client";

import { useState } from "react";
import { CheckoutPayment, type CheckoutPaymentChoice } from "@/components/checkout-payment";
import { StudentPlanPicker } from "@/components/student-plan-picker";
import { Icon } from "@/components/ui/icon";
import { formatCurrency } from "@/lib/format";

type Method = "PIX" | "BOLETO" | "CARD";
type Plan = {
  id: string;
  period: "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL";
  priceCents: number;
  allowedMethods: Method[];
  automaticPixEnabled: boolean;
  isFeatured: boolean;
  service: { name: string };
};

type Props = {
  token?: string;
  plans: Plan[];
  initialPlanId: string | null;
  name: string;
  cpf: string;
  gatewayEnabled: boolean;
  activeProvider: "APPMAX" | "ASAAS" | null;
  appmaxExternalId: string | null;
  recurrenceEnabled: boolean;
  allowedMethods: Method[];
  automaticPixEnabled?: boolean;
  customPriceCents?: number | null;
  manualMonthlyBilling?: boolean;
  lockPlan?: boolean;
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
  initialPlanId,
  name,
  cpf,
  gatewayEnabled,
  activeProvider,
  appmaxExternalId,
  recurrenceEnabled,
  allowedMethods,
  automaticPixEnabled = false,
  customPriceCents = null,
  manualMonthlyBilling = false,
  lockPlan = false,
}: Props) {
  const [stage, setStage] = useState<"plan" | "method" | "payment">(() => lockPlan && Boolean(plans.find((plan) => plan.id === initialPlanId)) ? "method" : "plan");
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(() => plans.find((plan) => plan.id === initialPlanId) ?? null);
  const planMethods = manualMonthlyBilling ? allowedMethods : selectedPlan?.allowedMethods ?? allowedMethods;
  const selectedAutomaticPixEnabled = !manualMonthlyBilling && (selectedPlan?.automaticPixEnabled ?? automaticPixEnabled);
  const choices: Array<{ id: CheckoutPaymentChoice; title: string; description: string }> = paymentChoices(planMethods, activeProvider, selectedAutomaticPixEnabled).map((id) => ({
    id,
    title: id === "PIX" ? "Pix" : id === "PIX_AUTOMATIC" ? "Pix Automático" : id === "CARD" ? "Cartão" : "Boleto",
    description: id === "PIX" ? "gere o QR Code para pagar agora" : id === "PIX_AUTOMATIC" ? "autorize as cobranças do plano" : id === "CARD" ? "pagamento em ambiente seguro" : "gere a linha digitável",
  }));
  const [method, setMethod] = useState<CheckoutPaymentChoice | null>(choices[0]?.id ?? null);
  const selectedPriceCents = selectedPlan && selectedPlan.id === initialPlanId && customPriceCents !== null ? customPriceCents : selectedPlan?.priceCents ?? 0;
  const paymentMonths = manualMonthlyBilling ? 1 : selectedPlan ? periodMonths[selectedPlan.period] : 1;
  const chargeCents = selectedPriceCents * paymentMonths;

  function continueWithPlan(plan: Plan) {
    setSelectedPlan(plan);
    setMethod(paymentChoices(plan.allowedMethods, activeProvider, !manualMonthlyBilling && plan.automaticPixEnabled)[0] ?? null);
    setStage("method");
  }

  const steps = [
    { id: "plan", label: "Plano" },
    { id: "method", label: "Pagamento" },
    { id: "payment", label: "Concluir" },
  ] as const;
  const stageIndex = steps.findIndex((item) => item.id === stage);

  return (
    <section className="subscription-flow" data-tutorial-anchor="student-payment">
      <ol className="stepper" aria-label="Etapas da assinatura">
        {steps.map((item, index) => {
          const state = index === stageIndex ? "current" : index < stageIndex ? "done" : "todo";
          return <li className="stepper-item" data-state={state} key={item.id} aria-current={state === "current" ? "step" : undefined}><span><span className="stepper-index">{state === "done" ? <Icon name="check" className="icon-sm" /> : index + 1}</span>{item.label}</span></li>;
        })}
      </ol>
      {stage === "plan" ? <StudentPlanPicker plans={plans} currentPlanId={initialPlanId} confirmLabel="Prosseguir" onPlanSelected={continueWithPlan} /> : null}

      {stage === "method" && selectedPlan ? <div className="flow-stage">
        <div className="section-head"><div><h2 className="section-title">Como você prefere pagar?</h2><p className="section-lead">Selecione uma opção para continuar.</p></div></div>
        <dl className="summary-strip flow-summary">
          <div><dt>{manualMonthlyBilling ? "Cobrança mensal manual" : customPriceCents !== null ? "Condição exclusiva" : "Plano escolhido"}</dt><dd>{selectedPlan.service.name} · {periodLabel[selectedPlan.period]}</dd></div>
          <div><dt>{manualMonthlyBilling ? "Cobrança a cada mês" : selectedPlan.period === "MONTHLY" ? "Pagamento à vista" : `${formatCurrency(selectedPriceCents)} por mês · até ${periodMonths[selectedPlan.period]}x no cartão`}</dt><dd className="summary-figure">{formatCurrency(chargeCents)}</dd></div>
        </dl>
        {choices.length ? <div className="pay-methods pay-methods-stacked" role="radiogroup" aria-label="Método de pagamento">
          {choices.map((choice) => <button className="method-option" type="button" role="radio" aria-checked={method === choice.id} key={choice.id} onClick={() => setMethod(choice.id)}><strong>{choice.title}</strong><span>{choice.description}</span></button>)}
        </div> : <div className="message" data-tone="warning"><Icon name="alert" /><div><strong>Nenhum método disponível</strong><p>Peça à assessoria para liberar uma forma de pagamento.</p></div></div>}
        <div className="btn-row btn-row-split flow-actions">{lockPlan ? <span /> : <button className="btn btn-quiet" type="button" onClick={() => setStage("plan")}><Icon name="arrowLeft" />Voltar</button>}<button className="btn btn-primary" type="button" disabled={!method} onClick={() => setStage("payment")}>Prosseguir para pagamento<Icon name="arrowRight" /></button></div>
      </div> : null}

      {stage === "payment" && selectedPlan && method ? <div className="flow-stage">
        <div className="section-head"><div><h2 className="section-title">Conclua seu pagamento</h2><p className="section-lead">{selectedPlan.service.name} · {periodLabel[selectedPlan.period]} · {manualMonthlyBilling ? `Cobrança mensal de ${formatCurrency(chargeCents)}` : `Total de ${formatCurrency(chargeCents)}${selectedPlan.period === "MONTHLY" ? "" : ` (${formatCurrency(selectedPriceCents)} por mês)`}`}</p></div></div>
        <button className="btn btn-quiet flow-back" type="button" onClick={() => setStage("method")}><Icon name="arrowLeft" />Trocar método de pagamento</button>
        <CheckoutPayment token={token} name={name} cpf={cpf} amountCents={chargeCents} gatewayEnabled={gatewayEnabled} activeProvider={activeProvider} appmaxExternalId={appmaxExternalId} recurrenceEnabled={manualMonthlyBilling ? false : recurrenceEnabled} allowedMethods={planMethods} automaticPixEnabled={manualMonthlyBilling ? false : selectedPlan.automaticPixEnabled} installmentLimit={manualMonthlyBilling ? 1 : periodMonths[selectedPlan.period]} embedded hideHeading hideMethodSelector initialMethod={method} />
      </div> : null}
    </section>
  );
}
