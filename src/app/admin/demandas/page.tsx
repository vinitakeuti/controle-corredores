import Link from "next/link";
import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { DemandAgenda } from "@/components/demand-agenda";
import { WorkAreaManager } from "@/components/work-area-manager";
import { requireStaff } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DemandsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireStaff();
  const requested = (await searchParams).month?.match(/^(\d{4})-(\d{2})$/); const now = new Date(); const year = requested ? Number(requested[1]) : now.getFullYear(); const month = requested ? Number(requested[2]) - 1 : now.getMonth();
  const from = new Date(Date.UTC(year, month, 1, 3)); const to = new Date(Date.UTC(year, month + 1, 1, 3) - 1);
  const [areas, demands] = await Promise.all([prisma.workArea.findMany({ where: { members: { some: { userId: user.id } } }, include: { _count: { select: { demands: true } } }, orderBy: [{ type: "asc" }, { name: "asc" }] }), prisma.demand.findMany({ where: { archivedAt: null, scheduledAt: { gte: from, lte: to }, workArea: { members: { some: { userId: user.id } } } }, select: { id: true, title: true, scheduledAt: true, workArea: { select: { id: true, name: true } } } })]);
  const previous = new Date(Date.UTC(year, month - 1, 1)); const next = new Date(Date.UTC(year, month + 1, 1)); const key = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  return <AppShell user={user} current="demands"><header className="page-heading demands-page-heading"><div><p className="eyebrow">Demandas</p><h1>Áreas de trabalho.</h1><p>Organize as atividades e acompanhe os compromissos de cada área.</p></div>{user.role === UserRole.ADMIN ? <WorkAreaManager /> : null}</header><DemandAgenda month={from} previous={key(previous)} next={key(next)} demands={demands.filter((demand): demand is typeof demand & { scheduledAt: Date } => Boolean(demand.scheduledAt))} /><section className="work-area-grid">{areas.length ? areas.map((area) => <Link className="work-area-link" href={`/admin/demandas/${area.id}`} key={area.id}><span>{area.type === "GENERAL" ? "Geral" : "Setor"}</span><strong>{area.name}</strong><small>{area._count.demands} {area._count.demands === 1 ? "demanda" : "demandas"}</small><i>→</i></Link>) : <div className="empty-state">Ainda não há áreas. Um administrador pode criar a primeira área de trabalho.</div>}</section></AppShell>;
}
