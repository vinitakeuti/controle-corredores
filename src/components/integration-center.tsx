"use client";

import { useState } from "react";
import type { AsaasIntegrationSummary } from "@/lib/asaas-integration";
import type { AppmaxIntegrationSummary } from "@/lib/appmax-integration";
import type { IntegrationDirectory, IntegrationDirectoryItem, IntegrationProviderKey } from "@/lib/integration-directory";
import { AiIntegrationForm, aiConnectionStatus, type AiConnection } from "@/components/ai-integration-form";
import { AsaasIntegrationForm } from "@/components/asaas-integration-form";
import { AppmaxIntegrationForm } from "@/components/appmax-integration-form";
import { Feedback } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill, type Tone } from "@/components/ui/status-pill";

export type IntegrationKey = "APPMAX" | "ASAAS" | "OPENROUTER";

type Props = {
  initialDirectory: IntegrationDirectory;
  initialAppmaxSummary: AppmaxIntegrationSummary;
  initialAsaasSummary: AsaasIntegrationSummary;
  initialAi: AiConnection | null;
  initialSelected: IntegrationKey | null;
};

const ACTIVATED = "Provedor ativo atualizado. O checkout usará esta conexão.";
const appParam: Record<IntegrationKey, string> = { APPMAX: "appmax", ASAAS: "asaas", OPENROUTER: "openrouter" };

function paymentStatus(item: IntegrationDirectoryItem): { label: string; tone: Tone } {
  if (item.active) return { label: "Ativo", tone: "positive" };
  if (item.configured) return { label: "Configurado", tone: "info" };
  return { label: "Não configurado", tone: "neutral" };
}

// Uma linha do diretório: marca, nome, o que faz, situação e ações. Igual para todas as categorias.
function ProviderRow({ mark, name, description, status, active, children }: { mark: string; name: string; description: string; status: { label: string; tone: Tone }; active?: boolean; children?: React.ReactNode }) {
  return (
    <li className="provider-row" data-active={active || undefined}>
      <span className="provider-mark" aria-hidden="true">{mark}</span>
      <span className="provider-copy"><strong>{name}</strong><span>{description}</span></span>
      <StatusPill tone={status.tone}>{status.label}</StatusPill>
      <span className="btn-row provider-row-actions">{children}</span>
    </li>
  );
}

function CategorySection({ id, title, lead, children }: { id: string; title: string; lead: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="section-block integration-category" aria-labelledby={id}>
      <div className="section-head"><div><h2 className="section-title" id={id}>{title}</h2><p className="section-lead">{lead}</p></div></div>
      <ul className="provider-list">{children}</ul>
    </section>
  );
}

