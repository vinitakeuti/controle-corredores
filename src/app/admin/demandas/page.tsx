import Link from "next/link";
import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { DemandAgenda } from "@/components/demand-agenda";
import { WorkAreaManager } from "@/components/work-area-manager";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { requireFeature } from "@/lib/auth";
import { maceioDateParts } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DemandsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireFeature("demands");
  const requested = (await searchParams).month?.match(/^(\d{4})-(\d{2})$/); const today = maceioDateParts(); const year = requested ? Number(requested[1]) : today.year; const month = requested ? Number(requested[2]) - 1 : today.month - 1;
  const from = new Date(Date.UTC(year, month, 1, 3)); const to = new Date(Date.UTC(year, month + 1, 1, 3) - 1);
  const [areas, demands] = await Promise.all([prisma.workArea.findMany({ where: { members: { some: { userId: user.id } } }, include: { _count: { select: { demands: true } } }, orderBy: [{ type: "asc" }, { name: "asc" }] }), prisma.demand.findMany({ where: { archivedAt: null, scheduledAt: { gte: from, lte: to }, workArea: { members: { some: { userId: user.id } } } }, select: { id: true, title: true, scheduledAt: true, workArea: { select: { id: true, name: true } } } })]);
  const previous = new Date(Date.UTC(year, month - 1, 1)); const next = new Date(Date.UTC(year, month + 1, 1)); const key = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

  return <AppShell user={user} current="demands">
    <PageHeader context={{ label: "Demandas" }} title="Áreas de trabalho." lead="Organize as atividades e acompanhe os compromissos de cada área." actions={user.role === UserRole.ADMIN ? <WorkAreaManager /> : undefined} />
    <DemandAgenda month={from} previous={key(previous)} next={key(next)} demands={demands.filter((demand): demand is typeof demand & { scheduledAt: Date } => Boolean(demand.scheduledAt))} />
    <section className="section-block" aria-labelledby="areas-title">
      <div className="section-head"><div><h2 className="section-title" id="areas-title">Quadros</h2><p className="section-lead">Abra uma área para ver e mover as demandas.</p></div></div>
      {areas.length ? <ul className="choice-list area-list">{areas.map((area) => <li key={area.id}><Link className="choice" href={`/admin/demandas/${area.id}`}>
        <Icon name="board" />
        <span className="choice-copy"><strong>{area.name}</strong><span>{area._count.demands} {area._count.demands === 1 ? "demanda" : "demandas"}</span></span>
        <span className="area-list-end"><StatusPill tone="neutral">{area.type === "GENERAL" ? "Geral" : "Setor"}</StatusPill><Icon name="chevronRight" /></span>
      </Link></li>)}</ul> : <div className="state-empty"><strong>Ainda não há áreas.</strong><p>Um administrador pode criar a primeira área de trabalho.</p></div>}
    </section>
  </AppShell>;
}
