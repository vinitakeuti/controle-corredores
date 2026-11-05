"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";

type AgendaDemand = { id: string; title: string; scheduledAt: Date; workArea: { id: string; name: string } };
// Série de cores das áreas: tons da marca e neutros quentes, distintos entre si.
const colors = ["#c74727", "#31523e", "#8a5a00", "#2f4f63", "#7a4a63", "#5b6661"];
const dayFormat = new Intl.DateTimeFormat("en-US", { timeZone: "America/Maceio", day: "numeric" });
const timeFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Maceio", hour: "2-digit", minute: "2-digit" });
const longDayFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Maceio", weekday: "short", day: "numeric", month: "short" });

export function DemandAgenda({ month, previous, next, demands }: { month: Date; previous: string; next: string; demands: AgendaDemand[] }) {
  const [visible, setVisible] = useState(false);
  const year = month.getUTCFullYear(); const monthIndex = month.getUTCMonth();
  const title = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "America/Maceio" }).format(month);
  const firstWeekday = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay(); const days = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const areas = [...new Map(demands.map((demand) => [demand.workArea.id, demand.workArea])).values()];
  const color = (id: string) => colors[areas.findIndex((area) => area.id === id) % colors.length];
  const eventsFor = (day: number) => demands.filter((demand) => Number(dayFormat.format(demand.scheduledAt)) === day);
  const sorted = [...demands].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  const count = demands.length;

  return <section className="section-block agenda" aria-labelledby="agenda-title">
    <div className="section-head">
      <div>
        <h2 className="section-title" id="agenda-title">{visible ? `Compromissos de ${title}` : "Agenda de compromissos"}</h2>
        <p className="section-lead">{visible ? "Os pontos indicam as áreas com demandas agendadas em cada dia." : `${count} ${count === 1 ? "compromisso agendado" : "compromissos agendados"} em ${title}.`}</p>
      </div>
      <div className="btn-row">
        {visible ? <>
          <Link className="icon-btn agenda-nav" href={`/admin/demandas?month=${previous}`} aria-label="Mês anterior"><Icon name="back" /></Link>
          <Link className="icon-btn agenda-nav" href={`/admin/demandas?month=${next}`} aria-label="Próximo mês"><Icon name="chevronRight" /></Link>
        </> : null}
        <button type="button" className="btn btn-secondary" onClick={() => setVisible((current) => !current)} aria-expanded={visible} aria-controls="agenda-body"><Icon name="calendar" />{visible ? "Ocultar agenda" : "Exibir agenda"}</button>
      </div>
    </div>
    {visible ? <div id="agenda-body">
      <ul className="cal-legend" aria-label="Áreas">{areas.length ? areas.map((area) => <li key={area.id}><i style={{ background: color(area.id) }} aria-hidden="true" />{area.name}</li>) : <li>Sem compromissos neste mês.</li>}</ul>
      <div className="agenda-grid" aria-hidden="true">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => <span className="agenda-weekday" key={day}>{day}</span>)}
        {Array.from({ length: firstWeekday }, (_, index) => <div className="cal-day is-empty" key={`empty-${index}`} />)}
        {Array.from({ length: days }, (_, index) => { const day = index + 1; const events = eventsFor(day); return <div className="cal-day" data-busy={events.length ? "true" : undefined} key={day}>
          <strong>{day}</strong>
          <span className="cal-points">{events.slice(0, 5).map((event) => <Link href={`/admin/demandas/${event.workArea.id}`} title={`${event.workArea.name}: ${event.title}`} key={event.id} style={{ background: color(event.workArea.id) }} tabIndex={-1} />)}</span>
          {events.length ? <small>{events.length} {events.length === 1 ? "compromisso" : "compromissos"}</small> : null}
        </div>; })}
      </div>
      {sorted.length ? <ul className="activity-list agenda-list" aria-label={`Compromissos de ${title}`}>{sorted.map((event) => <li key={event.id}>
        <span className="agenda-list-dot" style={{ background: color(event.workArea.id) }} aria-hidden="true" />
        <span className="activity-copy"><strong>{event.title}</strong><span><Link className="link" href={`/admin/demandas/${event.workArea.id}`}>{event.workArea.name}</Link></span></span>
        <time className="activity-time" dateTime={new Date(event.scheduledAt).toISOString()}>{longDayFormat.format(event.scheduledAt)} · {timeFormat.format(event.scheduledAt)}</time>
      </li>)}</ul> : null}
    </div> : null}
  </section>;
}