export function IntegrationCenter({ initialDirectory, initialAppmaxSummary, initialAsaasSummary, initialAi, initialSelected }: Props) {
  const [directory, setDirectory] = useState(initialDirectory);
  const [appmaxSummary, setAppmaxSummary] = useState(initialAppmaxSummary);
  const [asaasSummary, setAsaasSummary] = useState(initialAsaasSummary);
  const [ai, setAi] = useState(initialAi);
  const [selected, setSelectedState] = useState<IntegrationKey | null>(initialSelected && (initialSelected !== "OPENROUTER" || initialAi) ? initialSelected : null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pendingProvider, setPendingProvider] = useState<IntegrationProviderKey | null>(null);

  // O painel aberto fica na URL (?app=...), para recarregar ou compartilhar o link direto.
  function select(key: IntegrationKey | null) {
    setSelectedState(key);
    setFeedback(null);
    const url = new URL(window.location.href);
    if (key) url.searchParams.set("app", appParam[key]); else url.searchParams.delete("app");
    window.history.replaceState(null, "", url);
    window.scrollTo({ top: 0 });
  }

  const refreshDirectory = async () => {
    const response = await fetch("/api/admin/integrations", { headers: { Accept: "application/json" }, cache: "no-store" });
    const nextDirectory = await response.json();
    if (!response.ok) throw new Error(typeof nextDirectory.error === "string" ? nextDirectory.error : "Não foi possível atualizar os provedores.");
    const normalizedDirectory = nextDirectory as IntegrationDirectory;
    setDirectory(normalizedDirectory);
    setAppmaxSummary((current) => current.integration ? { ...current, active: normalizedDirectory.activeProvider === "APPMAX" } : current);
    setAsaasSummary((current) => current.integration ? { ...current, active: normalizedDirectory.activeProvider === "ASAAS" } : current);
  };

  const activate = async (provider: IntegrationProviderKey) => {
    setPendingProvider(provider);
    setFeedback(null);
    try {
      const response = await fetch("/api/admin/integrations", { method: "PATCH", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ provider }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Não foi possível ativar o provedor.");
      setDirectory(body as IntegrationDirectory);
      setAppmaxSummary((current) => current.integration ? { ...current, active: provider === "APPMAX" } : current);
      setAsaasSummary((current) => current.integration ? { ...current, active: provider === "ASAAS" } : current);
      setFeedback(ACTIVATED);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível ativar o provedor.");
    } finally {
      setPendingProvider(null);
    }
  };

  // "Outro provedor" era só um espaço reservado: some do diretório.
  const payments = directory.items.filter((item) => item.provider === "APPMAX" || item.provider === "ASAAS");
  const appmax = payments.find((item) => item.provider === "APPMAX");
  const asaas = payments.find((item) => item.provider === "ASAAS");
  const activePayment = payments.find((item) => item.active);
  const feedbackIsError = feedback !== null && feedback !== ACTIVATED;

  const panel = (key: IntegrationKey, title: string, lead: string, status: { label: string; tone: Tone }, form: React.ReactNode) => (
    <section className="section-block provider-panel" aria-labelledby="integration-config-title">
      <button className="btn btn-quiet provider-back" type="button" onClick={() => select(null)}><Icon name="arrowLeft" />Todas as integrações</button>
      <div className="section-head"><div><h2 className="section-title" id="integration-config-title">{title}</h2><p className="section-lead">{lead}</p></div><StatusPill tone={status.tone}>{status.label}</StatusPill></div>
      {form}
    </section>
  );

  return (
    <div className="integrations">
      <PageHeader context={{ label: "Conexões" }} title="Integrações." lead="Pagamentos, inteligência artificial e mensagens da Pace Lab em um só lugar." />

      {selected === "APPMAX" && appmax ? panel("APPMAX", "Appmax", "Atualize credenciais e preferências sem sair da central.", paymentStatus(appmax),
        <AppmaxIntegrationForm embedded initialSummary={appmaxSummary} onSummaryChange={(nextSummary) => { setAppmaxSummary(nextSummary); void refreshDirectory(); }} />)
      : selected === "ASAAS" && asaas ? panel("ASAAS", "Asaas", "Configure a chave da API e a autenticação do webhook.", paymentStatus(asaas),
        <AsaasIntegrationForm embedded initialSummary={asaasSummary} onSummaryChange={(nextSummary) => { setAsaasSummary(nextSummary); void refreshDirectory(); }} />)
      : selected === "OPENROUTER" && ai ? panel("OPENROUTER", "OpenRouter", "Conecte o assistente de IA da gestão e escolha o modelo.", aiConnectionStatus(ai),
        <AiIntegrationForm initial={ai} onChange={setAi} />)
      : <>
        <Feedback success={feedback && !feedbackIsError ? feedback : undefined} error={feedbackIsError ? feedback : undefined} />

        <CategorySection id="integration-payments" title="Pagamentos" lead={activePayment ? <>Provedor ativo: <strong>{activePayment.name}</strong>. O checkout usa esta conexão.</> : "Nenhum provedor ativo: o checkout fica indisponível até você ativar um."}>
          {payments.map((item) => (
            <ProviderRow key={item.provider} mark={item.abbreviation} name={item.name} description={item.description} status={paymentStatus(item)} active={item.active}>
              {item.configured && !item.active ? <button className="btn btn-secondary" type="button" onClick={() => activate(item.provider)} disabled={pendingProvider !== null} aria-busy={pendingProvider === item.provider}>{pendingProvider === item.provider ? "Ativando..." : "Ativar"}</button> : null}
              <button className="btn btn-secondary" type="button" onClick={() => select(item.provider as IntegrationKey)}>{item.configured ? "Gerenciar" : "Configurar"}<Icon name="chevronRight" className="icon-sm" /></button>
            </ProviderRow>
          ))}
        </CategorySection>

        {ai ? (
          <CategorySection id="integration-ai" title="Inteligência artificial" lead="O assistente da gestão conversa com a equipe e consulta os dados conforme a permissão de cada pessoa.">
            <ProviderRow mark="OR" name="OpenRouter" description={ai.modelName ? `Assistente da gestão · ${ai.modelName}` : "Acesso aos modelos Claude, GPT, Gemini e outros com uma chave só."} status={aiConnectionStatus(ai)} active={ai.enabled}>
              <button className="btn btn-secondary" type="button" onClick={() => select("OPENROUTER")}>{ai.hasApiKey ? "Gerenciar" : "Configurar"}<Icon name="chevronRight" className="icon-sm" /></button>
            </ProviderRow>
          </CategorySection>
        ) : null}

        <CategorySection id="integration-messages" title="Mensagens" lead="Atendimento pelo WhatsApp com o assistente, para leads e alunos.">
          <ProviderRow mark="WA" name="WhatsApp · Evolution API" description="Responde leads e alunos e recebe pedidos da equipe em grupos." status={{ label: "Em breve", tone: "neutral" }} />
        </CategorySection>
      </>}
    </div>
  );
}
