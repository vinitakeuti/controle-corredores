"use client";

import { useState } from "react";
import { CheckoutPayment, type CheckoutPaymentChoice } from "@/components/checkout-payment";
import { StudentPlanPicker } from "@/components/student-plan-picker";
import { formatCurrency } from "@/lib/format";

type Method = "PIX" | "BOLETO" | "CARD";
type Plan = {
  id: string;
  period: "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL";
  priceCents: number;
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
};

const periodLabel = {
  MONTHLY: "Mensal",
  QUARTERLY: "Trimestral",
  SEMIANNUAL: "Semestral",
  ANNUAL: "Anual",
};

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
}: Props) {
  const [stage, setStage] = useState<"plan" | "method" | "payment">("plan");
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(() => plans.find((plan) => plan.id === initialPlanId) ?? null);
  const automaticPixAvailable = activeProvider === "ASAAS" && allowedMethods.includes("PIX");
  const choices: Array<{ id: CheckoutPaymentChoice; title: string; description: string }> = [
    ...(allowedMethods.includes("PIX") ? [{ id: "PIX" as const, title: "Pix", description: "gere o QR Code para pagar agora" }] : []),
    ...(automaticPixAvailable ? [{ id: "PIX_AUTOMATIC" as const, title: "Pix Automático", description: "autorize as cobranças mensais no banco" }] : []),
    ...(allowedMethods.includes("CARD") ? [{ id: "CARD" as const, title: "Cartão", description: "pagamento em ambiente seguro" }] : []),
    ...(allowedMethods.includes("BOLETO") ? [{ id: "BOLETO" as const, title: "Boleto", description: "gere a linha digitável" }] : []),
  ];
  const [method, setMethod] = useState<CheckoutPaymentChoice | null>(choices[0]?.id ?? null);

  function continueWithPlan(plan: Plan) {
    setSelectedPlan(plan);
    setMethod(choices[0]?.id ?? null);
    setStage("method");
  }

  return (
    <section className="student-subscription-flow" data-tutorial-anchor="student-payment">
      <ol className="subscription-steps" aria-label="Etapas da assinatura">
        <li className={stage === "plan" ? "active" : "complete"}><span>1</span>Plano</li>
        <li className={stage === "method" ? "active" : stage === "payment" ? "complete" : ""}><span>2</span>Pagamento</li>
        <li className={stage === "payment" ? "active" : ""}><span>3</span>Concluir</li>
      </ol>

      {stage === "plan" ? <StudentPlanPicker plans={plans} currentPlanId={initialPlanId} confirmLabel="Prosseguir" onPlanSelected={continueWithPlan} /> : null}

      {stage === "method" && selectedPlan ? <div className="subscription-flow-stage">
        <div className="panel-heading">
          <div><p className="eyebrow">Etapa 2 de 3</p><h2>Como você prefere pagar?</h2><p>Selecione uma opção para continuar.</p></div>
        </div>
        <div className="selected-plan-summary"><div><small>Plano escolhido</small><strong>{selectedPlan.service.name} · {periodLabel[selectedPlan.period]}</strong></div><b>{formatCurrency(selectedPlan.priceCents)}<small>/mês</small></b></div>
        {choices.length ? <div className="subscription-method-options" role="radiogroup" aria-label="Método de pagamento">
          {choices.map((choice) => <button className={method === choice.id ? "active" : ""} type="button" role="radio" aria-checked={method === choice.id} key={choice.id} onClick={() => setMethod(choice.id)}><strong>{choice.title}</strong><span>{choice.description}</span></button>)}
        </div> : <div className="payment-configuration-notice"><strong>Nenhum método disponível</strong><p>Peça à assessoria para liberar uma forma de pagamento.</p></div>}
        <div className="creation-actions subscription-flow-actions"><button className="button button-quiet" type="button" onClick={() => setStage("plan")}>Voltar</button><button className="button button-dark" type="button" disabled={!method} onClick={() => setStage("payment")}>Prosseguir para pagamento</button></div>
      </div> : null}

      {stage === "payment" && selectedPlan && method ? <div className="subscription-flow-stage">
        <div className="subscription-flow-payment-heading"><div><p className="eyebrow">Etapa 3 de 3</p><h2>Conclua seu pagamento</h2><p>{selectedPlan.service.name} · {periodLabel[selectedPlan.period]} · {formatCurrency(selectedPlan.priceCents)} por mês</p></div></div>
        <button className="subscription-flow-change-method" type="button" onClick={() => setStage("method")}>← Trocar método de pagamento</button>
        <CheckoutPayment token={token} name={name} cpf={cpf} amountCents={selectedPlan.priceCents} gatewayEnabled={gatewayEnabled} activeProvider={activeProvider} appmaxExternalId={appmaxExternalId} recurrenceEnabled={recurrenceEnabled} allowedMethods={allowedMethods} embedded hideHeading hideMethodSelector initialMethod={method} />
      </div> : null}
    </section>
  );
}
