"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Icon } from "@/components/ui/icon";
import { MenuButton } from "@/components/ui/menu-button";

type Item = { id: string; title: string | null; contactPhone: string | null; audience: string; isGroup: boolean; needsHuman: boolean; pausedUntil: string | null; lastMessageAt: string; preview: string };
type Page = { items: Item[]; nextCursor: string | null; needsHumanCount: number };
type Message = { id: string; role: "USER" | "ASSISTANT" | "TOOL"; kind: string | null; content: string; authorName: string | null; model: string | null; costMicros: number; createdAt: string };
type View = { conversation: { internalGroup: boolean; id: string; title: string | null; contactName: string | null; contactPhone: string | null; audience: string; isGroup: boolean; needsHuman: boolean; needsHumanReason: string | null; pausedUntil: string | null; costMicros: number }; messages: Message[] };
type Filter = "todas" | "atendimento";

const WIDE = "(min-width: 1100px)";
const audienceLabel = (item: { audience: string; isGroup: boolean }) => (item.isGroup ? "Grupo" : item.audience === "STUDENT" ? "Aluno" : item.audience === "STAFF" ? "Equipe" : "Lead");
const time = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Maceio", hour: "2-digit", minute: "2-digit" });
const dayTime = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Maceio", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const shortDate = (value: string) => {
  const date = new Date(value);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Maceio" }).format(new Date());
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Maceio" }).format(date) === today ? time.format(date) : new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Maceio", day: "2-digit", month: "2-digit" }).format(date);
};
const phoneLabel = (digits: string | null) => {
  if (!digits) return "";
  const local = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  return local.length === 11 ? `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}` : local.length === 10 ? `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}` : `+${digits}`;
};
// O WhatsApp usa *negrito*; aqui mostramos como texto simples com quebras de linha.
const plain = (text: string) => text.replace(/\*([^*\n]+)\*/g, "$1");

