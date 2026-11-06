"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { MenuButton } from "@/components/ui/menu-button";
import { StatusPill } from "@/components/ui/status-pill";

type Message = { id: string; role: "USER" | "ASSISTANT" | "TOOL"; kind: string | null; content: string; toolName: string | null; model: string | null; costMicros: number; createdAt: string; pending?: boolean };
type Action = { id: string; tool: string; summary: string; status: "PENDING" | "EXECUTED" | "REJECTED" | "FAILED" | "EXPIRED"; error: string | null; result: unknown; createdAt: string };
type View = { conversation: { id: string; title: string | null; costMicros: number; inputTokens: number; outputTokens: number; lastMessageAt: string }; messages: Message[]; actions: Action[] };
type HistoryItem = { id: string; title: string | null; lastMessageAt: string; costMicros: number };
type HistoryPage = { items: HistoryItem[]; nextCursor: string | null };
type HistoryState = "auto" | "open" | "closed";

const toolLabels: Record<string, string> = {
  buscar_alunos: "Buscou alunos", ver_aluno: "Abriu o perfil do aluno", resumo_alunos: "Contou os alunos", listar_planos: "Consultou os planos",
  cadastrar_aluno: "Preparou um cadastro", listar_agenda: "Consultou a agenda", criar_evento_agenda: "Preparou um compromisso", remover_evento_agenda: "Preparou uma remoção da agenda",
  resumo_financeiro: "Consultou o financeiro", listar_lancamentos: "Consultou os lançamentos", lancar_financeiro: "Preparou um lançamento", remover_lancamento: "Preparou uma remoção de lançamento",
};
const actionTitles: Record<string, string> = {
  cadastrar_aluno: "Cadastro de aluno", criar_evento_agenda: "Novo compromisso", remover_evento_agenda: "Remover compromisso",
  lancar_financeiro: "Lançamento financeiro", remover_lancamento: "Remover lançamento",
};
// Remoções não têm volta: o cartão fica em vermelho e o botão diz o que faz.
const irreversible = new Set(["remover_evento_agenda", "remover_lancamento"]);
const statusInfo: Record<Action["status"], { label: string; tone: "positive" | "danger" | "warning" | "info" | "neutral" }> = {
  PENDING: { label: "Aguardando seu sim", tone: "info" },
  EXECUTED: { label: "Feito", tone: "positive" },
  REJECTED: { label: "Cancelada", tone: "neutral" },
  FAILED: { label: "Não executada", tone: "danger" },
  EXPIRED: { label: "Expirou", tone: "warning" },
};

const WIDE = "(min-width: 1100px)";
const HISTORY_PREF = "pacelab:ai-history";

