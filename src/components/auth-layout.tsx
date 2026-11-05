import { Brand } from "@/components/brand";

// Telas de acesso (login, recuperar e redefinir senha): o painel escuro com as faixas diagonais é a
// assinatura da marca; o painel ao lado é a tarefa. O título do painel da marca não é um h1.
export function AuthLayout({ brandTitle, brandLead, children }: { brandTitle: string; brandLead: string; children: React.ReactNode }) {
  return (
    <main className="auth" id="conteudo">
      <section className="auth-brand" aria-label="Pace Lab">
        <Brand className="auth-wordmark" size={104} />
        <div className="auth-brand-copy">
          <p className="auth-brand-kicker">Pace Lab</p>
          <p className="auth-brand-title">{brandTitle}</p>
          <p className="auth-brand-lead">{brandLead}</p>
        </div>
        <small className="auth-brand-foot">PACE LAB · ACADEMIA DO CORREDOR</small>
      </section>
      <section className="auth-panel">
        <div className="auth-panel-inner">{children}</div>
      </section>
    </main>
  );
}

export function AuthHeading({ context, title, lead }: { context: string; title: string; lead: React.ReactNode }) {
  return (
    <header className="auth-heading">
      <p className="context-link">{context}</p>
      <h1 className="display">{title}</h1>
      <p className="page-header-lead">{lead}</p>
    </header>
  );
}
