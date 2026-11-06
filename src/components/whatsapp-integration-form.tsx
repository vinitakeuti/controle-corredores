"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { WhatsAppSummary } from "@/lib/whatsapp/settings";
import { Feedback } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { StatusPill } from "@/components/ui/status-pill";

export function whatsappStatus(summary: WhatsAppSummary) {
  if (summary.enabled) return { tone: "positive" as const, label: "Ativo" };
  if (summary.baseUrl && summary.hasApiKey && summary.instance) return { tone: "info" as const, label: "Configurado" };
  return { tone: "neutral" as const, label: "Não configurado" };
}

const dateTime = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Maceio" }).format(new Date(value));
const phoneLabel = (digits: string) => {
  const local = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  return local.length === 11 ? `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}` : local.length === 10 ? `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}` : digits;
};

// WhatsApp pela Evolution API, no mesmo formato das outras integrações.
export function WhatsAppIntegrationForm({ initial, onChange }: { initial: WhatsAppSummary; onChange?: (summary: WhatsAppSummary) => void }) {
  const router = useRouter();
  const [summary, setSummary] = useState(initial);
  const configured = Boolean(summary.baseUrl && summary.hasApiKey && summary.instance);
  const [editing, setEditing] = useState(!configured);
  const [values, setValues] = useState({ baseUrl: initial.baseUrl, apiKey: "", instance: initial.instance, botNumber: initial.botNumber ? phoneLabel(initial.botNumber) : "", groupTrigger: initial.groupTrigger, leadPrices: initial.leadPrices, teamNotifyTarget: initial.teamNotifyTarget, enabled: initial.enabled || !configured });
  const [pending, setPending] = useState<string | null>(null);
  const [state, setState] = useState<string | null>(null);
  const [testTo, setTestTo] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const update = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => setValues((current) => ({ ...current, [key]: value }));

  async function request(url: string, method: "POST" | "PUT", body: unknown, busy: string) {
    setPending(busy);
    setFeedback(null);
    try {
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) { setFeedback({ type: "error", text: data.error ?? "Não foi possível concluir." }); return null; }
      return data;
    } catch {
      setFeedback({ type: "error", text: "Não foi possível conectar ao servidor." });
      return null;
    } finally { setPending(null); }
  }

  function applied(next: WhatsAppSummary, text: string) {
    setSummary(next);
    onChange?.(next);
    setFeedback({ type: "success", text });
    router.refresh();
  }

  async function testConnection(useTyped: boolean) {
    setState(null);
    const data = await request("/api/admin/whatsapp/test", "POST", useTyped ? { baseUrl: values.baseUrl, apiKey: values.apiKey || undefined, instance: values.instance } : {}, "test");
    if (data) setState(data.label);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = await request("/api/admin/whatsapp/settings", "PUT", { baseUrl: values.baseUrl, ...(values.apiKey.trim() ? { apiKey: values.apiKey.trim() } : {}), instance: values.instance, botNumber: values.botNumber, groupTrigger: values.groupTrigger, leadPrices: values.leadPrices, teamNotifyTarget: values.teamNotifyTarget, enabled: values.enabled }, "save");
    if (!data) return;
    applied(data.settings, data.settings.webhookConfiguredAt ? "Integração salva." : "Integração salva. Agora conecte o webhook para a Pace Lab receber as mensagens.");
    update("apiKey", "");
    setEditing(false);
  }

  async function connectWebhook() {
    const data = await request("/api/admin/whatsapp/webhook", "POST", {}, "webhook");
    if (!data) return;
    const settings = await fetch("/api/admin/whatsapp/settings", { cache: "no-store" }).then((response) => response.json()).catch(() => null);
    if (settings?.settings) applied(settings.settings, `Webhook conectado: ${data.url}`);
  }

  async function sendTest() {
    const data = await request("/api/admin/whatsapp/send-test", "POST", { to: testTo }, "send");
    if (data) setFeedback({ type: "success", text: "Mensagem de teste enviada." });
  }

  async function toggle() {
    const data = await request("/api/admin/whatsapp/settings", "PUT", { enabled: !summary.enabled }, "toggle");
    if (data) applied(data.settings, data.settings.enabled ? "Atendimento pelo WhatsApp ligado." : "Atendimento pelo WhatsApp desligado. As mensagens deixam de ser respondidas pela IA.");
  }

  async function remove() {
    const data = await request("/api/admin/whatsapp/settings", "PUT", { apiKey: null, enabled: false }, "delete");
    if (data) { applied(data.settings, "Integração excluída. A IA parou de atender pelo WhatsApp."); setConfirmDelete(false); setEditing(true); }
  }

  return (
    <section className="provider-form" aria-labelledby="integration-config-title">
      <Feedback success={feedback?.type === "success" ? feedback.text : undefined} error={feedback?.type === "error" ? feedback.text : undefined} />

      {!editing && configured ? <>
        <div className="provider-summary-head">
          <div><strong>{summary.enabled ? "Atendimento ativo" : "Conexão configurada, atendimento desligado"}</strong><p>{summary.enabled ? "A IA responde leads e alunos e atende a equipe pelo número cadastrado de cada um." : "Ligue o atendimento quando quiser que a IA responda pelo WhatsApp."}</p></div>
          <StatusPill tone={summary.webhookConfiguredAt ? "neutral" : "warning"}>{summary.webhookConfiguredAt ? "Webhook conectado" : "Webhook pendente"}</StatusPill>
        </div>
        <dl className="dl-grid">
          <div><dt>Servidor</dt><dd>{summary.baseUrl}</dd></div>
          <div><dt>Instância</dt><dd>{summary.instance}</dd></div>
          <div><dt>API key</dt><dd>termina em {summary.apiKeyHint}</dd></div>
          <div><dt>Número da Pace Lab</dt><dd>{summary.botNumber ? phoneLabel(summary.botNumber) : "Não informado"}</dd></div>
          <div><dt>Chamada em grupos</dt><dd>@{summary.groupTrigger} ou marcando o número</dd></div>
          <div><dt>Preços para leads</dt><dd>{summary.leadPrices ? "A IA informa" : "Só a equipe"}</dd></div>
          <div><dt>Aviso para a equipe</dt><dd>{summary.teamNotifyTarget ? (summary.teamNotifyTarget.endsWith("@g.us") ? "Grupo do WhatsApp" : phoneLabel(summary.teamNotifyTarget)) : "Desligado"}</dd></div>
          <div><dt>Webhook</dt><dd>{summary.webhookConfiguredAt ? `conectado em ${dateTime(summary.webhookConfiguredAt)}` : "não conectado"}</dd></div>
        </dl>
        {state ? <p className="message" data-tone={state === "conectado" ? "positive" : "warning"}><Icon name={state === "conectado" ? "check" : "alert"} /><span>Instância {state}{state === "conectado" ? "." : ". Abra a Evolution e leia o QR Code para conectar o WhatsApp."}</span></p> : null}
        <p className="field-hint">A IA reconhece a equipe pelo WhatsApp cadastrado de cada pessoa em <Link href="/admin/configuracoes?secao=assistente#equipe-whatsapp">Configurações › Assistente IA</Link>. Quando alguém da equipe responde pelo celular, a IA pausa aquela conversa por {summary.pauseHours} horas.</p>
        {!confirmDelete ? <div className="btn-row btn-row-split provider-actions">
          <span className="btn-row">
            <button className="btn btn-secondary" type="button" onClick={() => setEditing(true)}>Editar configuração</button>
            <button className="btn btn-secondary" type="button" onClick={() => testConnection(false)} disabled={pending !== null} aria-busy={pending === "test"}>{pending === "test" ? "Testando..." : "Testar conexão"}</button>
            <button className="btn btn-secondary" type="button" onClick={connectWebhook} disabled={pending !== null} aria-busy={pending === "webhook"}>{pending === "webhook" ? "Conectando..." : summary.webhookConfiguredAt ? "Reconectar webhook" : "Conectar webhook"}</button>
            <button className="btn btn-secondary" type="button" onClick={toggle} disabled={pending !== null} aria-busy={pending === "toggle"}>{summary.enabled ? "Desligar atendimento" : "Ligar atendimento"}</button>
          </span>
          <button className="btn btn-danger" type="button" onClick={() => setConfirmDelete(true)}><Icon name="trash" />Excluir integração</button>
        </div> : <div className="message-stack provider-actions">
          <p className="message" data-tone="danger"><Icon name="alert" /><span>Isso apaga a API key e a IA para de atender pelo WhatsApp. As conversas continuam guardadas.</span></p>
          <div className="btn-row"><button className="btn btn-secondary" type="button" onClick={() => setConfirmDelete(false)}>Cancelar</button><button className="btn btn-danger-solid" type="button" onClick={remove} disabled={pending !== null} aria-busy={pending === "delete"}>Confirmar exclusão</button></div>
        </div>}
        <fieldset className="provider-step">
          <legend className="section-title">Enviar mensagem de teste</legend>
          <div className="ai-key-row">
            <input className="control" inputMode="tel" aria-label="Número para o teste" placeholder="(82) 99999-9999" value={testTo} onChange={(event) => setTestTo(event.target.value)} />
            <button className="btn btn-secondary" type="button" onClick={sendTest} disabled={pending !== null || !testTo.trim()} aria-busy={pending === "send"}><Icon name="send" />{pending === "send" ? "Enviando..." : "Enviar teste"}</button>
          </div>
        </fieldset>
      </> : <form className="provider-config" onSubmit={submit}>
        <div className="provider-summary-head"><div><strong>{configured ? "Atualizar conexão" : "Conecte a Evolution API"}</strong><p>Use a instância já conectada ao WhatsApp da Pace Lab. A API key é criptografada e nunca volta para o navegador.</p></div></div>

        <fieldset className="provider-step">
          <legend className="section-title">Conexão</legend>
          <p className="section-lead">Dados da sua Evolution API (versão 2).</p>
          <div className="form-grid">
            <div className="form-field"><label htmlFor="wa-url">URL da Evolution</label><input className="control" id="wa-url" type="url" required value={values.baseUrl} onChange={(event) => update("baseUrl", event.target.value)} placeholder="https://evolution.seudominio.com" /></div>
            <div className="form-field"><label htmlFor="wa-instance">Nome da instância</label><input className="control" id="wa-instance" required value={values.instance} onChange={(event) => update("instance", event.target.value)} placeholder="pacelab" /></div>
          </div>
          <div className="form-field">
            <label htmlFor="wa-key">API key</label>
            <div className="ai-key-row">
              <input className="control" id="wa-key" type="password" autoComplete="new-password" required={!summary.hasApiKey} value={values.apiKey} onChange={(event) => update("apiKey", event.target.value)} placeholder={summary.hasApiKey ? `Deixe vazio para manter (termina em ${summary.apiKeyHint})` : "Chave global ou da instância"} />
              <button className="btn btn-secondary" type="button" onClick={() => testConnection(true)} disabled={pending !== null || !values.baseUrl || !values.instance || (!values.apiKey && !summary.hasApiKey)} aria-busy={pending === "test"}>{pending === "test" ? "Testando..." : "Testar conexão"}</button>
            </div>
            {state ? <p className="message" data-tone={state === "conectado" ? "positive" : "warning"}><Icon name={state === "conectado" ? "check" : "alert"} /><span>Instância {state}.</span></p> : null}
          </div>
          <div className="form-field provider-short-field"><label htmlFor="wa-number">Número da Pace Lab</label><input className="control" id="wa-number" inputMode="tel" value={values.botNumber} onChange={(event) => update("botNumber", event.target.value)} placeholder="(82) 99999-9999" /><p className="field-hint">O número conectado na instância. Serve para reconhecer quando marcam a IA num grupo.</p></div>
        </fieldset>

        <fieldset className="provider-step">
          <legend className="section-title">Atendimento</legend>
          <div className="form-grid">
            <div className="form-field"><label htmlFor="wa-trigger">Palavra para chamar a IA em grupos</label><input className="control" id="wa-trigger" value={values.groupTrigger} onChange={(event) => update("groupTrigger", event.target.value)} placeholder="assistente" /><p className="field-hint">Em grupos, a IA responde quando marcam o número dela, respondem uma mensagem dela ou escrevem esta palavra.</p></div>
            <div className="form-field"><label htmlFor="wa-notify">Avisar a equipe em</label><input className="control" id="wa-notify" value={values.teamNotifyTarget} onChange={(event) => update("teamNotifyTarget", event.target.value)} placeholder="Número ou ID do grupo (…@g.us)" /><p className="field-hint">Quando um lead ou aluno pede atendimento humano, a IA avisa aqui. Deixe vazio para não avisar.</p></div>
          </div>
          <label className="ai-switch"><input type="checkbox" checked={values.leadPrices} onChange={(event) => update("leadPrices", event.target.checked)} /><span><strong>Informar os valores dos planos para leads</strong><small>A IA consulta os planos ativos e informa preços e formas de pagamento.</small></span></label>
          <label className="ai-switch"><input type="checkbox" checked={values.enabled} onChange={(event) => update("enabled", event.target.checked)} /><span><strong>Ligar o atendimento pelo WhatsApp</strong><small>Depois de salvar, conecte o webhook para começar a receber as mensagens.</small></span></label>
        </fieldset>

        <div className="btn-row btn-row-split provider-actions">
          {configured ? <button className="btn btn-quiet" type="button" onClick={() => { setEditing(false); setFeedback(null); }} disabled={pending !== null}>Cancelar</button> : <span className="field-hint">Você poderá editar ou excluir esta conexão depois.</span>}
          <button className="btn btn-primary" type="submit" disabled={pending !== null} aria-busy={pending === "save"}>{pending === "save" ? "Salvando..." : configured ? "Salvar alterações" : "Salvar integração"}</button>
        </div>
      </form>}
    </section>
  );
}