function formatUsd(micros: number) {
  const value = micros / 1_000_000;
  const digits = value > 0 && value < 1 ? 4 : 2;
  return `US$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

const timeFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Maceio", hour: "2-digit", minute: "2-digit" });
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Maceio", year: "numeric", month: "2-digit", day: "2-digit" });
const shortModel = (model: string | null) => (model ? model.split("/").pop() ?? model : "");

// Grupos do histórico pelo dia de Maceió: hoje, ontem, 7 dias, 30 dias e o resto.
function historyGroups(items: HistoryItem[]) {
  const today = new Date(`${dayKey.format(new Date())}T12:00:00-03:00`).getTime();
  const order = ["Hoje", "Ontem", "Últimos 7 dias", "Últimos 30 dias", "Mais antigas"];
  const groups = new Map<string, HistoryItem[]>();
  for (const item of items) {
    const day = new Date(`${dayKey.format(new Date(item.lastMessageAt))}T12:00:00-03:00`).getTime();
    const diff = Math.round((today - day) / 86_400_000);
    const label = diff <= 0 ? order[0] : diff === 1 ? order[1] : diff <= 7 ? order[2] : diff <= 30 ? order[3] : order[4];
    groups.set(label, [...(groups.get(label) ?? []), item]);
  }
  return order.filter((label) => groups.has(label)).map((label) => ({ label, items: groups.get(label) as HistoryItem[] }));
}

// Markdown mínimo e seguro: parágrafos, listas, **negrito** e links http(s). Nada de HTML cru.
function inline(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|https?:\/\/[^\s)]+)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("**")) parts.push(<strong key={`${keyPrefix}-${index}`}>{token.slice(2, -2)}</strong>);
    else {
      const url = token.replace(/[.,;:!?]+$/, "");
      parts.push(<a key={`${keyPrefix}-${index}`} href={url} target="_blank" rel="noreferrer">{url}</a>);
      if (url.length < token.length) parts.push(token.slice(url.length));
    }
    last = match.index + token.length;
    index += 1;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function RichText({ text }: { text: string }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  return <>{blocks.map((block, blockIndex) => {
    const lines = block.split("\n");
    if (lines.every((line) => /^\s*[-•*]\s+/.test(line))) {
      return <ul key={blockIndex}>{lines.map((line, lineIndex) => <li key={lineIndex}>{inline(line.replace(/^\s*[-•*]\s+/, ""), `${blockIndex}-${lineIndex}`)}</li>)}</ul>;
    }
    if (lines.every((line) => /^\s*\d+[.)]\s+/.test(line))) {
      return <ol key={blockIndex}>{lines.map((line, lineIndex) => <li key={lineIndex}>{inline(line.replace(/^\s*\d+[.)]\s+/, ""), `${blockIndex}-${lineIndex}`)}</li>)}</ol>;
    }
    return <p key={blockIndex}>{lines.map((line, lineIndex) => <Fragment key={lineIndex}>{lineIndex > 0 ? <br /> : null}{inline(line, `${blockIndex}-${lineIndex}`)}</Fragment>)}</p>;
  })}</>;
}

type Item =
  | { type: "user"; message: Message }
  | { type: "assistant"; message: Message; turnCost: number; tools: string[] }
  | { type: "tools"; id: string; tools: string[] }
  | { type: "action"; action: Action };

// Agrupa por rodada: consultas viram uma linha discreta, o custo da rodada vai na última resposta
// e os cartões de ação aparecem no fim da rodada que os preparou.
function buildItems(view: View | null): Item[] {
  if (!view) return [];
  const items: Item[] = [];
  const placed = new Set<string>();
  let tools: string[] = [];
  let turnCost = 0;
  const flushTools = (id: string) => {
    if (tools.length) items.push({ type: "tools", id: `tools-${id}`, tools: [...new Set(tools)] });
    tools = [];
  };
  const placeActions = (limit: string | null) => {
    for (const action of view.actions) {
      if (placed.has(action.id) || (limit && action.createdAt >= limit)) continue;
      placed.add(action.id);
      items.push({ type: "action", action });
    }
  };
  for (const message of view.messages) {
    if (message.role === "USER") {
      flushTools(message.id);
      placeActions(message.createdAt);
      items.push({ type: "user", message });
      turnCost = 0;
      continue;
    }
    if (message.kind === "action") continue;
    if (message.role === "TOOL") { if (message.toolName) tools.push(toolLabels[message.toolName] ?? "Consultou dados"); continue; }
    turnCost += message.costMicros;
    if (!message.content.trim()) continue;
    items.push({ type: "assistant", message, turnCost, tools: [...new Set(tools)] });
    tools = [];
  }
  flushTools("end");
  placeActions(null);
  return items;
}

function ActionCard({ action, display, busy, onDecide }: { action: Action; display?: Record<string, string>; busy: boolean; onDecide: (decision: "confirm" | "reject") => void }) {
  const info = statusInfo[action.status];
  const [copied, setCopied] = useState("");
  async function copy(label: string, value: string) {
    try { await navigator.clipboard.writeText(value); setCopied(label); window.setTimeout(() => setCopied(""), 1800); } catch { /* sem permissão de cópia */ }
  }
  return (
    <section className="ai-action" data-status={action.status} data-risk={irreversible.has(action.tool) ? "high" : undefined} aria-label={actionTitles[action.tool] ?? "Ação do assistente"}>
      <div className="ai-action-head">
        <strong>{actionTitles[action.tool] ?? "Ação"}</strong>
        <StatusPill tone={info.tone}>{info.label}</StatusPill>
      </div>
      <p className="ai-action-summary">{action.summary}</p>
      {irreversible.has(action.tool) && action.status === "PENDING" ? <p className="ai-action-warning"><Icon name="alert" className="icon-sm" />Isso não pode ser desfeito.</p> : null}
      {action.status === "FAILED" && action.error ? <p className="message" data-tone="danger"><Icon name="alert" /><span>{action.error}</span></p> : null}
      {display ? <dl className="ai-action-display">{Object.entries(display).map(([label, value]) => <div key={label}><dt>{label}</dt><dd><code>{value}</code><button className="btn btn-quiet ai-copy" type="button" onClick={() => copy(label, value)}><Icon name={copied === label ? "check" : "copy"} />{copied === label ? "Copiado" : "Copiar"}</button></dd></div>)}</dl> : null}
      {action.status === "EXECUTED" && !display && action.tool === "cadastrar_aluno" ? <p className="ai-action-note">A senha temporária e o link de pagamento apareceram uma única vez, logo após a confirmação. O link pode ser gerado de novo no perfil do aluno.</p> : null}
      {action.status === "PENDING" ? (
        <div className="ai-action-buttons">
          <button className={irreversible.has(action.tool) ? "btn btn-danger-solid" : "btn btn-primary"} type="button" disabled={busy} aria-busy={busy} onClick={() => onDecide("confirm")}><Icon name={irreversible.has(action.tool) ? "trash" : "check"} />{busy ? "Executando..." : irreversible.has(action.tool) ? "Remover" : "Confirmar"}</button>
          <button className="btn btn-quiet" type="button" disabled={busy} onClick={() => onDecide("reject")}>Cancelar</button>
        </div>
      ) : null}
    </section>
  );
}

// Campo de renomear: Enter salva, Esc cancela, sair do campo salva se mudou.
function RenameField({ initial, label, onSave, onCancel }: { initial: string; label: string; onSave: (title: string) => void; onCancel: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  const finish = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    const value = ref.current?.value.trim() ?? "";
    if (save && value && value !== initial) onSave(value); else onCancel();
  };
  return <input ref={ref} className="ai-rename" aria-label={label} defaultValue={initial} maxLength={80} onBlur={() => finish(true)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); finish(true); } if (event.key === "Escape") { event.preventDefault(); finish(false); } }} />;
}

function Composer({ value, onChange, onSend, disabled, sending, placeholder, variant, inputRef }: {
  value: string; onChange: (value: string) => void; onSend: () => void; disabled: boolean; sending: boolean; placeholder: string; variant: "start" | "dock"; inputRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  // Cresce com o texto até um limite; depois rola por dentro.
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 220)}px`;
  }, [value, inputRef]);
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); onSend(); }
  }
  function onSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); onSend(); }
  return (
    <form className="ai-composer" data-variant={variant} onSubmit={onSubmit}>
      <label className="visually-hidden" htmlFor={`ai-input-${variant}`}>Mensagem para o assistente</label>
      <textarea id={`ai-input-${variant}`} ref={inputRef} className="ai-input" rows={variant === "start" ? 3 : 1} value={value} maxLength={4000} placeholder={placeholder} disabled={disabled} onChange={(event) => onChange(event.target.value)} onKeyDown={onKeyDown} />
      <button className="ai-send" type="submit" disabled={disabled || sending || !value.trim()} aria-label="Enviar mensagem"><Icon name="arrowUp" /></button>
    </form>
  );
}

