import Link from "next/link";
import { Icon } from "@/components/ui/icon";

const numberFormat = new Intl.NumberFormat("pt-BR");

// Paginação com faixa visível ("21–40 de 1.240") e alvos de 44px.
export function Pagination({ page, totalPages, total, pageSize, itemLabel, hrefFor, label }: { page: number; totalPages: number; total: number; pageSize: number; itemLabel: string; hrefFor: (page: number) => string; label: string }) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  if (total === 0) return null;
  if (totalPages <= 1) return <p className="pager pager-range">{numberFormat.format(total)} {itemLabel}</p>;
  return (
    <nav className="pager" aria-label={label}>
      <p className="pager-range">{numberFormat.format(from)}–{numberFormat.format(to)} de {numberFormat.format(total)} {itemLabel}</p>
      <div className="pager-actions">
        {page > 1 ? <Link className="btn btn-secondary" href={hrefFor(page - 1)} rel="prev"><Icon name="arrowLeft" />Anterior</Link> : <span className="btn btn-secondary" aria-disabled="true"><Icon name="arrowLeft" />Anterior</span>}
        <span className="pager-status">Página {page} de {totalPages}</span>
        {page < totalPages ? <Link className="btn btn-secondary" href={hrefFor(page + 1)} rel="next">Próxima<Icon name="arrowRight" /></Link> : <span className="btn btn-secondary" aria-disabled="true">Próxima<Icon name="arrowRight" /></span>}
      </div>
    </nav>
  );
}
