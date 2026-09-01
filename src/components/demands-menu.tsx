"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Area = { id: string; name: string; type: "GENERAL" | "SECTOR" };
export function DemandsMenu({ active, onNavigate }: { active: boolean; onNavigate?: () => void }) {
  const [open, setOpen] = useState(active); const [areas, setAreas] = useState<Area[]>([]);
  useEffect(() => { if (!open || areas.length) return; fetch("/api/demandas/areas").then((response) => response.ok ? response.json() : null).then((data) => setAreas(data?.areas ?? [])).catch(() => undefined); }, [open, areas.length]);
  return <div className={`demands-menu ${open ? "open" : ""}`}><button type="button" className={`nav-link demands-menu-trigger ${active ? "active" : ""}`} onClick={() => setOpen((value) => !value)} aria-expanded={open}>Demandas <span>{open ? "−" : "+"}</span></button>{open ? <div className="demands-menu-panel"><Link href="/admin/demandas" onClick={onNavigate}>Áreas de trabalho</Link>{areas.length ? <div className="demands-menu-areas">{areas.map((area) => <Link href={`/admin/demandas/${area.id}`} key={area.id} onClick={onNavigate}>{area.name}</Link>)}</div> : <small>Nenhuma área criada</small>}</div> : null}</div>;
}