export function WhatsAppInbox({ initialPage, initialView, connected, assistantName, isAdmin }: { initialPage: Page; initialView: View | null; connected: boolean; assistantName: string | null; isAdmin: boolean }) {
  const [page, setPage] = useState(initialPage);
  const [view, setView] = useState(initialView);
  const [filter, setFilter] = useState<Filter>("todas");
  const [query, setQuery] = useState("");
  const [historyState, setHistoryState] = useState<"auto" | "open" | "closed">("auto");
  const [wide, setWide] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const first = useRef(true);
  const activeId = view?.conversation.id ?? null;
  const historyVisible = wide ? historyState !== "closed" : historyState === "open";

  useEffect(() => {
    const media = window.matchMedia(WIDE);
    const sync = () => setWide(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  useEffect(() => { const thread = threadRef.current; if (thread) thread.scrollTop = thread.scrollHeight; }, [view?.messages.length, activeId]);
  useLayoutEffect(() => { const input = inputRef.current; if (input) { input.style.height = "auto"; input.style.height = `${Math.min(input.scrollHeight, 200)}px`; } }, [reply]);
  useEffect(() => {
    if (wide || historyState !== "open") return;
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") { setHistoryState("auto"); toggleRef.current?.focus(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [wide, historyState]);

  const fetchPage = useCallback(async (cursor: string | null) => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (filter === "atendimento") params.set("filtro", "atendimento");
    if (cursor) params.set("cursor", cursor);
    const response = await fetch(`/api/admin/whatsapp/conversations?${params}`, { cache: "no-store" });
    if (!response.ok) throw new Error("list");
    return (await response.json()) as Page;
  }, [query, filter]);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const timer = window.setTimeout(async () => { try { setPage(await fetchPage(null)); } catch { /* mantém a lista */ } }, 250);
    return () => window.clearTimeout(timer);
  }, [fetchPage]);

  // Novas mensagens chegam pelo WhatsApp: a lista e a conversa aberta se atualizam sozinhas.
  useEffect(() => {
    const timer = window.setInterval(async () => {
      if (document.hidden) return;
      try {
        const next = await fetchPage(null);
        setPage((current) => ({ ...next, items: current.items.length > next.items.length ? [...next.items, ...current.items.filter((item) => !next.items.some((fresh) => fresh.id === item.id))] : next.items }));
        if (activeId) {
          const response = await fetch(`/api/admin/whatsapp/conversations/${activeId}`, { cache: "no-store" });
          if (response.ok) setView((await response.json()).view);
        }
      } catch { /* tenta de novo no próximo ciclo */ }
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [fetchPage, activeId]);

  function syncUrl(id: string | null) {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("c", id); else url.searchParams.delete("c");
    window.history.replaceState(null, "", url);
  }

  async function open(id: string) {
    setError(""); setRenaming(false);
    if (!wide) setHistoryState("auto");
    try {
      const response = await fetch(`/api/admin/whatsapp/conversations/${id}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Não foi possível abrir a conversa."); return; }
      setView(data.view); syncUrl(id);
    } catch { setError("Não foi possível conectar ao servidor."); }
  }

  async function act(action: "pause" | "resume" | "resolve" | "rename" | "internal" | "external", title?: string) {
    if (!activeId) return;
    setError("");
    try {
      const response = await fetch(`/api/admin/whatsapp/conversations/${activeId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, title }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Não foi possível atualizar."); return; }
      setView(data.view);
      setPage(await fetchPage(null));
    } catch { setError("Não foi possível conectar ao servidor."); }
  }

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const text = reply.trim();
    if (!text || !activeId || sending) return;
    setSending(true); setError("");
    try {
      const response = await fetch(`/api/admin/whatsapp/conversations/${activeId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Não foi possível enviar."); return; }
      setView(data.view); setReply("");
      setPage(await fetchPage(null));
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setSending(false); inputRef.current?.focus(); }
  }

  async function loadMore() {
    if (!page.nextCursor) return;
    setLoadingMore(true);
    try { const next = await fetchPage(page.nextCursor); setPage((current) => ({ ...next, items: [...current.items, ...next.items] })); } catch { /* tenta de novo */ } finally { setLoadingMore(false); }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } };
  const conversation = view?.conversation;
  const subtitle = conversation ? [audienceLabel(conversation), conversation.isGroup ? (conversation.internalGroup ? "grupo interno da equipe" : "") : phoneLabel(conversation.contactPhone), conversation.pausedUntil ? `IA pausada até ${dayTime.format(new Date(conversation.pausedUntil))}` : "IA respondendo"].filter(Boolean).join(" · ") : "Conversas da Pace Lab no WhatsApp";
  const menu = useMemo(() => conversation ? [
    conversation.pausedUntil ? { label: "Retomar a IA", icon: "chat" as const, onSelect: () => act("resume") } : { label: "Pausar a IA nesta conversa", icon: "close" as const, onSelect: () => act("pause") },
    ...(conversation.needsHuman ? [{ label: "Marcar como atendido", icon: "check" as const, onSelect: () => act("resolve") }] : []),
    { label: "Renomear", icon: "edit" as const, onSelect: () => setRenaming(true) },
    ...(conversation.isGroup && isAdmin ? [conversation.internalGroup ? { label: "Deixar de ser grupo interno", icon: "users" as const, onSelect: () => act("external") } : { label: "Marcar como grupo interno da equipe", icon: "users" as const, onSelect: () => act("internal") }] : []),
  ] : [], [conversation, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="ai wa" data-history={historyState}>
      <aside className="ai-history" id="wa-history" aria-label="Conversas do WhatsApp" aria-hidden={!historyVisible} inert={!historyVisible}>
        <div className="ai-history-head">
          <nav className="ai-tabs" aria-label="Assistente"><Link href="/admin/assistente">Minhas conversas</Link><Link href="/admin/assistente/whatsapp" aria-current="page">WhatsApp</Link></nav>
          <button className="ai-icon-btn ai-history-close" type="button" aria-label="Fechar lista" onClick={() => { setHistoryState("auto"); toggleRef.current?.focus(); }}><Icon name="close" /></button>
        </div>
        <div className="ai-history-search">
          <Icon name="search" />
          <input type="search" aria-label="Buscar conversas do WhatsApp" placeholder="Buscar nome ou número" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <div className="wa-filters" role="group" aria-label="Filtro">
          <button type="button" aria-pressed={filter === "todas"} onClick={() => setFilter("todas")}>Todas</button>
          <button type="button" aria-pressed={filter === "atendimento"} onClick={() => setFilter("atendimento")}>Pedem atendimento{page.needsHumanCount ? <span className="wa-count">{page.needsHumanCount}</span> : null}</button>
        </div>
        <div className="ai-history-scroll">
          <ul className="wa-list">
            {page.items.map((item) => (
              <li key={item.id}>
                <button className="wa-item" type="button" aria-current={item.id === activeId ? "true" : undefined} onClick={() => open(item.id)}>
                  <span className="wa-item-top"><strong>{item.title || phoneLabel(item.contactPhone) || "Contato"}</strong><time dateTime={item.lastMessageAt}>{shortDate(item.lastMessageAt)}</time></span>
                  <span className="wa-item-preview">{plain(item.preview) || "Sem mensagens"}</span>
                  <span className="wa-item-tags"><span className="wa-tag" data-audience={item.isGroup ? "GROUP" : item.audience}>{audienceLabel(item)}</span>{item.needsHuman ? <span className="wa-tag" data-tone="alert">Pede atendimento</span> : null}{item.pausedUntil ? <span className="wa-tag">IA pausada</span> : null}</span>
                </button>
              </li>
            ))}
          </ul>
          {!page.items.length ? <p className="ai-history-empty">{query || filter === "atendimento" ? "Nenhuma conversa encontrada." : "As conversas do WhatsApp aparecem aqui."}</p> : null}
          {page.nextCursor ? <button className="btn btn-quiet ai-history-more" type="button" onClick={loadMore} disabled={loadingMore} aria-busy={loadingMore}>{loadingMore ? "Carregando..." : "Carregar mais"}</button> : null}
        </div>
      </aside>
      <button className="ai-scrim" type="button" tabIndex={-1} aria-hidden="true" onClick={() => setHistoryState("auto")} />

      <section className="ai-main" aria-labelledby="wa-title">
        <header className="ai-head">
          <button ref={toggleRef} className="ai-icon-btn ai-head-btn" type="button" aria-label={historyVisible ? "Esconder lista" : "Mostrar conversas"} aria-expanded={historyVisible} aria-controls="wa-history" title="Conversas" onClick={() => (wide ? setHistoryState((state) => (state === "closed" ? "auto" : "closed")) : setHistoryState((state) => (state === "open" ? "auto" : "open")))}><Icon name="menu" /></button>
          <div className="ai-head-copy">
            {conversation && renaming ? (
              <input className="ai-rename" autoFocus defaultValue={conversation.title ?? ""} aria-label="Novo nome da conversa" maxLength={80} onBlur={(event) => { setRenaming(false); if (event.target.value.trim() && event.target.value.trim() !== conversation.title) void act("rename", event.target.value.trim()); }} onKeyDown={(event) => { if (event.key === "Enter") (event.target as HTMLInputElement).blur(); if (event.key === "Escape") setRenaming(false); }} />
            ) : <h1 className="ai-title" id="wa-title">{conversation ? conversation.title || phoneLabel(conversation.contactPhone) || "Contato" : "WhatsApp"}</h1>}
            <p>{subtitle}</p>
          </div>
          {conversation ? <MenuButton label="Opções da conversa" items={menu} /> : null}
        </header>

        {!conversation ? (
          <div className="ai-start">
            <div className="ai-start-inner">
              <span className="ai-mark" aria-hidden="true"><Icon name="chat" /></span>
              <h2 className="ai-greeting">WhatsApp da Pace Lab.</h2>
              <p className="ai-intro">{connected ? "Acompanhe o que a IA conversa com leads, alunos e a equipe. Quem pede atendimento humano aparece em destaque; responda daqui ou pelo celular, e a IA se afasta daquela conversa." : "O WhatsApp ainda não está conectado. Um administrador configura em Integrações › WhatsApp."}</p>
              {page.needsHumanCount ? <button className="btn btn-primary" type="button" onClick={() => { setFilter("atendimento"); setHistoryState(wide ? "auto" : "open"); }}><Icon name="alert" />{page.needsHumanCount} {page.needsHumanCount === 1 ? "conversa pede" : "conversas pedem"} atendimento</button> : null}
            </div>
          </div>
        ) : (
          <>
            <div className="ai-thread" ref={threadRef}>
              {conversation.needsHuman ? <div className="wa-banner"><Icon name="alert" /><span><strong>Pediu atendimento humano.</strong> {conversation.needsHumanReason ?? ""}</span><button className="btn btn-quiet" type="button" onClick={() => act("resolve")}>Marcar como atendido</button></div> : null}
              <ol className="ai-items">
                {view.messages.map((message) => {
                  const outgoing = message.role === "ASSISTANT";
                  const who = outgoing ? (message.kind === "human" ? `Equipe${message.authorName ? ` · ${message.authorName.split(" ")[0]}` : ""}` : assistantName ? `${assistantName} · IA` : "IA") : message.authorName ?? "Contato";
                  return (
                    <li className="ai-msg wa-msg" data-role={outgoing ? "out" : "in"} data-kind={message.kind ?? (outgoing ? "ai" : undefined)} key={message.id}>
                      <span className="wa-author">{who}</span>
                      <div className="wa-bubble">{plain(message.content)}</div>
                      <span className="ai-meta">{dayTime.format(new Date(message.createdAt))}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
            <div className="ai-dock">
              {error ? <p className="message ai-error" data-tone="danger" role="alert"><Icon name="alert" /><span>{error}</span></p> : null}
              <form className="ai-composer" data-variant="dock" onSubmit={send}>
                <label className="visually-hidden" htmlFor="wa-reply">Responder como equipe</label>
                <textarea id="wa-reply" ref={inputRef} className="ai-input" rows={1} value={reply} maxLength={4000} placeholder={connected ? "Responder como equipe (a IA pausa nesta conversa)" : "WhatsApp desconectado"} disabled={!connected} onChange={(event) => setReply(event.target.value)} onKeyDown={onKeyDown} />
                <button className="ai-send" type="submit" disabled={!connected || sending || !reply.trim()} aria-label="Enviar pelo WhatsApp"><Icon name="arrowUp" /></button>
              </form>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
