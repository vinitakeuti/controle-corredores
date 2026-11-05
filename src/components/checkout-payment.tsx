"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Feedback } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
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

  const methodButton = (choice: CheckoutPaymentChoice, title: string, hint: string) => <button className="method-option" type="button" role="radio" aria-checked={method === choice} onClick={() => selectMethod(choice)}><strong>{title}</strong><span>{hint}</span></button>;
  const fieldSuffix = embedded ? "student" : "checkout";

  return (
    <section className={`payment ${embedded ? "payment-embedded" : ""}`}>
      {gatewayEnabled && activeProvider === "APPMAX" ? (
        <Script src="https://scripts.appmax.com.br/appmax.min.js" strategy="afterInteractive" onLoad={initializeAppmax} />
      ) : null}
      {!hideHeading && !embedded ? <div className="payment-head"><div><h2 className="section-title">Olá, {name.split(" ")[0]}.</h2><p className="section-lead">Escolha uma forma de pagamento para iniciar sua assinatura.</p></div><strong className="payment-amount">{formatCurrency(amountCents)}<small>/mês</small></strong></div> : null}
      {!hideHeading && embedded ? <div className="payment-head"><div><h2 className="section-title">Realizar pagamento</h2><p className="section-lead">Escolha o método para sua próxima mensalidade.</p></div><strong className="payment-amount">{formatCurrency(amountCents)}</strong></div> : null}

      {!gatewayEnabled ? <div className="message" data-tone="warning"><Icon name="alert" /><div><strong>Gateway aguardando ativação</strong><p>Um administrador precisa configurar e ativar um provedor de pagamentos para liberar o checkout.</p></div></div> : null}

      {!hideMethodSelector ? <div className="pay-methods" role="radiogroup" aria-label="Método de pagamento" data-tutorial-anchor="payment-methods">
        {availableMethods.includes("PIX") ? methodButton("PIX", "Pix", "pagamento único") : null}
        {automaticPixAvailable ? methodButton("PIX_AUTOMATIC", "Pix Automático", "autorização mensal") : null}
        {availableMethods.includes("BOLETO") ? methodButton("BOLETO", "Boleto", "pagamento único") : null}
        {availableMethods.includes("CARD") ? methodButton("CARD", "Cartão", activeProvider === "APPMAX" && recurrenceEnabled ? "cobrança mensal" : "pagamento único") : null}
      </div> : null}

      {availableChoices.length === 0 ? <div className="message" data-tone="warning"><Icon name="alert" /><div><strong>Nenhum método disponível</strong><p>Os métodos liberados para este aluno não são atendidos pelo gateway ativo. Fale com a assessoria.</p></div></div> : null}

      <span className="visually-hidden" aria-live="polite">{copied === "pix" ? "Código copiado." : copied === "boleto" ? "Linha copiada." : ""}</span>

      {method === "PIX" && availableMethods.includes("PIX") ? <div className="payment-body">
        <p>Gere o QR Code e conclua este pagamento no aplicativo do seu banco. Não haverá débitos automáticos.</p>
        <button className="btn btn-primary" type="button" onClick={() => submitPayment("PIX")} disabled={!paymentReady || loading} aria-busy={loading}>{loading ? "Gerando..." : result?.pix ? "Gerar novamente" : "Gerar Pix"}</button>
        {result?.pix ? <div className="payment-result" role="status">
          {result.pix.qrCode ? <img className="pix-qr" src={result.pix.qrCode} alt="QR Code do Pix" /> : null}
          <div className="form-field"><span className="form-label">Pix copia e cola</span><code className="code-box">{result.pix.copyPaste}</code></div>
          <button className="btn btn-secondary" type="button" onClick={() => copyText("pix", result.pix?.copyPaste ?? null)}><Icon name={copied === "pix" ? "check" : "copy"} />{copied === "pix" ? "Código copiado" : "Copiar código"}</button>
          <p className="field-hint">Válido até {formatDate(result.expiresAt)}. A liberação ocorre após a confirmação do {activeProvider === "ASAAS" ? "Asaas" : "Appmax"}.</p>
        </div> : null}
      </div> : null}

      {method === "PIX_AUTOMATIC" && automaticPixAvailable ? <div className="payment-body">
        <p>Autorize o Pix Automático para que as próximas cobranças deste plano sejam realizadas na data programada. Você poderá cancelar essa autorização no seu banco.</p>
        <button className="btn btn-primary" type="button" onClick={() => submitPayment("PIX", undefined, true)} disabled={!paymentReady || loading} aria-busy={loading}>{loading ? "Preparando..." : "Autorizar Pix Automático"}</button>
        {result?.pix ? <div className="payment-result" role="status">
          {result.pix.qrCode ? <img className="pix-qr" src={result.pix.qrCode} alt="QR Code para autorização do Pix Automático" /> : null}
          <div className="form-field"><span className="form-label">Pix copia e cola</span><code className="code-box">{result.pix.copyPaste}</code></div>
          <button className="btn btn-secondary" type="button" onClick={() => copyText("pix", result.pix?.copyPaste ?? null)}><Icon name={copied === "pix" ? "check" : "copy"} />{copied === "pix" ? "Código copiado" : "Copiar código"}</button>
          <p className="field-hint">Conclua a autorização no aplicativo do seu banco. A cobrança automática só começa após a confirmação do Asaas.</p>
        </div> : null}
      </div> : null}

      {method === "BOLETO" && availableMethods.includes("BOLETO") ? <div className="payment-body">
        <p>Gere o boleto e pague pelo aplicativo do banco ou em um ponto autorizado. Boleto não possui recorrência automática.</p>
        <button className="btn btn-primary" type="button" onClick={() => submitPayment("BOLETO")} disabled={!paymentReady || loading} aria-busy={loading}>{loading ? "Gerando..." : result?.boleto ? "Gerar novamente" : "Gerar boleto"}</button>
        {result?.boleto ? <div className="payment-result" role="status">
          {result.boleto.digitableLine ? <div className="form-field"><span className="form-label">Linha digitável</span><code className="code-box">{result.boleto.digitableLine}</code></div> : null}
          <div className="btn-row">
            {result.boleto.digitableLine ? <button className="btn btn-secondary" type="button" onClick={() => copyText("boleto", result.boleto?.digitableLine ?? null)}><Icon name={copied === "boleto" ? "check" : "copy"} />{copied === "boleto" ? "Linha copiada" : "Copiar linha"}</button> : null}
            {result.boleto.url ? <a className="btn btn-primary" href={result.boleto.url} target="_blank" rel="noopener noreferrer"><Icon name="file" />Abrir boleto<span className="visually-hidden"> (abre em nova aba)</span></a> : null}
          </div>
          <p className="field-hint">Vencimento em {formatDate(result.boleto.dueDate)}. A compensação pode levar até dois dias úteis.</p>
        </div> : null}
      </div> : null}

      {method === "CARD" && availableMethods.includes("CARD") && activeProvider !== "APPMAX" ? <div className="payment-body">
        <p>{activeProvider === "ASAAS" ? "Você será direcionado à Fatura Asaas para informar os dados do cartão em um ambiente seguro." : "O cartão será liberado assim que o gateway de pagamentos estiver ativo."}</p>
        {activeProvider === "ASAAS" && installmentLimit > 1 ? <div className="form-field"><label htmlFor={`card-installments-${fieldSuffix}`}>Parcelamento</label><select className="control" id={`card-installments-${fieldSuffix}`} value={installmentCount} onChange={(event) => { setInstallmentCount(Number(event.target.value)); setResult(null); setError(""); requestKeyRef.current = newRequestKey(); }}>{Array.from({ length: installmentLimit }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count}x de {formatCurrency(Math.floor(amountCents / count))}{count === 1 ? " à vista" : ""}</option>)}</select><p className="field-hint">Sem acréscimo pela Pace Lab. Eventuais condições do cartão são exibidas pelo Asaas.</p></div> : null}
        <button className="btn btn-primary" type="button" onClick={() => submitPayment("CARD")} disabled={!paymentReady || loading} aria-busy={loading}>{loading ? "Preparando..." : activeProvider === "ASAAS" ? "Continuar para o Asaas" : "Gateway indisponível"}</button>
        {result?.checkoutUrl ? <p className="field-hint">Se o redirecionamento não ocorrer, <a className="link" href={result.checkoutUrl}>abra a Fatura Asaas</a>.</p> : null}
      </div> : null}

      {method === "CARD" && availableMethods.includes("CARD") && activeProvider === "APPMAX" ? <form className="payment-body" method="POST" data-appmax-checkout onSubmit={() => {
        cardSubmissionRef.current = true;
        setError("");
        setResult(null);
        setLoading(true);
      }}>
        <p>{recurrenceEnabled ? "O cartão será tokenizado pela Appmax e usado nas próximas cobranças mensais." : "O cartão será tokenizado com segurança pela Appmax para este pagamento."}</p>
        <div className="form-field"><label htmlFor={`card-number-${fieldSuffix}`}>Número do cartão</label><input className="control" id={`card-number-${fieldSuffix}`} name="card-number" appmax-form-element="number" inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000" maxLength={19} required /></div>
        <div className="form-field"><label htmlFor={`card-name-${fieldSuffix}`}>Nome do titular</label><input className="control" id={`card-name-${fieldSuffix}`} name="card-holder-name" appmax-form-element="holder_name" value={holderName} onChange={(event) => setHolderName(event.target.value)} autoComplete="cc-name" maxLength={120} required /></div>
        <div className="card-expiry">
          <div className="form-field"><label htmlFor={`card-month-${fieldSuffix}`}>Mês</label><input className="control" id={`card-month-${fieldSuffix}`} name="card-expiration-month" appmax-form-element="expiration_month" inputMode="numeric" autoComplete="cc-exp-month" placeholder="MM" maxLength={2} required /></div>
          <div className="form-field"><label htmlFor={`card-year-${fieldSuffix}`}>Ano</label><input className="control" id={`card-year-${fieldSuffix}`} name="card-expiration-year" appmax-form-element="expiration_year" inputMode="numeric" autoComplete="cc-exp-year" placeholder="AA" maxLength={2} required /></div>
          <div className="form-field"><label htmlFor={`card-cvv-${fieldSuffix}`}>CVV</label><input className="control" id={`card-cvv-${fieldSuffix}`} name="card-cvv" appmax-form-element="cvv" type="password" inputMode="numeric" autoComplete="cc-csc" maxLength={4} required /></div>
        </div>
        <div className="form-field"><label htmlFor={`holder-cpf-${fieldSuffix}`}>CPF do titular</label><input className="control" id={`holder-cpf-${fieldSuffix}`} value={holderDocument} onChange={(event) => setHolderDocument(event.target.value)} inputMode="numeric" autoComplete="off" maxLength={14} required /></div>
        <button className="btn btn-primary btn-block" type="submit" disabled={!cardReady || loading} aria-busy={loading}>{loading ? "Processando..." : "Pagar com cartão"}</button>
        {!appmaxExternalId ? <p className="field-hint">Configure o identificador externo da Appmax para liberar a tokenização.</p> : null}
        {result && method === "CARD" ? <div className="message" data-tone={result.status === "PAID" ? "positive" : "info"} role="status"><Icon name={result.status === "PAID" ? "check" : "info"} /><div><strong>{result.status === "PAID" ? "Pagamento confirmado" : "Cartão enviado para análise"}</strong><p>{result.status === "PAID" ? "Sua assinatura já foi atualizada." : "A liberação ocorrerá após a aprovação antifraude da Appmax."}</p></div></div> : null}
      </form> : null}

      {gatewayEnabled && activeProvider === "APPMAX" && !appmaxReady ? <p className="field-hint" role="status">Preparando o ambiente seguro da Appmax...</p> : null}
      <Feedback error={error} />
      {recurrenceEnabled && activeProvider === "APPMAX" && method !== "BOLETO" ? <p className="field-hint">A recorrência depende da habilitação do recurso beta na conta Appmax.</p> : null}
    </section>
  );
}
