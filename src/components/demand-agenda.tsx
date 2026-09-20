"use client";

import Link from "next/link";
import { useState } from "react";

type AgendaDemand = { id: string; title: string; scheduledAt: Date; workArea: { id: string; name: string } };
const colors = ["#e15d37", "#31523e", "#a47a27", "#5c6874", "#80596b", "#477287"];

export function DemandAgenda({ month, previous, next, demands }: { month: Date; previous: string; next: string; demands: AgendaDemand[] }) {
  const [visible, setVisible] = useState(false);
  const year = month.getUTCFullYear(); const monthIndex = month.getUTCMonth();
  const title = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "America/Maceio" }).format(month);
  const firstWeekday = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay(); const days = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const areas = [...new Map(demands.map((demand) => [demand.workArea.id, demand.workArea])).values()];
  const color = (id: string) => colors[areas.findIndex((area) => area.id === id) % colors.length];
  const eventsFor = (day: number) => demands.filter((demand) => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Maceio", day: "numeric" }).format(demand.scheduledAt)) === day);

  return <section className={`demand-agenda ${visible ? "" : "is-collapsed"}`}><div className="demand-agenda-heading"><div><p className="eyebrow">Agenda</p><h2>{visible ? `Compromissos de ${title}` : "Agenda de compromissos"}</h2>{visible ? <p>Os pontos indicam as áreas com demandas agendadas em cada dia.</p> : <p>{demands.length} compromisso(s) agendado(s) em {title}.</p>}</div><div className="demand-agenda-actions"><button type="button" className="agenda-toggle" onClick={() => setVisible((current) => !current)} aria-expanded={visible}>{visible ? "Ocultar agenda" : "Exibir agenda"}</button>{visible ? <nav><Link href={`/admin/demandas?month=${previous}`}>←</Link><Link href={`/admin/demandas?month=${next}`}>→</Link></nav> : null}</div></div>{visible ? <><div className="agenda-legend">{areas.length ? areas.map((area) => <span key={area.id}><i style={{ background: color(area.id) }} />{area.name}</span>) : <span>Sem compromissos neste mês.</span>}</div><div className="agenda-weekdays">{["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => <span key={day}>{day}</span>)}</div><div className="agenda-calendar">{Array.from({ length: firstWeekday }, (_, index) => <div className="agenda-day empty" key={`empty-${index}`} />)}{Array.from({ length: days }, (_, index) => { const day = index + 1; const events = eventsFor(day); return <div className="agenda-day" key={day}><strong>{day}</strong><div className="agenda-points">{events.slice(0, 5).map((event) => <Link href={`/admin/demandas/${event.workArea.id}`} title={`${event.workArea.name}: ${event.title}`} key={event.id} style={{ background: color(event.workArea.id) }} />)}</div>{events.length ? <small>{events.length} {events.length === 1 ? "compromisso" : "compromissos"}</small> : null}</div>; })}</div></> : null}</section>;
}
