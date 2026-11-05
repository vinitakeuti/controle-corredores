"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { AsaasEnvironment, AsaasIntegrationSummary } from "@/lib/asaas-integration";
import { Feedback } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { StatusPill } from "@/components/ui/status-pill";

type Props = {
  initialSummary: AsaasIntegrationSummary;
  embedded?: boolean;
  onSummaryChange?: (summary: AsaasIntegrationSummary) => void;
};

function emptyValues(summary: AsaasIntegrationSummary) {
  return {
    environment: summary.integration?.environment ?? "sandbox" as AsaasEnvironment,
    apiKey: "",
    webhookToken: "",
  };
}

function environmentLabel(environment: AsaasEnvironment) {
  return environment === "production" ? "Produção" : "Sandbox";
}

export function AsaasIntegrationForm({ initialSummary, embedded = false, onSummaryChange }: Props) {
  const router = useRouter();
  const [summary, setSummary] = useState(initialSummary);
  const [values, setValues] = useState(() => emptyValues(initialSummary));
  const [editing, setEditing] = useState(!initialSummary.configured);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const updateValue = (key: keyof typeof values, value: string) => {
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
      const response = await fetch("/api/admin/integrations/asaas", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(values),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof body.error === "string" ? body.error : "Não foi possível salvar a integração.");
      }
      const nextSummary = body as AsaasIntegrationSummary;
      setSummary(nextSummary);
      setValues(emptyValues(nextSummary));
      onSummaryChange?.(nextSummary);
      setEditing(false);
      setFeedback({ type: "success", text: "Integração salva com segurança. O Asaas está pronto para receber cobranças." });
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
      const response = await fetch("/api/admin/integrations/asaas", {
        method: "DELETE",
        headers: { Accept: "application/json" },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof body.error === "string" ? body.error : "Não foi possível excluir a integração.");
      }
      const nextSummary: AsaasIntegrationSummary = { configured: false, active: false, integration: null };
      setSummary(nextSummary);
      setValues(emptyValues(nextSummary));
      onSummaryChange?.(nextSummary);
      setEditing(true);
      setConfirmDelete(false);
      setFeedback({ type: "success", text: "Integração excluída. Os pagamentos Asaas foram desativados." });
      router.refresh();
    } catch (error) {
      setFeedback({ type: "error", text: error instanceof Error ? error.message : "Não foi possível excluir a integração." });
    } finally {
      setPending(false);
    }
  };

  const connected = summary.configured && summary.integration;

  return (
    <section className="provider-form" aria-labelledby={embedded ? "integration-config-title" : "asaas-title"}>
      {!embedded ? <div className="section-head">
        <div><h2 className="section-title" id="asaas-title">Asaas</h2><p className="section-lead">Pix e cartão em um único checkout.</p></div>
        <StatusPill tone={connected ? (summary.active ? "positive" : "info") : "neutral"}>{connected ? (summary.active ? "Ativa" : "Configurada") : "Não configurada"}</StatusPill>
      </div> : null}

      <Feedback success={feedback?.type === "success" ? feedback.text : undefined} error={feedback?.type === "error" ? feedback.text : undefined} />

      {!editing && connected ? <>
        <div className="provider-summary-head"><div><strong>{summary.active ? "Conexão ativa" : "Conexão configurada"}</strong><p>A chave da API fica criptografada e os segredos nunca são exibidos novamente.</p></div><StatusPill tone={connected.environment === "production" ? "warning" : "neutral"}>{environmentLabel(connected.environment)}</StatusPill></div>
        <dl className="dl-grid">
          <div><dt>Chave da API</dt><dd>{connected.apiKeyMasked}</dd></div>
          <div><dt>Token do webhook</dt><dd>{connected.webhookTokenConfigured ? "Configurado" : "Não configurado"}</dd></div>
          <div><dt>Endpoint do webhook</dt><dd><code>/api/webhooks/asaas</code></dd></div>
          <div><dt>Header de autenticação</dt><dd><code>asaas-access-token</code></dd></div>
          <div><dt>Última atualização</dt><dd>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Maceio" }).format(new Date(connected.updatedAt))}</dd></div>
        </dl>
        {!confirmDelete ? <div className="btn-row btn-row-split provider-actions">
          <button className="btn btn-secondary" type="button" onClick={startEditing}>Editar configuração</button>
          <button className="btn btn-danger" type="button" onClick={() => setConfirmDelete(true)}><Icon name="trash" />Excluir integração</button>
        </div> : <div className="message-stack provider-actions">
          <p className="message" data-tone="danger"><Icon name="alert" /><span>Isso desativa o checkout Asaas imediatamente.</span></p>
          <div className="btn-row"><button className="btn btn-secondary" type="button" onClick={() => setConfirmDelete(false)}>Cancelar</button><button className="btn btn-danger-solid" type="button" onClick={remove} disabled={pending} aria-busy={pending}>Confirmar exclusão</button></div>
        </div>}
      </> : <form className="provider-config" onSubmit={submit}>
        <div className="provider-summary-head"><div><strong>{summary.configured ? "Atualizar conexão" : "Conecte o Asaas"}</strong><p>A chave da API será criptografada e o token do webhook será armazenado somente como hash.</p></div></div>

        <fieldset className="provider-step">
          <legend className="section-title">Ambiente</legend>
          <p className="section-lead">Comece pelo sandbox para validar o checkout.</p>
          <div className="choice-toggle" role="group" aria-label="Ambiente do Asaas">
            {(["sandbox", "production"] as AsaasEnvironment[]).map((environment) => <button key={environment} type="button" aria-pressed={values.environment === environment} onClick={() => updateValue("environment", environment)}><strong>{environmentLabel(environment)}</strong><small>{environment === "sandbox" ? "Testes sem cobrança real" : "Cobranças reais"}</small></button>)}
          </div>
        </fieldset>

        <fieldset className="provider-step">
          <legend className="section-title">Chave da API</legend>
          <p className="section-lead">Copie a chave do ambiente correspondente no painel do Asaas.</p>
          <div className="form-field"><label htmlFor="asaas-api-key">API key</label><input className="control" id="asaas-api-key" type="password" value={values.apiKey} onChange={(event) => updateValue("apiKey", event.target.value)} autoComplete="new-password" required={!connected} placeholder={connected ? "Deixe vazio para manter" : values.environment === "sandbox" ? "$aact_hmlg_..." : "$aact_prod_..."} /></div>
        </fieldset>

        <fieldset className="provider-step">
          <legend className="section-title">Autenticação do webhook</legend>
          <p className="section-lead">Cadastre o endpoint <code>/api/webhooks/asaas</code> no Asaas e envie este mesmo valor no header <code>asaas-access-token</code>.</p>
          <div className="form-field"><label htmlFor="asaas-webhook-token">Token do webhook</label><input className="control" id="asaas-webhook-token" type="password" value={values.webhookToken} onChange={(event) => updateValue("webhookToken", event.target.value)} autoComplete="new-password" required={!connected} minLength={values.webhookToken ? 32 : undefined} maxLength={255} pattern={"\\S+"} placeholder={connected ? "Deixe vazio para manter" : "Crie um token secreto"} aria-describedby="asaas-webhook-token-hint" /><p className="field-hint" id="asaas-webhook-token-hint">Use de 32 a 255 caracteres, sem espaços.</p></div>
        </fieldset>

        <div className="btn-row btn-row-split provider-actions">
          {summary.configured ? <button className="btn btn-quiet" type="button" onClick={cancelEditing} disabled={pending}>Cancelar</button> : <span className="field-hint">Você poderá editar ou excluir esta conexão depois.</span>}
          <button className="btn btn-primary" type="submit" disabled={pending} aria-busy={pending}>{pending ? "Salvando..." : summary.configured ? "Salvar alterações" : "Salvar integração"}</button>
        </div>
      </form>}
    </section>
  );
}