export function AssistantChat({ greeting, intro, ready, notReadyReason, isAdmin, modelId, suggestions, initialHistory, initialView, whatsappTab, assistantName }: {
  greeting: string;
  intro: string;
  ready: boolean;
  notReadyReason: string | null;
  isAdmin: boolean;
  modelId: string | null;
  suggestions: string[];
  initialHistory: HistoryPage;
  initialView: View | null;
  whatsappTab: { count: number } | null;
  assistantName: string | null;
}) {
  const [view, setView] = useState<View | null>(initialView);
  const [history, setHistory] = useState(initialHistory);
  const [historyState, setHistoryState] = useState<HistoryState>("auto");
  const [wide, setWide] = useState(false);
  const [query, setQuery] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [deciding, setDeciding] = useState("");
  const [displays, setDisplays] = useState<Record<string, Record<string, string>>>({});
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const items = useMemo(() => buildItems(view), [view]);
  const groups = useMemo(() => historyGroups(history.items), [history.items]);
  const activeId = view?.conversation.id || null;
  const historyVisible = wide ? historyState !== "closed" : historyState === "open";

  useEffect(() => {
    const media = window.matchMedia(WIDE);
    const sync = () => setWide(media.matches);
    sync();
    media.addEventListener("change", sync);
    try { if (localStorage.getItem(HISTORY_PREF) === "closed") setHistoryState("closed"); } catch { /* sem armazenamento */ }
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [items.length, sending]);

  // No celular o histórico é uma gaveta: Esc fecha e o foco vai para a busca ao abrir.
  useEffect(() => {
    if (wide || historyState !== "open") return;
    searchRef.current?.focus();
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") { setHistoryState("auto"); toggleRef.current?.focus(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [wide, historyState]);

  function toggleHistory() {
    if (wide) {
      const next = historyState === "closed" ? "auto" : "closed";
      setHistoryState(next);
      try { localStorage.setItem(HISTORY_PREF, next === "closed" ? "closed" : "open"); } catch { /* sem armazenamento */ }
    } else setHistoryState((state) => (state === "open" ? "auto" : "open"));
  }

  const closeDrawer = () => { if (!wide) setHistoryState("auto"); };

  function syncUrl(id: string | null) {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("c", id); else url.searchParams.delete("c");
    window.history.replaceState(null, "", url);
  }

  const fetchHistory = useCallback(async (search: string, cursor: string | null) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (cursor) params.set("cursor", cursor);
    const response = await fetch(`/api/admin/ai/conversations?${params}`, { cache: "no-store" });
    if (!response.ok) throw new Error("history");
    return (await response.json()) as HistoryPage;
  }, []);

  // Busca com uma pequena espera para não consultar a cada tecla.
  useEffect(() => {
    if (!query && history === initialHistory) return;
    const timer = window.setTimeout(async () => {
      try { setHistory(await fetchHistory(query.trim(), null)); } catch { /* mantém a lista atual */ }
    }, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function refreshHistory() {
    try { setHistory(await fetchHistory(query.trim(), null)); } catch { /* a lista se atualiza na próxima ação */ }
  }

  async function loadMore() {
    if (!history.nextCursor) return;
    setLoadingMore(true);
    try {
      const page = await fetchHistory(query.trim(), history.nextCursor);
      setHistory((current) => ({ items: [...current.items, ...page.items.filter((item) => !current.items.some((existing) => existing.id === item.id))], nextCursor: page.nextCursor }));
    } catch { /* tenta de novo no próximo clique */ } finally { setLoadingMore(false); }
  }

  async function openConversation(id: string) {
    setError("");
    closeDrawer();
    if (id === activeId) return;
    try {
      const response = await fetch(`/api/admin/ai/conversations/${id}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Não foi possível abrir a conversa."); return; }
      setView(data.view);
      syncUrl(id);
    } catch { setError("Não foi possível conectar ao servidor."); }
  }

  function newConversation() {
    setView(null);
    setError("");
    closeDrawer();
    syncUrl(null);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function rename(id: string, title: string) {
    setRenaming(null);
    setHistory((current) => ({ ...current, items: current.items.map((item) => (item.id === id ? { ...item, title } : item)) }));
    setView((current) => (current && current.conversation.id === id ? { ...current, conversation: { ...current.conversation, title } } : current));
    try {
      const response = await fetch(`/api/admin/ai/conversations/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
      if (!response.ok) { setError((await response.json()).error ?? "Não foi possível renomear."); await refreshHistory(); }
    } catch { setError("Não foi possível conectar ao servidor."); }
  }

  async function archive(id: string) {
    try {
      const response = await fetch(`/api/admin/ai/conversations/${id}`, { method: "DELETE" });
      if (!response.ok) return;
      setHistory((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }));
      if (id === activeId) newConversation();
    } catch { /* mantém a conversa na lista */ }
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || sending || !ready) return;
    setSending(true);
    setError("");
    setInput("");
    const optimistic: Message = { id: `local-${Date.now()}`, role: "USER", kind: null, content: message, toolName: null, model: null, costMicros: 0, createdAt: new Date().toISOString(), pending: true };
    setView((current) => current ? { ...current, messages: [...current.messages, optimistic] } : { conversation: { id: "", title: message.slice(0, 80), costMicros: 0, inputTokens: 0, outputTokens: 0, lastMessageAt: optimistic.createdAt }, messages: [optimistic], actions: [] });
    const restore = () => setView((current) => current && current.conversation.id ? { ...current, messages: current.messages.filter((item) => item.id !== optimistic.id) } : null);
    try {
      const response = await fetch("/api/admin/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: activeId, message }) });
      const data = await response.json();
      if (data.view) { setView(data.view); syncUrl(data.view.conversation.id); }
      if (!response.ok) {
        setError(data.error ?? "O assistente não conseguiu responder.");
        if (!data.view) { restore(); setInput(message); }
      }
      await refreshHistory();
    } catch {
      setError("Não foi possível conectar ao servidor.");
      setInput(message);
      restore();
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function decide(actionId: string, decision: "confirm" | "reject") {
    setDeciding(actionId);
    setError("");
    try {
      const response = await fetch(`/api/admin/ai/actions/${actionId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }) });
      const data = await response.json();
      if (!response.ok) setError(data.error ?? "Não foi possível concluir a ação.");
      if (data.display) setDisplays((current) => ({ ...current, [actionId]: data.display }));
      if (activeId) {
        const refreshed = await fetch(`/api/admin/ai/conversations/${activeId}`, { cache: "no-store" });
        if (refreshed.ok) setView((await refreshed.json()).view);
      }
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setDeciding(""); }
  }

  const placeholder = ready ? "Peça qualquer coisa: um aluno, a agenda, um lançamento..." : "Assistente indisponível";
  const title = view ? view.conversation.title || "Nova conversa" : assistantName || "Assistente";
  const subtitle = [assistantName && view ? assistantName : "Assistente de IA", shortModel(modelId), view?.conversation.costMicros ? formatUsd(view.conversation.costMicros) : ""].filter(Boolean).join(" · ");

  return (
    <div className="ai" data-history={historyState}>
      <aside className="ai-history" id="ai-history" aria-label="Histórico de conversas" aria-hidden={!historyVisible} inert={!historyVisible}>
        <div className="ai-history-head">
          {whatsappTab ? <nav className="ai-tabs" aria-label="Assistente"><Link href="/admin/assistente" aria-current="page">Minhas conversas</Link><Link href="/admin/assistente/whatsapp">WhatsApp{whatsappTab.count ? <span className="wa-count">{whatsappTab.count}</span> : null}</Link></nav> : <strong>Conversas</strong>}
          <button className="ai-icon-btn ai-history-close" type="button" aria-label="Fechar histórico" onClick={() => { setHistoryState("auto"); toggleRef.current?.focus(); }}><Icon name="close" /></button>
        </div>
        <div className="ai-history-search">
          <Icon name="search" />
          <input ref={searchRef} type="search" aria-label="Buscar conversas" placeholder="Buscar conversas" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <div className="ai-history-scroll">
          {groups.map((group) => (
            <section className="ai-history-group" key={group.label} aria-label={group.label}>
              <h3>{group.label}</h3>
              <ul>
                {group.items.map((item) => (
                  <li className="ai-history-row" key={item.id} data-current={item.id === activeId || undefined}>
                    {renaming === item.id ? (
                      <RenameField initial={item.title || ""} label="Novo nome da conversa" onSave={(value) => rename(item.id, value)} onCancel={() => setRenaming(null)} />
                    ) : (
                      <>
                        <button className="ai-history-item" type="button" aria-current={item.id === activeId ? "true" : undefined} onClick={() => openConversation(item.id)} title={item.title || "Conversa sem título"}>
                          {item.title || "Conversa sem título"}
                        </button>
                        <span className="ai-history-actions">
                          <button className="ai-icon-btn" type="button" aria-label={`Renomear ${item.title || "conversa"}`} title="Renomear" onClick={() => setRenaming(item.id)}><Icon name="edit" /></button>
                          <button className="ai-icon-btn" type="button" aria-label={`Arquivar ${item.title || "conversa"}`} title="Arquivar" onClick={() => archive(item.id)}><Icon name="archive" /></button>
                        </span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {!history.items.length ? <p className="ai-history-empty">{query ? "Nenhuma conversa com esse nome." : "Suas conversas aparecem aqui."}</p> : null}
          {history.nextCursor ? <button className="btn btn-quiet ai-history-more" type="button" onClick={loadMore} disabled={loadingMore} aria-busy={loadingMore}>{loadingMore ? "Carregando..." : "Carregar mais"}</button> : null}
        </div>
      </aside>
      <button className="ai-scrim" type="button" tabIndex={-1} aria-hidden="true" onClick={closeDrawer} />

      <section className="ai-main" aria-labelledby="ai-title">
        <header className="ai-head">
          <button ref={toggleRef} className="ai-icon-btn ai-head-btn" type="button" aria-label={historyVisible ? "Esconder histórico" : "Mostrar histórico"} aria-expanded={historyVisible} aria-controls="ai-history" title="Histórico" onClick={toggleHistory}><Icon name="history" /></button>
          <div className="ai-head-copy">
            {view && renaming === "header" ? (
              <RenameField initial={view.conversation.title || ""} label="Novo nome da conversa" onSave={(value) => rename(view.conversation.id, value)} onCancel={() => setRenaming(null)} />
            ) : (
              <h1 className="ai-title" id="ai-title">{title}</h1>
            )}
            <p>{subtitle}</p>
          </div>
          {view?.conversation.id ? <MenuButton label="Opções da conversa" items={[{ label: "Renomear", icon: "edit", onSelect: () => setRenaming("header") }, { label: "Arquivar", icon: "archive", onSelect: () => archive(view.conversation.id) }]} /> : null}
          <button className="ai-icon-btn ai-head-btn" type="button" aria-label="Nova conversa" title="Nova conversa" onClick={newConversation}><Icon name="plus" /></button>
        </header>

        {!view ? (
          <div className="ai-start">
            <div className="ai-start-inner">
              <span className="ai-mark" aria-hidden="true"><img src="/assets/images/pace-lab.svg" alt="" /></span>
              <h2 className="ai-greeting">{greeting}</h2>
              <p className="ai-intro">{ready ? intro : notReadyReason}</p>
              {!ready && isAdmin ? <Link className="btn btn-primary ai-setup" href="/admin/integracoes?app=openrouter"><Icon name="plug" />Configurar em Integrações</Link> : null}
              {ready ? <Composer variant="start" value={input} onChange={setInput} onSend={() => send(input)} disabled={!ready} sending={sending} placeholder={placeholder} inputRef={inputRef} /> : null}
              {error ? <p className="message ai-error" data-tone="danger" role="alert"><Icon name="alert" /><span>{error}</span></p> : null}
              {ready && suggestions.length ? <div className="ai-suggestions" aria-label="Sugestões">{suggestions.map((suggestion) => <button className="ai-suggestion" type="button" key={suggestion} onClick={() => send(suggestion)} disabled={sending}>{suggestion}</button>)}</div> : null}
            </div>
          </div>
        ) : (
          <>
            <div className="ai-thread" ref={threadRef} aria-live="polite" aria-busy={sending}>
              <ol className="ai-items">
                {items.map((item) => {
                  if (item.type === "user") return <li className="ai-msg" data-role="user" key={item.message.id}><div className="ai-bubble">{item.message.content}</div><span className="ai-meta">{item.message.pending ? "Enviando..." : timeFormat.format(new Date(item.message.createdAt))}</span></li>;
                  if (item.type === "tools") return <li className="ai-activity" key={item.id}><Icon name="search" />{item.tools.join(" · ")}</li>;
                  if (item.type === "action") return <li className="ai-msg" data-role="action" key={item.action.id}><ActionCard action={item.action} display={displays[item.action.id]} busy={deciding === item.action.id} onDecide={(decision) => decide(item.action.id, decision)} /></li>;
                  return (
                    <li className="ai-msg" data-role="assistant" data-kind={item.message.kind ?? undefined} key={item.message.id}>
                      {item.tools.length ? <span className="ai-activity"><Icon name="search" />{item.tools.join(" · ")}</span> : null}
                      <div className="ai-text"><RichText text={item.message.content} /></div>
                      <span className="ai-meta">{timeFormat.format(new Date(item.message.createdAt))}{item.turnCost ? ` · ${formatUsd(item.turnCost)}` : ""}</span>
                    </li>
                  );
                })}
                {sending ? <li className="ai-msg" data-role="assistant"><div className="ai-typing" aria-label="O assistente está respondendo"><i /><i /><i /></div></li> : null}
              </ol>
            </div>
            <div className="ai-dock">
              {error ? <p className="message ai-error" data-tone="danger" role="alert"><Icon name="alert" /><span>{error}</span></p> : null}
              <Composer variant="dock" value={input} onChange={setInput} onSend={() => send(input)} disabled={!ready} sending={sending} placeholder={placeholder} inputRef={inputRef} />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
