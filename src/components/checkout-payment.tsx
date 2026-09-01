"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatCurrency, formatDate } from "@/lib/format";

type Method = "PIX" | "BOLETO" | "CARD";
export type CheckoutPaymentChoice = Method | "PIX_AUTOMATIC";
type PaymentResult = {
  paymentId: string;
  provider: "APPMAX" | "ASAAS";
  status: "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "REFUNDED";
  providerStatus: string | null;
  recurringRequested: boolean;
  expiresAt: string | null;
  checkoutUrl: string | null;
  pix: { copyPaste: string | null; qrCode: string | null } | null;
  boleto: { url: string | null; digitableLine: string | null; dueDate: string | null } | null;
};

type AppmaxCallbackData = {
  ip?: string;
  token?: string;
};

declare global {
  interface Window {
    AppmaxScripts?: {
      init: (
        onSuccess: (data: AppmaxCallbackData) => void,
        onError: (error: unknown) => void,
        externalId?: string,
      ) => void;
    };
  }
}

type CheckoutPaymentProps = {
  token?: string;
  name: string;
  cpf: string;
  amountCents: number;
  subscriptionIds?: string[];
  gatewayEnabled: boolean;
  activeProvider: "APPMAX" | "ASAAS" | null;
  appmaxExternalId: string | null;
  recurrenceEnabled: boolean;
  allowedMethods: Method[];
  automaticPixEnabled?: boolean;
  installmentLimit?: number;
  embedded?: boolean;
  initialMethod?: CheckoutPaymentChoice;
  hideMethodSelector?: boolean;
  hideHeading?: boolean;
};

function newRequestKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export function CheckoutPayment({
  token,
  name,
  cpf,
  amountCents,
  subscriptionIds,
  gatewayEnabled,
  activeProvider,
  appmaxExternalId,
  recurrenceEnabled,
  allowedMethods,
  automaticPixEnabled = false,
  installmentLimit = 1,
  embedded = false,
  initialMethod,
  hideMethodSelector = false,
  hideHeading = false,
}: CheckoutPaymentProps) {
  const router = useRouter();
  const endpoint = token
    ? `/api/checkout/${encodeURIComponent(token)}/payment`
    : "/api/payments";
  const [method, setMethod] = useState<CheckoutPaymentChoice>(initialMethod ?? "PIX");
  const [customerIp, setCustomerIp] = useState("");
  const [appmaxReady, setAppmaxReady] = useState(false);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState("");
  const [holderName, setHolderName] = useState(name);
  const [holderDocument, setHolderDocument] = useState(cpf);
  const [installmentCount, setInstallmentCount] = useState(1);
  const availableMethods = allowedMethods;
  const automaticPixAvailable = activeProvider === "ASAAS" && automaticPixEnabled;
  const availableChoices: CheckoutPaymentChoice[] = [
    ...(availableMethods.includes("PIX") ? ["PIX" as const] : []),
    ...(automaticPixAvailable ? ["PIX_AUTOMATIC" as const] : []),
    ...(availableMethods.includes("CARD") ? ["CARD" as const] : []),
    ...(availableMethods.includes("BOLETO") ? ["BOLETO" as const] : []),
  ];
  const requestKeyRef = useRef(newRequestKey());
  const initializedRef = useRef(false);
  const cardSubmissionRef = useRef(false);
  const customerIpRef = useRef("");
  const holderNameRef = useRef(name);
  const holderDocumentRef = useRef(cpf);
  const submitPaymentRef = useRef<(method: Method, cardToken?: string) => Promise<void>>(async () => undefined);

  holderNameRef.current = holderName;
  holderDocumentRef.current = holderDocument;

  async function submitPayment(selectedMethod: Method, cardToken?: string, automaticPix = false) {
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: selectedMethod,
          expectedProvider: activeProvider,
          requestKey: requestKeyRef.current,
          customerIp: customerIpRef.current,
          cardToken,
          holderName: selectedMethod === "CARD" ? holderNameRef.current : undefined,
          holderDocumentNumber: selectedMethod === "CARD"
            ? holderDocumentRef.current.replace(/\D/g, "")
            : undefined,
          automaticPix,
          installmentCount: selectedMethod === "CARD" ? installmentCount : 1,
          subscriptionIds,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        // Em falhas de servidor a cobrança pode ter sido criada remotamente.
        // Reutilizar a chave permite ao backend recuperar a mesma tentativa.
        if (response.status < 500) requestKeyRef.current = newRequestKey();
        setError(data.error ?? "Não foi possível processar o pagamento.");
        return;
      }
      if (data.status !== "PENDING") requestKeyRef.current = newRequestKey();
      setResult(data);
      if (data.status === "PAID") router.refresh();
      if (data.provider === "ASAAS" && selectedMethod === "CARD" && data.checkoutUrl) {
        window.location.assign(data.checkoutUrl);
      }
    } catch {
      setError("Não foi possível conectar ao servidor. Tente novamente.");
    } finally {
      cardSubmissionRef.current = false;
      setLoading(false);
    }
  }
  submitPaymentRef.current = submitPayment;

  function initializeAppmax() {
    if (activeProvider !== "APPMAX" || !gatewayEnabled || initializedRef.current || !window.AppmaxScripts) return;
    initializedRef.current = true;
    const onSuccess = (data: AppmaxCallbackData) => {
      if (data.ip) {
        customerIpRef.current = data.ip;
        setCustomerIp(data.ip);
        setAppmaxReady(true);
      }
      if (data.token && cardSubmissionRef.current) {
        void submitPaymentRef.current("CARD", data.token);
      }
    };
    const onError = () => {
      cardSubmissionRef.current = false;
      setLoading(false);
      setError("Não foi possível preparar o pagamento seguro. Recarregue a página e tente novamente.");
    };
    if (appmaxExternalId) window.AppmaxScripts.init(onSuccess, onError, appmaxExternalId);
    else window.AppmaxScripts.init(onSuccess, onError);
  }

  useEffect(() => {
    if (activeProvider === "APPMAX" && window.AppmaxScripts) initializeAppmax();
  });

  useEffect(() => {
    if (!availableChoices.includes(method)) setMethod(availableChoices[0] ?? "PIX");
  }, [availableChoices, method]);

  useEffect(() => {
    if (!initialMethod) return;
    setMethod(initialMethod);
    setResult(null);
    setError("");
  }, [initialMethod]);

  useEffect(() => {
    if (!result || result.status !== "PENDING") return;
    let checks = 0;
    const interval = window.setInterval(async () => {
      checks += 1;
      if (checks > 30) {
        window.clearInterval(interval);
        return;
      }
      try {
        const response = await fetch(`/api/payments/${encodeURIComponent(result.paymentId)}/status`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = await response.json();
        if (data.status !== "PENDING") {
          setResult((current) => current ? { ...current, status: data.status } : current);
          window.clearInterval(interval);
          if (data.status === "PAID") router.refresh();
        }
      } catch {
        // O webhook continua sendo a fonte principal; polling é apenas apoio visual.
      }
    }, 6_000);
    return () => window.clearInterval(interval);
  }, [result?.paymentId, result?.status, router]);

  async function copyText(label: string, value: string | null) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 1800);
    } catch {
      setError("Não foi possível copiar automaticamente.");
    }
  }

  function selectMethod(nextMethod: CheckoutPaymentChoice) {
    setMethod(nextMethod);
    setResult(null);
    setError("");
    requestKeyRef.current = newRequestKey();
    if (nextMethod !== "CARD") setInstallmentCount(1);
  }

  const paymentReady = gatewayEnabled && (activeProvider === "ASAAS" || (appmaxReady && Boolean(customerIp)));
  const cardReady = paymentReady && Boolean(appmaxExternalId);

  return (
    <section className={`checkout-payment ${embedded ? "checkout-payment-embedded" : ""}`}>
      {gatewayEnabled && activeProvider === "APPMAX" ? (
        <Script src="https://scripts.appmax.com.br/appmax.min.js" strategy="afterInteractive" onLoad={initializeAppmax} />
      ) : null}
      {!hideHeading && !embedded ? <div className="checkout-payment-heading"><div><p className="eyebrow">Pagamento</p><h2>Olá, {name.split(" ")[0]}.</h2><p>Escolha uma forma de pagamento para iniciar sua assinatura.</p></div><strong>{formatCurrency(amountCents)}<small>/mês</small></strong></div> : null}
      {!hideHeading && embedded ? <div className="panel-heading payment-panel-heading"><div><h2>Realizar pagamento</h2><p>Escolha o método para sua próxima mensalidade.</p></div><strong>{formatCurrency(amountCents)}</strong></div> : null}

      {!gatewayEnabled ? <div className="payment-configuration-notice"><strong>Gateway aguardando ativação</strong><p>Um administrador precisa configurar e ativar um provedor de pagamentos para liberar o checkout.</p></div> : null}

      {!hideMethodSelector ? <div className={`checkout-methods ${availableChoices.length === 2 ? "two-methods" : ""} ${availableChoices.length === 4 ? "four-methods" : ""}`} role="tablist" aria-label="Método de pagamento" data-tutorial-anchor="payment-methods">
        {availableMethods.includes("PIX") ? <button className={method === "PIX" ? "active" : ""} type="button" role="tab" aria-selected={method === "PIX"} onClick={() => selectMethod("PIX")}>Pix<span>pagamento único</span></button> : null}
        {automaticPixAvailable ? <button className={method === "PIX_AUTOMATIC" ? "active" : ""} type="button" role="tab" aria-selected={method === "PIX_AUTOMATIC"} onClick={() => selectMethod("PIX_AUTOMATIC")}>Pix Automático<span>autorização mensal</span></button> : null}
        {availableMethods.includes("BOLETO") ? <button className={method === "BOLETO" ? "active" : ""} type="button" role="tab" aria-selected={method === "BOLETO"} onClick={() => selectMethod("BOLETO")}>Boleto<span>pagamento único</span></button> : null}
        {availableMethods.includes("CARD") ? <button className={method === "CARD" ? "active" : ""} type="button" role="tab" aria-selected={method === "CARD"} onClick={() => selectMethod("CARD")}>Cartão<span>{activeProvider === "APPMAX" && recurrenceEnabled ? "cobrança mensal" : "pagamento único"}</span></button> : null}
      </div> : null}

      {availableChoices.length === 0 ? <div className="payment-configuration-notice"><strong>Nenhum método disponível</strong><p>Os métodos liberados para este aluno não são atendidos pelo gateway ativo. Fale com a assessoria.</p></div> : null}

      {method === "PIX" && availableMethods.includes("PIX") ? <div className="checkout-method-body">
        <p>Gere o QR Code e conclua este pagamento no aplicativo do seu banco. Não haverá débitos automáticos.</p>
        <button className="button button-dark" type="button" onClick={() => submitPayment("PIX")} disabled={!paymentReady || loading}>{loading ? "Gerando..." : result?.pix ? "Gerar novamente" : "Gerar Pix"}</button>
        {result?.pix ? <div className="gateway-payment-result">
          {result.pix.qrCode ? <img className="pix-qr-code" src={result.pix.qrCode} alt="QR Code do Pix" /> : null}
          <div className="payment-code"><span>Pix copia e cola</span><code>{result.pix.copyPaste}</code></div>
          <button className="button button-secondary" type="button" onClick={() => copyText("pix", result.pix?.copyPaste ?? null)}>{copied === "pix" ? "Código copiado" : "Copiar código"}</button>
          <small>Válido até {formatDate(result.expiresAt)}. A liberação ocorre após a confirmação do {activeProvider === "ASAAS" ? "Asaas" : "Appmax"}.</small>
        </div> : null}
      </div> : null}

      {method === "PIX_AUTOMATIC" && automaticPixAvailable ? <div className="checkout-method-body">
        <p>Autorize o Pix Automático para que as próximas cobranças deste plano sejam realizadas na data programada. Você poderá cancelar essa autorização no seu banco.</p>
        <button className="button button-dark" type="button" onClick={() => submitPayment("PIX", undefined, true)} disabled={!paymentReady || loading}>{loading ? "Preparando..." : "Autorizar Pix Automático"}</button>
        {result?.pix ? <div className="gateway-payment-result">
          {result.pix.qrCode ? <img className="pix-qr-code" src={result.pix.qrCode} alt="QR Code para autorização do Pix Automático" /> : null}
          <div className="payment-code"><span>Pix copia e cola</span><code>{result.pix.copyPaste}</code></div>
          <button className="button button-secondary" type="button" onClick={() => copyText("pix", result.pix?.copyPaste ?? null)}>{copied === "pix" ? "Código copiado" : "Copiar código"}</button>
          <small>Conclua a autorização no aplicativo do seu banco. A cobrança automática só começa após a confirmação do Asaas.</small>
        </div> : null}
      </div> : null}

      {method === "BOLETO" && availableMethods.includes("BOLETO") ? <div className="checkout-method-body">
        <p>Gere o boleto e pague pelo aplicativo do banco ou em um ponto autorizado. Boleto não possui recorrência automática.</p>
        <button className="button button-dark" type="button" onClick={() => submitPayment("BOLETO")} disabled={!paymentReady || loading}>{loading ? "Gerando..." : result?.boleto ? "Gerar novamente" : "Gerar boleto"}</button>
        {result?.boleto ? <div className="gateway-payment-result">
          {result.boleto.digitableLine ? <div className="payment-code"><span>Linha digitável</span><code>{result.boleto.digitableLine}</code></div> : null}
          <div className="payment-result-actions">
            {result.boleto.digitableLine ? <button className="button button-secondary" type="button" onClick={() => copyText("boleto", result.boleto?.digitableLine ?? null)}>{copied === "boleto" ? "Linha copiada" : "Copiar linha"}</button> : null}
            {result.boleto.url ? <a className="button button-dark" href={result.boleto.url} target="_blank" rel="noopener noreferrer">Abrir boleto</a> : null}
          </div>
          <small>Vencimento em {formatDate(result.boleto.dueDate)}. A compensação pode levar até dois dias úteis.</small>
        </div> : null}
      </div> : null}

      {method === "CARD" && availableMethods.includes("CARD") && activeProvider !== "APPMAX" ? <div className="checkout-method-body">
        <p>{activeProvider === "ASAAS" ? "Você será direcionado à Fatura Asaas para informar os dados do cartão em um ambiente seguro." : "O cartão será liberado assim que o gateway de pagamentos estiver ativo."}</p>
        {activeProvider === "ASAAS" && installmentLimit > 1 ? <div className="field"><label htmlFor={`card-installments-${embedded ? "student" : "checkout"}`}>Parcelamento</label><select id={`card-installments-${embedded ? "student" : "checkout"}`} value={installmentCount} onChange={(event) => { setInstallmentCount(Number(event.target.value)); setResult(null); setError(""); requestKeyRef.current = newRequestKey(); }}>{Array.from({ length: installmentLimit }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count}x de {formatCurrency(Math.floor(amountCents / count))}{count === 1 ? " à vista" : ""}</option>)}</select><small>Sem acréscimo pela Pace Lab. Eventuais condições do cartão são exibidas pelo Asaas.</small></div> : null}
        <button className="button button-dark" type="button" onClick={() => submitPayment("CARD")} disabled={!paymentReady || loading}>{loading ? "Preparando..." : activeProvider === "ASAAS" ? "Continuar para o Asaas" : "Gateway indisponível"}</button>
        {result?.checkoutUrl ? <p className="checkout-note">Se o redirecionamento não ocorrer, <a href={result.checkoutUrl}>abra a Fatura Asaas</a>.</p> : null}
      </div> : null}

      {method === "CARD" && availableMethods.includes("CARD") && activeProvider === "APPMAX" ? <form className="checkout-method-body" method="POST" data-appmax-checkout onSubmit={() => {
        cardSubmissionRef.current = true;
        setError("");
        setResult(null);
        setLoading(true);
      }}>
        <p>{recurrenceEnabled ? "O cartão será tokenizado pela Appmax e usado nas próximas cobranças mensais." : "O cartão será tokenizado com segurança pela Appmax para este pagamento."}</p>
        <div className="field"><label htmlFor={`card-number-${embedded ? "student" : "checkout"}`}>Número do cartão</label><input id={`card-number-${embedded ? "student" : "checkout"}`} name="card-number" appmax-form-element="number" inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000" maxLength={19} required /></div>
        <div className="field"><label htmlFor={`card-name-${embedded ? "student" : "checkout"}`}>Nome do titular</label><input id={`card-name-${embedded ? "student" : "checkout"}`} name="card-holder-name" appmax-form-element="holder_name" value={holderName} onChange={(event) => setHolderName(event.target.value)} autoComplete="cc-name" maxLength={120} required /></div>
        <div className="checkout-form-grid card-expiration-grid">
          <div className="field"><label htmlFor={`card-month-${embedded ? "student" : "checkout"}`}>Mês</label><input id={`card-month-${embedded ? "student" : "checkout"}`} name="card-expiration-month" appmax-form-element="expiration_month" inputMode="numeric" autoComplete="cc-exp-month" placeholder="MM" maxLength={2} required /></div>
          <div className="field"><label htmlFor={`card-year-${embedded ? "student" : "checkout"}`}>Ano</label><input id={`card-year-${embedded ? "student" : "checkout"}`} name="card-expiration-year" appmax-form-element="expiration_year" inputMode="numeric" autoComplete="cc-exp-year" placeholder="AA" maxLength={2} required /></div>
          <div className="field"><label htmlFor={`card-cvv-${embedded ? "student" : "checkout"}`}>CVV</label><input id={`card-cvv-${embedded ? "student" : "checkout"}`} name="card-cvv" appmax-form-element="cvv" type="password" inputMode="numeric" autoComplete="cc-csc" maxLength={4} required /></div>
        </div>
        <div className="field"><label htmlFor={`holder-cpf-${embedded ? "student" : "checkout"}`}>CPF do titular</label><input id={`holder-cpf-${embedded ? "student" : "checkout"}`} value={holderDocument} onChange={(event) => setHolderDocument(event.target.value)} inputMode="numeric" autoComplete="off" maxLength={14} required /></div>
        <button className="button button-dark" type="submit" disabled={!cardReady || loading}>{loading ? "Processando..." : "Pagar com cartão"}</button>
        {!appmaxExternalId ? <p className="checkout-note">Configure o identificador externo da Appmax para liberar a tokenização.</p> : null}
        {result && method === "CARD" ? <div className={`card-payment-status ${result.status === "PAID" ? "success" : ""}`}><strong>{result.status === "PAID" ? "Pagamento confirmado" : "Cartão enviado para análise"}</strong><p>{result.status === "PAID" ? "Sua assinatura já foi atualizada." : "A liberação ocorrerá após a aprovação antifraude da Appmax."}</p></div> : null}
      </form> : null}

      {gatewayEnabled && activeProvider === "APPMAX" && !appmaxReady ? <p className="checkout-note">Preparando o ambiente seguro da Appmax...</p> : null}
      {error ? <p className="error-message checkout-error">{error}</p> : null}
      {recurrenceEnabled && activeProvider === "APPMAX" && method !== "BOLETO" ? <p className="checkout-note">A recorrência depende da habilitação do recurso beta na conta Appmax.</p> : null}
    </section>
  );
}
