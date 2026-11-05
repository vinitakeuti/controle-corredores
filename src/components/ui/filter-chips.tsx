import Link from "next/link";

const numberFormat = new Intl.NumberFormat("pt-BR");

export type FilterChip = { key: string; label: string; href: string; count?: number; tone?: "danger" };

// Filtros de um toque (links com URL compartilhável). O ativo usa aria-current.
export function FilterChips({ chips, active, label }: { chips: FilterChip[]; active: string; label: string }) {
  return (
    <nav className="chips" aria-label={label}>
      {chips.map((chip) => (
        <Link key={chip.key} className="chip" data-tone={chip.tone} href={chip.href} aria-current={chip.key === active ? "true" : undefined}>
          {chip.label}{typeof chip.count === "number" ? <span className="chip-count">{numberFormat.format(chip.count)}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
