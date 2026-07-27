"use client";

import { useMemo, useState } from "react";
import type { AppmaxIntegrationSummary } from "@/lib/appmax-integration";
import type { IntegrationDirectory, IntegrationDirectoryItem, IntegrationProviderKey } from "@/lib/integration-directory";
import { AppmaxIntegrationForm } from "@/components/appmax-integration-form";

type Props = {
  initialDirectory: IntegrationDirectory;
  initialAppmaxSummary: AppmaxIntegrationSummary;
};

type Filter = "all" | "payments";

function statusLabel(item: IntegrationDirectoryItem) {
  if (item.active) return "Ativo";
  if (item.configured) return "Configurado";
  if (!item.available) return "Em breve";
  return "Não configurado";
}

function statusClass(item: IntegrationDirectoryItem) {
  if (item.active) return "is-active";
  if (item.configured) return "is-configured";
  if (!item.available) return "is-coming";
  return "is-pending";
}

export function IntegrationCenter({ initialDirectory, initialAppmaxSummary }: Props) {
  const [directory, setDirectory] = useState(initialDirectory);
  const [appmaxSummary, setAppmaxSummary] = useState(initialAppmaxSummary);
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
    setDirectory(nextDirectory as IntegrationDirectory);
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
      setFeedback("Provedor ativo atualizado. O checkout usará esta conexão.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível ativar o provedor.");
    } finally {
      setPendingProvider(null);
    }
  };

  const appmax = directory.items.find((item) => item.provider === "APPMAX");

  return (
    <div className="integrations-page">
      <header className="integrations-center-heading">
        <div>
          <p className="eyebrow">Configurações</p>
          <h1>Central de integrações</h1>
          <p>Gerencie gateways, credenciais e o provedor responsável pelos pagamentos.</p>
        </div>
        <div className="integration-access-note"><span className="integration-status-dot" /> Somente administradores</div>
      </header>

      <div className="integration-center-layout">
        <aside className="integration-catalog-sidebar" aria-label="Filtros de integrações">
          <label className="integration-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar integração..." aria-label="Buscar integração" /></label>
          <p className="integration-sidebar-label">Filtros</p>
          <button className={`integration-filter ${filter === "all" ? "active" : ""}`} type="button" onClick={() => setFilter("all")}><span aria-hidden="true">▦</span> Todos os apps <strong>{directory.items.length}</strong></button>
          <button className={`integration-filter ${filter === "payments" ? "active" : ""}`} type="button" onClick={() => setFilter("payments")}><span aria-hidden="true">▣</span> Gateways &amp; vendas <strong>{directory.items.filter((item) => item.category === "Gateways & vendas").length}</strong></button>

          <div className="integration-sidebar-divider" />
          <p className="integration-sidebar-label">Ativa</p>
          {directory.activeProvider ? <div className="integration-active-provider"><span className="integration-mini-mark">{directory.items.find((item) => item.provider === directory.activeProvider)?.abbreviation ?? "•"}</span><span>{directory.items.find((item) => item.provider === directory.activeProvider)?.name ?? directory.activeProvider}</span><i /></div> : <p className="integration-sidebar-empty">Nenhum provedor ativo.</p>}
          <p className="integration-sidebar-label integration-sidebar-bottom-label">Opções gerais</p>
          <div className="integration-general-option"><span>▤</span> Logs de webhook</div>
          <div className="integration-general-option muted"><span>⚙</span> Manutenção do BD</div>
        </aside>

        <main className="integration-directory">
          <div className="integration-directory-heading"><div><h2>Diretório de aplicativos ({directory.items.length})</h2><p>Conexões disponíveis para o controle financeiro da assessoria.</p></div><span>Mostrando {items.length} de {directory.items.length}</span></div>
          {feedback ? <p className="integration-center-feedback" role="status">{feedback}</p> : null}
          <div className="integration-app-grid">
            {items.map((item) => <article className={`integration-app-card ${item.active ? "active" : ""}`} key={item.provider}>
              <div className="integration-app-card-top"><div className={`integration-app-icon ${item.provider === "APPMAX" ? "appmax" : "placeholder"}`}>{item.abbreviation}</div><span className={`integration-card-status ${statusClass(item)}`}><i />{statusLabel(item)}</span></div>
              <div className="integration-app-card-copy"><h3>{item.name}</h3><p className="integration-app-category">{item.category}</p><p>{item.description}</p></div>
              <div className="integration-app-card-actions">{item.available ? <button className="integration-manage-link" type="button" onClick={() => setSelectedProvider(item.provider)}>{item.configured ? "Gerenciar" : "Configurar"} <span aria-hidden="true">→</span></button> : <span className="integration-coming-link">Disponível em breve</span>}{item.configured && !item.active ? <button className="integration-activate-link" type="button" onClick={() => activate(item.provider)} disabled={pendingProvider !== null}>{pendingProvider === item.provider ? "Ativando..." : "Ativar"}</button> : null}</div>
            </article>)}
          </div>

          {selectedProvider === "APPMAX" && appmax ? <section className="integration-config-panel" aria-labelledby="integration-config-title">
            <div className="integration-config-panel-heading"><div><button className="integration-back-link" type="button" onClick={() => setSelectedProvider(null)}>← Voltar ao diretório</button><p className="eyebrow">Configuração do provedor</p><h2 id="integration-config-title">Appmax</h2><p>Atualize credenciais e preferências sem sair da central.</p></div><span className={`integration-card-status ${statusClass(appmax)}`}><i />{statusLabel(appmax)}</span></div>
            <AppmaxIntegrationForm embedded initialSummary={appmaxSummary} onSummaryChange={(nextSummary) => { setAppmaxSummary(nextSummary); void refreshDirectory(); }} />
          </section> : null}
        </main>
      </div>
    </div>
  );
}
