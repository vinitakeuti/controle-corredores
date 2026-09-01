import Link from "next/link";
import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { WorkAreaManager } from "@/components/work-area-manager";
import { requireStaff } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function DemandsPage() {
  const user = await requireStaff();
  const areas = await prisma.workArea.findMany({ include: { _count: { select: { demands: true } } }, orderBy: [{ type: "asc" }, { name: "asc" }] });
  return <AppShell user={user} current="demands"><header className="page-heading"><div><p className="eyebrow">Demandas</p><h1>Áreas de trabalho.</h1><p>Escolha uma área para organizar as atividades da semana.</p></div></header>{user.role === UserRole.ADMIN ? <section className="panel"><div className="panel-heading"><div><h2>Criar área de trabalho</h2><p>Crie a área geral ou um espaço por setor da equipe.</p></div></div><WorkAreaManager /></section> : null}<section className="work-area-grid">{areas.length ? areas.map((area) => <Link className="work-area-link" href={`/admin/demandas/${area.id}`} key={area.id}><span>{area.type === "GENERAL" ? "Geral" : "Setor"}</span><strong>{area.name}</strong><small>{area._count.demands} {area._count.demands === 1 ? "demanda" : "demandas"}</small><i>→</i></Link>) : <div className="empty-state">Ainda não há áreas. Um administrador pode criar a primeira área de trabalho.</div>}</section></AppShell>;
}
