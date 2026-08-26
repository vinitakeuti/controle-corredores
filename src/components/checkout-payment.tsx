"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatCurrency, formatDate } from "@/lib/format";

type Method = "PIX" | "BOLETO" | "CARD";
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
  gatewayEnabled: boolean;
  activeProvider: "APPMAX" | "ASAAS" | null;
  appmaxExternalId: string | null;
  recurrenceEnabled: boolean;
  allowedMethods: Method[];
  embedded?: boolean;
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
  gatewayEnabled,
  activeProvider,
  appmaxExternalId,
  recurrenceEnabled,
  allowedMethods,
  embedded = false,
}: CheckoutPaymentProps) {
  const router = useRouter();
  const endpoint = token
    ? `/api/checkout/${encodeURIComponent(token)}/payment`
    : "/api/payments";
  const [method, setMethod] = useState<Method>("PIX");
  const [customerIp, setCustomerIp] = useState("");
  const [appmaxReady, setAppmaxReady] = useState(false);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState("");
  const [holderName, setHolderName] = useState(name);
  const [holderDocument, setHolderDocument] = useState(cpf);
  const availableMethods = allowedMethods.filter((allowedMethod) => activeProvider === "APPMAX" || allowedMethod !== "BOLETO");
  const requestKeyRef = useRef(newRequestKey());
  const initializedRef = useRef(false);
  const cardSubmissionRef = useRef(false);
  const customerIpRef = useRef("");
  const holderNameRef = useRef(name);
  const holderDocumentRef = useRef(cpf);
  const submitPaymentRef = useRef<(method: Method, cardToken?: string) => Promise<void>>(async () => undefined);

  holderNameRef.current = holderName;
  holderDocumentRef.current = holderDocument;

  async function submitPayment(selectedMethod: Method, cardToken?: string) {
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
    if (!availableMethods.includes(method)) setMethod(availableMethods[0] ?? "PIX");
  }, [availableMethods, method]);

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

  function selectMethod(nextMethod: Method) {
    setMethod(nextMethod);
    setResult(null);
    setError("");
    requestKeyRef.current = newRequestKey();
  }

  const paymentReady = gatewayEnabled && (activeProvider === "ASAAS" || (appmaxReady && Boolean(customerIp)));
  const cardReady = paymentReady && Boolean(appmaxExternalId);

  return (
    <section className={`checkout-payment ${embedded ? "checkout-payment-embedded" : ""}`}>
      {gatewayEnabled && activeProvider === "APPMAX" ? (
        <Script src="https://scripts.appmax.com.br/appmax.min.js" strategy="afterInteractive" onLoad={initializeAppmax} />
      ) : null}
      {!embedded ? <div className="checkout-payment-heading"><div><p className="eyebrow">Pagamento</p><h2>Olá, {name.split(" ")[0]}.</h2><p>Escolha uma forma de pagamento para iniciar sua assinatura.</p></div><strong>{formatCurrency(amountCents)}<small>/mês</small></strong></div> : null}
      {embedded ? <div className="panel-heading payment-panel-heading"><div><h2>Realizar pagamento</h2><p>Escolha o método para sua próxima mensalidade.</p></div><strong>{formatCurrency(amountCents)}</strong></div> : null}

      {!gatewayEnabled ? <div className="payment-configuration-notice"><strong>Gateway aguardando ativação</strong><p>Um administrador precisa configurar e ativar um provedor de pagamentos para liberar o checkout.</p></div> : null}

      <div className={`checkout-methods ${activeProvider === "ASAAS" || availableMethods.length === 2 ? "two-methods" : ""}`} role="tablist" aria-label="Método de pagamento">
        {availableMethods.includes("PIX") ? <button className={method === "PIX" ? "active" : ""} type="button" role="tab" aria-selected={method === "PIX"} onClick={() => selectMethod("PIX")}>Pix<span>{activeProvider === "ASAAS" || recurrenceEnabled ? "automático mensal" : "pagamento único"}</span></button> : null}
        {availableMethods.includes("BOLETO") ? <button className={method === "BOLETO" ? "active" : ""} type="button" role="tab" aria-selected={method === "BOLETO"} onClick={() => selectMethod("BOLETO")}>Boleto<span>pagamento único</span></button> : null}
        {availableMethods.includes("CARD") ? <button className={method === "CARD" ? "active" : ""} type="button" role="tab" aria-selected={method === "CARD"} onClick={() => selectMethod("CARD")}>Cartão<span>{activeProvider === "APPMAX" && recurrenceEnabled ? "cobrança mensal" : "pagamento único"}</span></button> : null}
      </div>

      {availableMethods.length === 0 ? <div className="payment-configuration-notice"><strong>Nenhum método disponível</strong><p>Os métodos liberados para este aluno não são atendidos pelo gateway ativo. Fale com a assessoria.</p></div> : null}

      {method === "PIX" && availableMethods.includes("PIX") ? <div className="checkout-method-body">
        <p>{activeProvider === "ASAAS" || recurrenceEnabled ? "Pague o primeiro Pix para ativar a cobrança mensal automática." : "Gere o QR Code e conclua o pagamento no aplicativo do seu banco."}</p>
        <button className="button button-dark" type="button" onClick={() => submitPayment("PIX")} disabled={!paymentReady || loading}>{loading ? "Gerando..." : result?.pix ? "Gerar novamente" : "Gerar Pix"}</button>
        {result?.pix ? <div className="gateway-payment-result">
          {result.pix.qrCode ? <img className="pix-qr-code" src={result.pix.qrCode} alt="QR Code do Pix" /> : null}
          <div className="payment-code"><span>Pix copia e cola</span><code>{result.pix.copyPaste}</code></div>
          <button className="button button-secondary" type="button" onClick={() => copyText("pix", result.pix?.copyPaste ?? null)}>{copied === "pix" ? "Código copiado" : "Copiar código"}</button>
          <small>Válido até {formatDate(result.expiresAt)}. A liberação ocorre após a confirmação do {activeProvider === "ASAAS" ? "Asaas" : "Appmax"}.</small>
        </div> : null}
      </div> : null}

      {method === "BOLETO" && availableMethods.includes("BOLETO") && activeProvider === "APPMAX" ? <div className="checkout-method-body">
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

      {method === "CARD" && availableMethods.includes("CARD") && activeProvider === "ASAAS" ? <div className="checkout-method-body">
        <p>Você será direcionado à Fatura Asaas para informar os dados do cartão em um ambiente seguro.</p>
        <button className="button button-dark" type="button" onClick={() => submitPayment("CARD")} disabled={!paymentReady || loading}>{loading ? "Preparando..." : "Continuar para o Asaas"}</button>
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
      {recurrenceEnabled && method !== "BOLETO" ? <p className="checkout-note">A recorrência depende da habilitação do recurso beta na conta Appmax.</p> : null}
    </section>
  );
}
