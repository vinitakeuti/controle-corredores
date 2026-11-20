"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Brand } from "@/components/brand";
import { Icon } from "@/components/ui/icon";
import { QrCode } from "@/components/ui/qr-code";

type Status = "active" | "expired" | "closed";
type Plan = { title: string; price: string };
type Props = { id: string; name: string; url: string; expiresAt: string; status: Status; signups: number; plans: Plan[]; onlyCourtesy: boolean };

const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Maceio" });
const POLL_MS = 30_000;

// Tela de PDV do cartão de venda: fica aberta no tablet ou na TV do evento.
// Atualiza sozinha os cadastros e some com o QR quando o prazo acaba ou alguém encerra.
export function SalesCardDisplay({ id, name, url, expiresAt: initialExpiresAt, status: initialStatus, signups: initialSignups, plans, onlyCourtesy }: Props) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt);
  const [signups, setSignups] = useState(initialSignups);
  const [fullscreen, setFullscreen] = useState(false);
  const active = status === "active";

  useEffect(() => {
    let stopped = false;
    async function refresh() {
      try {
        const response = await fetch(`/api/admin/sales-cards/${encodeURIComponent(id)}`, { cache: "no-store" });
        if (!response.ok || stopped) return;
        const data = await response.json() as { status: Status; expiresAt: string; signups: number };
        setStatus(data.status); setExpiresAt(data.expiresAt); setSignups(data.signups);
      } catch { /* sem rede: mantém o último estado e tenta de novo */ }
    }
    const timer = window.setInterval(refresh, POLL_MS);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [id]);

  // Some com o QR no minuto exato do fim, sem esperar a próxima atualização.
  useEffect(() => {
    if (status !== "active") return;
    const remaining = new Date(expiresAt).getTime() - Date.now();
    const timer = window.setTimeout(() => setStatus("expired"), Math.max(0, Math.min(remaining, 2_147_000_000)));
    return () => window.clearTimeout(timer);
  }, [status, expiresAt]);

  // Mantém a tela do tablet acesa enquanto o QR está em exibição.
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const request = () => { navigator.wakeLock.request("screen").then((sentinel) => { lock = sentinel; }).catch(() => {}); };
    const onVisible = () => { if (document.visibilityState === "visible") request(); };
    request();
    document.addEventListener("visibilitychange", onVisible);
    return () => { document.removeEventListener("visibilitychange", onVisible); void lock?.release().catch(() => {}); };
  }, [active]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  }

  return <main className="pdv brand-surface" id="conteudo" data-status={status}>
    <header className="pdv-bar">
      <Brand className="pdv-wordmark" size={84} />
      <div className="pdv-controls">
        <button className="btn btn-quiet pdv-control" type="button" onClick={toggleFullscreen}>{fullscreen ? "Sair da tela cheia" : "Tela cheia"}</button>
        <Link className="btn btn-quiet pdv-control" href="/admin/vendas/cartoes"><Icon name="close" />Fechar exibição</Link>
      </div>
    </header>
    <div className="pdv-stage">
      <div className="pdv-qr">
        {active ? <QrCode value={url} label={`QR Code de cadastro: ${name}`} /> : <div className="pdv-closed" role="status"><strong>QR Code encerrado</strong><span>Fale com a equipe da Pace Lab.</span></div>}
      </div>
      <div className="pdv-copy">
        <p className="pdv-kicker">{name}</p>
        <h1 className="pdv-title">{active ? "Escaneie para entrar na Pace Lab." : "Inscrições encerradas."}</h1>
        {active ? <>
          <ol className="pdv-steps">
            <li><span>1</span>Aponte a câmera do celular</li>
            <li><span>2</span>Escolha seu plano</li>
            <li><span>3</span>{onlyCourtesy ? "Crie seu acesso e pronto" : "Crie seu acesso e pague"}</li>
          </ol>
          <ul className="pdv-plans" aria-label="Planos disponíveis">{plans.map((plan) => <li key={plan.title}><span>{plan.title}</span><strong>{plan.price}</strong></li>)}</ul>
        </> : null}
      </div>
    </div>
    <footer className="pdv-foot" aria-live="polite">
      <span>{active ? `Válido até ${dateTime.format(new Date(expiresAt))}` : `Encerrado em ${dateTime.format(new Date(expiresAt))}`}</span>
      <span>{signups} {signups === 1 ? "cadastro" : "cadastros"}</span>
    </footer>
  </main>;
}
