"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppmaxEnvironment, AppmaxIntegrationSummary } from "@/lib/appmax-integration";

type Props = {
  initialSummary: AppmaxIntegrationSummary;
  embedded?: boolean;
  onSummaryChange?: (summary: AppmaxIntegrationSummary) => void;
};

function emptyValues(summary: AppmaxIntegrationSummary) {
  const integration = summary.integration;
  return {
    environment: integration?.environment ?? "sandbox" as AppmaxEnvironment,
    clientId: "",
    clientSecret: "",
    externalId: integration?.externalId ?? "",
    appId: integration?.appId ?? "",
    softDescriptor: integration?.softDescriptor ?? "PACELAB",
    recurrenceEnabled: integration?.recurrenceEnabled ?? false,
  };
}

function environmentLabel(environment: AppmaxEnvironment) {
  return environment === "production" ? "Produção" : "Sandbox";
}

export function AppmaxIntegrationForm({ initialSummary, embedded = false, onSummaryChange }: Props) {
  const router = useRouter();
  const [summary, setSummary] = useState(initialSummary);
  const [values, setValues] = useState(() => emptyValues(initialSummary));
  const [editing, setEditing] = useState(!initialSummary.configured);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const updateValue = (key: keyof typeof values, value: string | boolean) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const startEditing = () => {
    setValues(emptyValues(summary));
    setFeedback(null);
    setConfirmDelete(false);
    setEditing(true);
  };

  const cancelEditing = () => {
    if (!summary.configured) return;
    setValues(emptyValues(summary));
    setFeedback(null);
    setEditing(false);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/admin/integrations/appmax", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(values),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Não foi possível salvar a integração.");
      const nextSummary = body as AppmaxIntegrationSummary;
      setSummary(nextSummary);
      setValues(emptyValues(nextSummary));
      onSummaryChange?.(nextSummary);
      setEditing(false);
      setFeedback({ type: "success", text: "Integração salva com segurança. O checkout já pode usar esta configuração." });
      router.refresh();
    } catch (error) {
      setFeedback({ type: "error", text: error instanceof Error ? error.message : "Não foi possível salvar a integração." });
    } finally {
      setPending(false);
    }
  };

  const remove = async () => {
    setPending(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/admin/integrations/appmax", { method: "DELETE", headers: { Accept: "application/json" } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Não foi possível excluir a integração.");
      const nextSummary: AppmaxIntegrationSummary = { configured: false, active: false, integration: null };
      setSummary(nextSummary);
      setValues(emptyValues(nextSummary));
      onSummaryChange?.(nextSummary);
      setEditing(true);
      setConfirmDelete(false);
      setFeedback({ type: "success", text: "Integração excluída. Os pagamentos Appmax foram desativados." });
      router.refresh();
    } catch (error) {
      setFeedback({ type: "error", text: error instanceof Error ? error.message : "Não foi possível excluir a integração." });
    } finally {
      setPending(false);
    }
  };

  const connected = summary.configured && summary.integration;

  return (
    <section className={`integration-workspace ${embedded ? "integration-form-embedded" : ""}`} aria-labelledby="appmax-title">
      {!embedded ? <div className="integration-workspace-header">
        <div className="integration-provider-mark" aria-hidden="true">AM</div>
        <div className="integration-provider-copy">
          <p className="eyebrow">Gateway de pagamentos</p>
          <h2 id="appmax-title">Appmax</h2>
          <p>Pix, boleto e cartão em um único checkout.</p>
        </div>
        <div className={`integration-status ${connected ? "is-connected" : "is-pending"}`}><span /> {connected ? (summary.active ? "Ativa" : "Configurada") : "Não configurada"}</div>
      </div> : null}

      {feedback ? <p className={`integration-feedback ${feedback.type}`} role="status">{feedback.text}</p> : null}

      {!editing && connected ? <>
        <div className="integration-summary-intro"><div><strong>{summary.active ? "Conexão ativa" : "Conexão configurada"}</strong><p>As credenciais ficam protegidas e nunca são exibidas novamente.</p></div><span className="integration-summary-environment">{environmentLabel(connected.environment)}</span></div>
        <dl className="integration-details">
          <div><dt>Client ID</dt><dd>{connected.clientIdMasked}</dd></div>
          <div><dt>External ID</dt><dd>{connected.externalId || "Não informado"}</dd></div>
          <div><dt>App ID</dt><dd>{connected.appId || "Não informado"}</dd></div>
          <div><dt>Recorrência</dt><dd>{connected.recurrenceEnabled ? "Habilitada" : "Desabilitada"}</dd></div>
          <div><dt>Soft descriptor</dt><dd>{connected.softDescriptor}</dd></div>
          <div><dt>Última atualização</dt><dd>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(connected.updatedAt))}</dd></div>
        </dl>
        <div className="integration-actions">
          <button className="button button-secondary" type="button" onClick={startEditing}>Editar configuração</button>
          {!confirmDelete ? <button className="button button-danger-quiet" type="button" onClick={() => setConfirmDelete(true)}>Excluir integração</button> : <div className="integration-delete-confirm"><span>Isso desativa o checkout Appmax imediatamente.</span><button className="button button-quiet" type="button" onClick={() => setConfirmDelete(false)}>Cancelar</button><button className="button button-danger" type="button" onClick={remove} disabled={pending}>Confirmar exclusão</button></div>}
        </div>
      </> : <form className="integration-form" onSubmit={submit}>
        <div className="integration-form-intro"><div><strong>{summary.configured ? "Atualizar conexão" : "Conecte a Appmax"}</strong><p>Use as credenciais do merchant. O Client Secret é criptografado antes de ser salvo.</p></div><span>01 / 02</span></div>

        <div className="integration-form-section">
          <div className="integration-section-heading"><span>01</span><div><h3>Ambiente</h3><p>Comece pelo sandbox para validar o checkout.</p></div></div>
          <div className="integration-environment-toggle" role="group" aria-label="Ambiente da Appmax">
            {(["sandbox", "production"] as AppmaxEnvironment[]).map((environment) => <button key={environment} type="button" className={values.environment === environment ? "active" : ""} onClick={() => updateValue("environment", environment)}><span>{environmentLabel(environment)}</span><small>{environment === "sandbox" ? "Testes sem cobrança real" : "Cobranças reais"}</small></button>)}
          </div>
        </div>

        <div className="integration-form-section">
          <div className="integration-section-heading"><span>02</span><div><h3>Credenciais do merchant</h3><p>Encontradas no painel da Appmax. O segredo não será mostrado depois.</p></div></div>
          <div className="integration-fields-grid">
            <div className="field"><label htmlFor="appmax-client-id">Client ID</label><input id="appmax-client-id" value={values.clientId} onChange={(event) => updateValue("clientId", event.target.value)} autoComplete="off" required={!connected} placeholder={connected ? "Deixe vazio para manter" : "Cole o Client ID"} /></div>
            <div className="field"><label htmlFor="appmax-client-secret">Client Secret</label><input id="appmax-client-secret" type="password" value={values.clientSecret} onChange={(event) => updateValue("clientSecret", event.target.value)} autoComplete="new-password" required={!connected} placeholder={connected ? "Deixe vazio para manter" : "Cole o Client Secret"} /></div>
            <div className="field"><label htmlFor="appmax-external-id">External ID <span>(Appmax JS)</span></label><input id="appmax-external-id" value={values.externalId} onChange={(event) => updateValue("externalId", event.target.value)} autoComplete="off" placeholder="Identificador da instalação" /></div>
            <div className="field"><label htmlFor="appmax-app-id">App ID <span>(opcional)</span></label><input id="appmax-app-id" value={values.appId} onChange={(event) => updateValue("appId", event.target.value)} autoComplete="off" placeholder="Validação do webhook" /></div>
          </div>
        </div>

        <div className="integration-form-section">
          <div className="integration-section-heading"><span>03</span><div><h3>Comportamento das cobranças</h3><p>A recorrência depende da liberação do recurso beta na sua conta Appmax.</p></div></div>
          <div className="integration-options-row">
            <label className="integration-checkbox"><input type="checkbox" checked={values.recurrenceEnabled} onChange={(event) => updateValue("recurrenceEnabled", event.target.checked)} /><span><strong>Ativar recorrência mensal</strong><small>Envia a assinatura para cartão e Pix quando habilitada.</small></span></label>
            <div className="field integration-descriptor-field"><label htmlFor="appmax-soft-descriptor">Soft descriptor</label><input id="appmax-soft-descriptor" value={values.softDescriptor} onChange={(event) => updateValue("softDescriptor", event.target.value)} maxLength={13} autoComplete="off" required /><small>Até 13 caracteres alfanuméricos.</small></div>
          </div>
        </div>

        <div className="integration-form-actions">
          {summary.configured ? <button className="button button-quiet" type="button" onClick={cancelEditing} disabled={pending}>Cancelar</button> : <span className="integration-form-note">Você poderá editar ou excluir esta conexão depois.</span>}
          <button className="button button-dark" type="submit" disabled={pending}>{pending ? "Salvando..." : summary.configured ? "Salvar alterações" : "Salvar integração"}</button>
        </div>
      </form>}
    </section>
  );
}
