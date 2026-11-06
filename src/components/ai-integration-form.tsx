"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AiSettingsSummary } from "@/lib/ai/settings";
import { Feedback } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { StatusPill } from "@/components/ui/status-pill";

type Pricing = { prompt: number; completion: number; inputCacheRead: number | null; inputCacheWrite: number | null; request: number };
type Model = { id: string; name: string; provider: string; contextLength: number; pricing: Pricing; supportsTools: boolean };
type KeyInfo = { label: string | null; usageUsd: number | null; limitUsd: number | null; limitRemainingUsd: number | null; isFreeTier: boolean };
export type AiConnection = Pick<AiSettingsSummary, "enabled" | "hasApiKey" | "apiKeyHint" | "model" | "modelName" | "modelPricing" | "modelSupportsTools" | "updatedAt">;

const usd = (value: number, digits = 2) => `US$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const perMillion = (price: number | null | undefined) => (price == null ? "—" : price === 0 ? "grátis" : `${usd(price * 1_000_000)} / 1 mi tokens`);
const contextLabel = (tokens: number) => (tokens >= 1_000_000 ? `${(tokens / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi tokens` : `${Math.round(tokens / 1000)} mil tokens`);
const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function aiConnectionStatus(connection: AiConnection) {
  if (connection.enabled) return { tone: "positive" as const, label: "Ativo" };
  if (connection.hasApiKey && connection.model) return { tone: "info" as const, label: "Configurado" };
  return { tone: "neutral" as const, label: "Não configurado" };
}

// Padrão sugerido quando ainda não há modelo: o Claude Opus mais recente (sem as variantes de lote).
function suggestedModel(models: Model[]) {
  const interactive = models.filter((model) => !model.id.includes(":"));
  return interactive.find((model) => /claude-opus-5[.-]5$/.test(model.id)) ?? interactive.find((model) => model.provider === "anthropic" && /opus/.test(model.id)) ?? interactive[0] ?? models[0];
}

// Conexão com o OpenRouter no mesmo formato das outras integrações: resumo da conexão e, ao editar, os passos.
export function AiIntegrationForm({ initial, onChange }: { initial: AiConnection; onChange?: (connection: AiConnection) => void }) {
  const router = useRouter();
  const [connection, setConnection] = useState(initial);
  const configured = connection.hasApiKey && Boolean(connection.model);
  const [editing, setEditing] = useState(!configured);
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<Model[]>([]);
  const [modelsError, setModelsError] = useState("");
  const [search, setSearch] = useState("");
  const [modelId, setModelId] = useState(initial.model ?? "");
  const [enabled, setEnabled] = useState(initial.enabled || !configured);
  const [pending, setPending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [keyInfo, setKeyInfo] = useState<KeyInfo | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function loadModels(refresh = false) {
    setModelsError("");
    try {
      const response = await fetch(`/api/admin/ai/models${refresh ? "?refresh=1" : ""}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) { setModelsError(data.error ?? "Não foi possível carregar os modelos."); return; }
      setModels(data.models);
      setModelId((current) => current || suggestedModel(data.models)?.id || "");
    } catch { setModelsError("Não foi possível conectar ao servidor."); }
  }

  useEffect(() => { if (editing && !models.length) void loadModels(); }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const needle = normalize(search.trim());
    const list = needle ? models.filter((model) => normalize(`${model.name} ${model.id}`).includes(needle)) : models;
    const selected = models.find((model) => model.id === modelId);
    return selected && !list.includes(selected) ? [selected, ...list] : list;
  }, [models, search, modelId]);
  const groups = useMemo(() => {
    const map = new Map<string, Model[]>();
    for (const model of filtered) map.set(model.provider, [...(map.get(model.provider) ?? []), model]);
    return [...map.entries()];
  }, [filtered]);
  const selected = models.find((model) => model.id === modelId) ?? null;

  async function put(body: Record<string, unknown>, success: string) {
    setPending(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/admin/ai/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) { setFeedback({ type: "error", text: data.error ?? "Não foi possível salvar." }); return false; }
      setConnection(data.settings);
      setEnabled(data.settings.enabled);
      onChange?.(data.settings);
      setFeedback({ type: "success", text: success });
      router.refresh();
      return true;
    } catch {
      setFeedback({ type: "error", text: "Não foi possível conectar ao servidor." });
      return false;
    } finally { setPending(false); }
  }

  async function testKey() {
    setTesting(true); setFeedback(null); setKeyInfo(null);
    try {
      const response = await fetch("/api/admin/ai/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: apiKey.trim() || undefined }) });
      const data = await response.json();
      if (response.ok) setKeyInfo(data.info); else setFeedback({ type: "error", text: data.error ?? "Não foi possível testar a chave." });
    } catch { setFeedback({ type: "error", text: "Não foi possível conectar ao servidor." }); } finally { setTesting(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiKey.trim() && !connection.hasApiKey) { setFeedback({ type: "error", text: "Informe a chave da API do OpenRouter." }); return; }
    if (!modelId) { setFeedback({ type: "error", text: "Escolha um modelo." }); return; }
    const saved = await put({ ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}), model: modelId, enabled }, enabled ? "Integração salva. O assistente já está liberado para a equipe." : "Integração salva. O assistente continua desligado.");
    if (saved) { setApiKey(""); setKeyInfo(null); setEditing(false); }
  }

  function cancel() {
    setApiKey(""); setKeyInfo(null); setSearch(""); setModelId(connection.model ?? ""); setEnabled(connection.enabled); setFeedback(null); setEditing(false);
  }

  async function remove() {
    const removed = await put({ apiKey: null, model: null, enabled: false }, "Integração excluída. O assistente foi desligado.");
    if (removed) { setConfirmDelete(false); setModelId(""); setEnabled(true); setEditing(true); }
  }

  const pricing = connection.modelPricing;

  return (
    <section className="provider-form" aria-labelledby="integration-config-title">
      <Feedback success={feedback?.type === "success" ? feedback.text : undefined} error={feedback?.type === "error" ? feedback.text : undefined} />

      {!editing && configured ? <>
        <div className="provider-summary-head">
          <div><strong>{connection.enabled ? "Assistente ativo" : "Conexão configurada, assistente desligado"}</strong><p>{connection.enabled ? "A equipe usa o assistente conforme a permissão de cada pessoa." : "Ligue o assistente quando quiser liberar a tela Assistente para a equipe."}</p></div>
          <StatusPill tone={connection.modelSupportsTools ? "neutral" : "warning"}>{connection.modelSupportsTools ? "Aceita ferramentas" : "Sem ferramentas"}</StatusPill>
        </div>
        <dl className="dl-grid">
          <div><dt>Chave da API</dt><dd>termina em {connection.apiKeyHint}</dd></div>
          <div><dt>Modelo</dt><dd>{connection.modelName ?? connection.model}</dd></div>
          <div><dt>Entrada</dt><dd>{perMillion(pricing?.prompt)}</dd></div>
          <div><dt>Saída</dt><dd>{perMillion(pricing?.completion)}</dd></div>
          {connection.updatedAt ? <div><dt>Última atualização</dt><dd>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Maceio" }).format(new Date(connection.updatedAt))}</dd></div> : null}
        </dl>
        <p className="field-hint">Instruções do assistente, limite de gasto e custos ficam em <Link href="/admin/configuracoes?secao=assistente">Configurações › Assistente IA</Link>.</p>
        {!confirmDelete ? <div className="btn-row btn-row-split provider-actions">
          <span className="btn-row">
            <button className="btn btn-secondary" type="button" onClick={() => setEditing(true)}>Editar configuração</button>
            <button className="btn btn-secondary" type="button" disabled={pending} aria-busy={pending} onClick={() => put({ enabled: !connection.enabled }, connection.enabled ? "Assistente desligado." : "Assistente ligado.")}>{connection.enabled ? "Desligar assistente" : "Ligar assistente"}</button>
          </span>
          <button className="btn btn-danger" type="button" onClick={() => setConfirmDelete(true)}><Icon name="trash" />Excluir integração</button>
        </div> : <div className="message-stack provider-actions">
          <p className="message" data-tone="danger"><Icon name="alert" /><span>Isso apaga a chave e desliga o assistente para toda a equipe. O histórico de conversas e de custos continua guardado.</span></p>
          <div className="btn-row"><button className="btn btn-secondary" type="button" onClick={() => setConfirmDelete(false)}>Cancelar</button><button className="btn btn-danger-solid" type="button" onClick={remove} disabled={pending} aria-busy={pending}>Confirmar exclusão</button></div>
        </div>}
      </> : <form className="provider-config" onSubmit={submit}>
        <div className="provider-summary-head"><div><strong>{configured ? "Atualizar conexão" : "Conecte o OpenRouter"}</strong><p>Uma chave do OpenRouter dá acesso aos modelos Claude e a todos os outros. Ela é criptografada e nunca volta para o navegador.</p></div></div>

        <fieldset className="provider-step">
          <legend className="section-title">Chave da API</legend>
          <p className="section-lead">Crie a chave em openrouter.ai › Keys e cole aqui.</p>
          <div className="form-field">
            <label htmlFor="ai-key">API key</label>
            <div className="ai-key-row">
              <input className="control" id="ai-key" type="password" autoComplete="new-password" spellCheck={false} value={apiKey} onChange={(event) => setApiKey(event.target.value)} required={!connection.hasApiKey} placeholder={connection.hasApiKey ? `Deixe vazio para manter (termina em ${connection.apiKeyHint})` : "sk-or-v1-..."} />
              <button className="btn btn-secondary" type="button" onClick={testKey} disabled={testing || (!apiKey.trim() && !connection.hasApiKey)} aria-busy={testing}>{testing ? "Testando..." : "Testar chave"}</button>
            </div>
            {keyInfo ? <p className="message" data-tone="positive"><Icon name="check" /><span>Chave válida{keyInfo.label ? ` (${keyInfo.label})` : ""}.{keyInfo.usageUsd != null ? ` Uso total ${usd(keyInfo.usageUsd)}.` : ""}{keyInfo.limitRemainingUsd != null ? ` Restam ${usd(keyInfo.limitRemainingUsd)} do limite.` : ""}</span></p> : null}
          </div>
        </fieldset>

        <fieldset className="provider-step">
          <legend className="section-title">Modelo</legend>
          <p className="section-lead">Todos os modelos do OpenRouter. Os do Claude aparecem primeiro; o preço é por milhão de tokens.</p>
          <div className="ai-model-row">
            <input className="control" type="search" aria-label="Buscar modelo" placeholder="Buscar: claude, gpt, gemini..." value={search} onChange={(event) => setSearch(event.target.value)} />
            <select className="control" id="ai-model" aria-label="Modelo" value={modelId} onChange={(event) => setModelId(event.target.value)} disabled={!models.length}>
              {!models.length ? <option value="">{modelsError ? "Lista indisponível" : "Carregando modelos..."}</option> : null}
              {groups.map(([provider, items]) => <optgroup key={provider} label={provider}>{items.map((model) => <option key={model.id} value={model.id}>{model.name}{model.supportsTools ? "" : " (sem ferramentas)"}</option>)}</optgroup>)}
            </select>
          </div>
          {modelsError ? <p className="message" data-tone="danger"><Icon name="alert" /><span>{modelsError} <button className="btn btn-quiet" type="button" onClick={() => loadModels(true)}>Tentar de novo</button></span></p> : null}
          {selected ? <dl className="dl-grid ai-model-facts">
            <div><dt>Entrada</dt><dd>{perMillion(selected.pricing.prompt)}</dd></div>
            <div><dt>Saída</dt><dd>{perMillion(selected.pricing.completion)}</dd></div>
            <div><dt>Leitura do cache</dt><dd>{perMillion(selected.pricing.inputCacheRead)}</dd></div>
            <div><dt>Contexto</dt><dd>{contextLabel(selected.contextLength)}</dd></div>
          </dl> : null}
          {selected && !selected.supportsTools ? <p className="message" data-tone="warning"><Icon name="alert" /><span>Este modelo não aceita ferramentas: o assistente só vai conversar, sem consultar alunos, agenda ou financeiro.</span></p> : null}
        </fieldset>

        <fieldset className="provider-step">
          <legend className="section-title">Assistente</legend>
          <label className="ai-switch">
            <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
            <span><strong>Liberar o assistente para a equipe</strong><small>Cada pessoa só pede o que a permissão dela permite.</small></span>
          </label>
        </fieldset>

        <div className="btn-row btn-row-split provider-actions">
          {configured ? <button className="btn btn-quiet" type="button" onClick={cancel} disabled={pending}>Cancelar</button> : <span className="field-hint">Você poderá editar ou excluir esta conexão depois.</span>}
          <button className="btn btn-primary" type="submit" disabled={pending} aria-busy={pending}>{pending ? "Salvando..." : configured ? "Salvar alterações" : "Salvar integração"}</button>
        </div>
      </form>}
    </section>
  );
}
