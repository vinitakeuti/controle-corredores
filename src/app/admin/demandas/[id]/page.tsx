import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { DemandBoard } from "@/components/demand-board";
import { requireStaff } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DemandAreaPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaff(); const { id } = await params;
  const [area, people] = await Promise.all([prisma.workArea.findFirst({ where: { id, members: { some: { userId: user.id } } }, include: { members: { include: { user: { select: { id: true, name: true, email: true } } } }, columns: { orderBy: { position: "asc" } }, demands: { include: { assignees: { include: { user: { select: { id: true, name: true, email: true } } } } }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] } } }), prisma.user.findMany({ where: { active: true, role: { in: [UserRole.ADMIN, UserRole.OPERATOR] } }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } })]);
  if (!area) notFound();
  const demands = area.demands.map((demand) => ({ ...demand, scheduledAt: demand.scheduledAt?.toISOString() ?? null }));
  return <AppShell user={user} current="demands"><div className="page-back"><Link href="/admin/demandas">← Áreas de trabalho</Link></div><DemandBoard key={area.id} areaId={area.id} areaName={area.name} initialColumns={area.columns} initialDemands={demands} people={people} initialMembers={area.members.map((member) => member.user)} canManageMembers={user.role === UserRole.ADMIN} /></AppShell>;
}
