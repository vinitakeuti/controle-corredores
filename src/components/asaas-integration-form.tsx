"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { AsaasEnvironment, AsaasIntegrationSummary } from "@/lib/asaas-integration";

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
    <section className={`integration-workspace ${embedded ? "integration-form-embedded" : ""}`} aria-labelledby={embedded ? "integration-config-title" : "asaas-title"}>
      {!embedded ? <div className="integration-workspace-header">
        <div className="integration-provider-mark" aria-hidden="true">AS</div>
        <div className="integration-provider-copy">
          <p className="eyebrow">Gateway de pagamentos</p>
          <h2 id="asaas-title">Asaas</h2>
          <p>Pix e cartão em um único checkout.</p>
        </div>
        <div className={`integration-status ${connected ? "is-connected" : "is-pending"}`}><span /> {connected ? (summary.active ? "Ativa" : "Configurada") : "Não configurada"}</div>
      </div> : null}

      {feedback ? <p className={`integration-feedback ${feedback.type}`} role="status">{feedback.text}</p> : null}

      {!editing && connected ? <>
        <div className="integration-summary-intro"><div><strong>{summary.active ? "Conexão ativa" : "Conexão configurada"}</strong><p>A chave da API fica criptografada e os segredos nunca são exibidos novamente.</p></div><span className="integration-summary-environment">{environmentLabel(connected.environment)}</span></div>
        <dl className="integration-details">
          <div><dt>Chave da API</dt><dd>{connected.apiKeyMasked}</dd></div>
          <div><dt>Token do webhook</dt><dd>{connected.webhookTokenConfigured ? "Configurado" : "Não configurado"}</dd></div>
          <div><dt>Endpoint do webhook</dt><dd><code>/api/webhooks/asaas</code></dd></div>
          <div><dt>Header de autenticação</dt><dd><code>asaas-access-token</code></dd></div>
          <div><dt>Última atualização</dt><dd>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(connected.updatedAt))}</dd></div>
        </dl>
        <div className="integration-actions">
          <button className="button button-secondary" type="button" onClick={startEditing}>Editar configuração</button>
          {!confirmDelete ? <button className="button button-danger-quiet" type="button" onClick={() => setConfirmDelete(true)}>Excluir integração</button> : <div className="integration-delete-confirm"><span>Isso desativa o checkout Asaas imediatamente.</span><button className="button button-quiet" type="button" onClick={() => setConfirmDelete(false)}>Cancelar</button><button className="button button-danger" type="button" onClick={remove} disabled={pending}>Confirmar exclusão</button></div>}
        </div>
      </> : <form className="integration-form" onSubmit={submit}>
        <div className="integration-form-intro"><div><strong>{summary.configured ? "Atualizar conexão" : "Conecte o Asaas"}</strong><p>A chave da API será criptografada e o token do webhook será armazenado somente como hash.</p></div><span>01 / 03</span></div>

        <div className="integration-form-section">
          <div className="integration-section-heading"><span>01</span><div><h3>Ambiente</h3><p>Comece pelo sandbox para validar o checkout.</p></div></div>
          <div className="integration-environment-toggle" role="group" aria-label="Ambiente do Asaas">
            {(["sandbox", "production"] as AsaasEnvironment[]).map((environment) => <button key={environment} type="button" className={values.environment === environment ? "active" : ""} onClick={() => updateValue("environment", environment)}><span>{environmentLabel(environment)}</span><small>{environment === "sandbox" ? "Testes sem cobrança real" : "Cobranças reais"}</small></button>)}
          </div>
        </div>

        <div className="integration-form-section">
          <div className="integration-section-heading"><span>02</span><div><h3>Chave da API</h3><p>Copie a chave do ambiente correspondente no painel do Asaas.</p></div></div>
          <div className="integration-fields-grid">
            <div className="field"><label htmlFor="asaas-api-key">API key</label><input id="asaas-api-key" type="password" value={values.apiKey} onChange={(event) => updateValue("apiKey", event.target.value)} autoComplete="new-password" required={!connected} placeholder={connected ? "Deixe vazio para manter" : values.environment === "sandbox" ? "$aact_hmlg_..." : "$aact_prod_..."} /></div>
          </div>
        </div>

        <div className="integration-form-section">
          <div className="integration-section-heading"><span>03</span><div><h3>Autenticação do webhook</h3><p>Cadastre o endpoint <code>/api/webhooks/asaas</code> no Asaas e envie este mesmo valor no header <code>asaas-access-token</code>.</p></div></div>
          <div className="integration-fields-grid">
            <div className="field"><label htmlFor="asaas-webhook-token">Token do webhook</label><input id="asaas-webhook-token" type="password" value={values.webhookToken} onChange={(event) => updateValue("webhookToken", event.target.value)} autoComplete="new-password" required={!connected} minLength={values.webhookToken ? 32 : undefined} maxLength={255} pattern={"\\S+"} placeholder={connected ? "Deixe vazio para manter" : "Crie um token secreto"} /><small>Use de 32 a 255 caracteres, sem espaços.</small></div>
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
