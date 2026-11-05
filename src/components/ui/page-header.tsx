import Link from "next/link";
import { Icon } from "@/components/ui/icon";

type Context = { label: string; href?: string; current?: string };

// Cabeçalho de página da Pace Lab: linha de contexto (o eyebrow da marca, com função de navegação),
// título condensado em caixa alta terminando em ponto, texto de apoio e ações.
export function PageHeader({ context, title, lead, actions, titleId, tutorialAnchor }: { context?: Context; title: string; lead?: React.ReactNode; actions?: React.ReactNode; titleId?: string; tutorialAnchor?: string }) {
  const contextContent = context ? <>
    {context.href ? <Icon name="back" /> : null}
    <span>{context.label}</span>
    {context.current ? <span className="context-link-current">/ {context.current}</span> : null}
  </> : null;

  return (
    <header className="page-header" data-tutorial-anchor={tutorialAnchor}>
      <div className="page-header-copy">
        {context ? context.href ? <Link className="context-link" href={context.href}>{contextContent}</Link> : <p className="context-link">{contextContent}</p> : null}
        <h1 className="display" id={titleId}>{title}</h1>
        {lead ? <p className="page-header-lead">{lead}</p> : null}
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </header>
  );
}
