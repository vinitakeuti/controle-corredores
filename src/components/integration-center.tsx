"use client";

import { useMemo, useState } from "react";
import type { AsaasIntegrationSummary } from "@/lib/asaas-integration";
import type { AppmaxIntegrationSummary } from "@/lib/appmax-integration";
import type { IntegrationDirectory, IntegrationDirectoryItem, IntegrationProviderKey } from "@/lib/integration-directory";
import { AsaasIntegrationForm } from "@/components/asaas-integration-form";
import { AppmaxIntegrationForm } from "@/components/appmax-integration-form";
import { Feedback } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill, type Tone } from "@/components/ui/status-pill";

type Props = {
  initialDirectory: IntegrationDirectory;
  initialAppmaxSummary: AppmaxIntegrationSummary;
  initialAsaasSummary: AsaasIntegrationSummary;
};

type Filter = "all" | "payments";

function statusLabel(item: IntegrationDirectoryItem) {
  if (item.active) return "Ativo";
  if (item.configured) return "Configurado";
  if (!item.available) return "Em breve";
  return "Não configurado";
}

function statusTone(item: IntegrationDirectoryItem): Tone {
  if (item.active) return "positive";
  if (item.configured) return "info";
  return "neutral";
}

export function IntegrationCenter({ initialDirectory, initialAppmaxSummary, initialAsaasSummary }: Props) {
  const [directory, setDirectory] = useState(initialDirectory);
  const [appmaxSummary, setAppmaxSummary] = useState(initialAppmaxSummary);
  const [asaasSummary, setAsaasSummary] = useState(initialAsaasSummary);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedProvider, setSelectedProvider] = useState<IntegrationProviderKey | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pendingProvider, setPendingProvider] = useState<IntegrationProviderKey | null>(null);

  const items = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return directory.items.filter((item) => {
      const matchesFilter = filter === "all" || item.category === "Gateways & vendas";
      const matchesSearch = !normalizedSearch || `${item.name} ${item.category} ${item.description}`.toLowerCase().includes(normalizedSearch);
      return matchesFilter && matchesSearch;
    });
  }, [directory.items, filter, search]);

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
      const response = await fetch("/api/admin/integrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ provider }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Não foi possível ativar o provedor.");
      setDirectory(body as IntegrationDirectory);
      setAppmaxSummary((current) => current.integration ? { ...current, active: provider === "APPMAX" } : current);
      setAsaasSummary((current) => current.integration ? { ...current, active: provider === "ASAAS" } : current);
      setFeedback("Provedor ativo atualizado. O checkout usará esta conexão.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível ativar o provedor.");
    } finally {
      setPendingProvider(null);
    }
  };

  const appmax = directory.items.find((item) => item.provider === "APPMAX");
  const asaas = directory.items.find((item) => item.provider === "ASAAS");
  const activeItem = directory.items.find((item) => item.provider === directory.activeProvider);
  const paymentCount = directory.items.filter((item) => item.category === "Gateways & vendas").length;
  const feedbackIsError = feedback !== null && feedback !== "Provedor ativo atualizado. O checkout usará esta conexão.";

  return (
    <div className="integrations">
      <PageHeader context={{ label: "Pagamentos" }} title="Central de integrações." lead="Gerencie gateways, credenciais e o provedor responsável pelos pagamentos." actions={<StatusPill tone="neutral">Somente administradores</StatusPill>} />

      {selectedProvider === "APPMAX" && appmax ? <section className="section-block provider-panel" aria-labelledby="integration-config-title">
        <button className="btn btn-quiet provider-back" type="button" onClick={() => setSelectedProvider(null)}><Icon name="arrowLeft" />Voltar ao diretório</button>
        <div className="section-head"><div><h2 className="section-title" id="integration-config-title">Appmax</h2><p className="section-lead">Atualize credenciais e preferências sem sair da central.</p></div><StatusPill tone={statusTone(appmax)}>{statusLabel(appmax)}</StatusPill></div>
        <AppmaxIntegrationForm embedded initialSummary={appmaxSummary} onSummaryChange={(nextSummary) => { setAppmaxSummary(nextSummary); void refreshDirectory(); }} />
      </section> : selectedProvider === "ASAAS" && asaas ? <section className="section-block provider-panel" aria-labelledby="integration-config-title">
        <button className="btn btn-quiet provider-back" type="button" onClick={() => setSelectedProvider(null)}><Icon name="arrowLeft" />Voltar ao diretório</button>
        <div className="section-head"><div><h2 className="section-title" id="integration-config-title">Asaas</h2><p className="section-lead">Configure a chave da API e a autenticação do webhook.</p></div><StatusPill tone={statusTone(asaas)}>{statusLabel(asaas)}</StatusPill></div>
        <AsaasIntegrationForm embedded initialSummary={asaasSummary} onSummaryChange={(nextSummary) => { setAsaasSummary(nextSummary); void refreshDirectory(); }} />
      </section> : <>
        <div className="message integration-active" data-tone={activeItem ? "positive" : "warning"}>
          <Icon name={activeItem ? "check" : "alert"} />
          <span>{activeItem ? <>Provedor ativo: <strong>{activeItem.name}</strong>. O checkout usa esta conexão.</> : "Nenhum provedor ativo."}</span>
        </div>

        <section className="section-block integration-directory-block" aria-labelledby="integration-directory-title">
          <div className="section-head"><div><h2 className="section-title" id="integration-directory-title">Diretório de aplicativos ({directory.items.length})</h2><p className="section-lead">Conexões disponíveis para o controle financeiro da assessoria.</p></div><span className="field-hint">Mostrando {items.length} de {directory.items.length}</span></div>
          <div className="toolbar">
            <div className="search-field integration-search-field"><label className="visually-hidden" htmlFor="integration-search">Buscar integração</label><Icon name="search" /><input className="control" id="integration-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar integração..." /></div>
            <div className="chips integration-filter-chips" role="group" aria-label="Filtros">
              <button className="chip" type="button" aria-pressed={filter === "all"} data-active={filter === "all" || undefined} onClick={() => setFilter("all")}>Todos os apps<span className="chip-count">{directory.items.length}</span></button>
              <button className="chip" type="button" aria-pressed={filter === "payments"} data-active={filter === "payments" || undefined} onClick={() => setFilter("payments")}>Gateways &amp; vendas<span className="chip-count">{paymentCount}</span></button>
            </div>
          </div>
          <Feedback success={feedback && !feedbackIsError ? feedback : undefined} error={feedbackIsError ? feedback : undefined} />
          {items.length ? <ul className="provider-list">
            {items.map((item) => <li className="provider-row" key={item.provider} data-active={item.active || undefined}>
              <span className="provider-mark" aria-hidden="true">{item.abbreviation}</span>
              <span className="provider-copy"><strong>{item.name}</strong><span className="provider-category">{item.category}</span><span>{item.description}</span></span>
              <StatusPill tone={statusTone(item)}>{statusLabel(item)}</StatusPill>
              <span className="btn-row provider-row-actions">
                {item.configured && !item.active ? <button className="btn btn-secondary" type="button" onClick={() => activate(item.provider)} disabled={pendingProvider !== null} aria-busy={pendingProvider === item.provider}>{pendingProvider === item.provider ? "Ativando..." : "Ativar"}</button> : null}
                {item.available ? <button className="btn btn-secondary" type="button" onClick={() => setSelectedProvider(item.provider)}>{item.configured ? "Gerenciar" : "Configurar"}<Icon name="chevronRight" className="icon-sm" /></button> : <span className="field-hint">Disponível em breve</span>}
              </span>
            </li>)}
          </ul> : <div className="state-empty"><strong>Nenhuma integração encontrada.</strong><p>Busque por outro nome ou mostre todos os apps.</p></div>}
        </section>

        <section className="section-block" aria-labelledby="integration-general-title">
          <div className="section-head"><div><h2 className="section-title" id="integration-general-title">Opções gerais</h2></div></div>
          <ul className="integration-general"><li><Icon name="file" />Logs de webhook</li><li><Icon name="settings" />Manutenção do BD</li></ul>
        </section>
      </>}
    </div>
  );
}
