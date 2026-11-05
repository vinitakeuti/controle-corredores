"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppmaxEnvironment, AppmaxIntegrationSummary } from "@/lib/appmax-integration";
import { Feedback } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { StatusPill } from "@/components/ui/status-pill";

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
    <section className="provider-form" aria-labelledby={embedded ? "integration-config-title" : "appmax-title"}>
      {!embedded ? <div className="section-head">
        <div><h2 className="section-title" id="appmax-title">Appmax</h2><p className="section-lead">Pix, boleto e cartão em um único checkout.</p></div>
        <StatusPill tone={connected ? (summary.active ? "positive" : "info") : "neutral"}>{connected ? (summary.active ? "Ativa" : "Configurada") : "Não configurada"}</StatusPill>
      </div> : null}

      <Feedback success={feedback?.type === "success" ? feedback.text : undefined} error={feedback?.type === "error" ? feedback.text : undefined} />

      {!editing && connected ? <>
        <div className="provider-summary-head"><div><strong>{summary.active ? "Conexão ativa" : "Conexão configurada"}</strong><p>As credenciais ficam protegidas e nunca são exibidas novamente.</p></div><StatusPill tone={connected.environment === "production" ? "warning" : "neutral"}>{environmentLabel(connected.environment)}</StatusPill></div>
        <dl className="dl-grid">
          <div><dt>Client ID</dt><dd>{connected.clientIdMasked}</dd></div>
          <div><dt>External ID</dt><dd>{connected.externalId || "Não informado"}</dd></div>
          <div><dt>App ID</dt><dd>{connected.appId || "Não informado"}</dd></div>
          <div><dt>Recorrência</dt><dd>{connected.recurrenceEnabled ? "Habilitada" : "Desabilitada"}</dd></div>
          <div><dt>Soft descriptor</dt><dd>{connected.softDescriptor}</dd></div>
          <div><dt>Última atualização</dt><dd>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Maceio" }).format(new Date(connected.updatedAt))}</dd></div>
        </dl>
        {!confirmDelete ? <div className="btn-row btn-row-split provider-actions">
          <button className="btn btn-secondary" type="button" onClick={startEditing}>Editar configuração</button>
          <button className="btn btn-danger" type="button" onClick={() => setConfirmDelete(true)}><Icon name="trash" />Excluir integração</button>
        </div> : <div className="message-stack provider-actions">
          <p className="message" data-tone="danger"><Icon name="alert" /><span>Isso desativa o checkout Appmax imediatamente.</span></p>
          <div className="btn-row"><button className="btn btn-secondary" type="button" onClick={() => setConfirmDelete(false)}>Cancelar</button><button className="btn btn-danger-solid" type="button" onClick={remove} disabled={pending} aria-busy={pending}>Confirmar exclusão</button></div>
        </div>}
      </> : <form className="provider-config" onSubmit={submit}>
        <div className="provider-summary-head"><div><strong>{summary.configured ? "Atualizar conexão" : "Conecte a Appmax"}</strong><p>Use as credenciais do merchant. O Client Secret é criptografado antes de ser salvo.</p></div></div>

        <fieldset className="provider-step">
          <legend className="section-title">Ambiente</legend>
          <p className="section-lead">Comece pelo sandbox para validar o checkout.</p>
          <div className="choice-toggle" role="group" aria-label="Ambiente da Appmax">
            {(["sandbox", "production"] as AppmaxEnvironment[]).map((environment) => <button key={environment} type="button" aria-pressed={values.environment === environment} onClick={() => updateValue("environment", environment)}><strong>{environmentLabel(environment)}</strong><small>{environment === "sandbox" ? "Testes sem cobrança real" : "Cobranças reais"}</small></button>)}
          </div>
        </fieldset>

        <fieldset className="provider-step">
          <legend className="section-title">Credenciais do merchant</legend>
          <p className="section-lead">Encontradas no painel da Appmax. O segredo não será mostrado depois.</p>
          <div className="form-grid">
            <div className="form-field"><label htmlFor="appmax-client-id">Client ID</label><input className="control" id="appmax-client-id" value={values.clientId} onChange={(event) => updateValue("clientId", event.target.value)} autoComplete="off" required={!connected} placeholder={connected ? "Deixe vazio para manter" : "Cole o Client ID"} /></div>
            <div className="form-field"><label htmlFor="appmax-client-secret">Client Secret</label><input className="control" id="appmax-client-secret" type="password" value={values.clientSecret} onChange={(event) => updateValue("clientSecret", event.target.value)} autoComplete="new-password" required={!connected} placeholder={connected ? "Deixe vazio para manter" : "Cole o Client Secret"} /></div>
            <div className="form-field"><label htmlFor="appmax-external-id">External ID <span className="optional-tag">(Appmax JS)</span></label><input className="control" id="appmax-external-id" value={values.externalId} onChange={(event) => updateValue("externalId", event.target.value)} autoComplete="off" placeholder="Identificador da instalação" /></div>
            <div className="form-field"><label htmlFor="appmax-app-id">App ID <span className="optional-tag">(opcional)</span></label><input className="control" id="appmax-app-id" value={values.appId} onChange={(event) => updateValue("appId", event.target.value)} autoComplete="off" placeholder="Validação do webhook" /></div>
          </div>
        </fieldset>

        <fieldset className="provider-step">
          <legend className="section-title">Comportamento das cobranças</legend>
          <p className="section-lead">A recorrência depende da liberação do recurso beta na sua conta Appmax.</p>
          <label className="check"><input type="checkbox" checked={values.recurrenceEnabled} onChange={(event) => updateValue("recurrenceEnabled", event.target.checked)} /><span className="check-copy"><strong>Ativar recorrência mensal</strong><small>Envia a assinatura para cartão e Pix quando habilitada.</small></span></label>
          <div className="form-field provider-short-field"><label htmlFor="appmax-soft-descriptor">Soft descriptor</label><input className="control" id="appmax-soft-descriptor" value={values.softDescriptor} onChange={(event) => updateValue("softDescriptor", event.target.value)} maxLength={13} autoComplete="off" required aria-describedby="appmax-soft-descriptor-hint" /><p className="field-hint" id="appmax-soft-descriptor-hint">Até 13 caracteres alfanuméricos.</p></div>
        </fieldset>

        <div className="btn-row btn-row-split provider-actions">
          {summary.configured ? <button className="btn btn-quiet" type="button" onClick={cancelEditing} disabled={pending}>Cancelar</button> : <span className="field-hint">Você poderá editar ou excluir esta conexão depois.</span>}
          <button className="btn btn-primary" type="submit" disabled={pending} aria-busy={pending}>{pending ? "Salvando..." : summary.configured ? "Salvar alterações" : "Salvar integração"}</button>
        </div>
      </form>}
    </section>
  );
}
