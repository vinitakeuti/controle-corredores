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
  const [area, people] = await Promise.all([prisma.workArea.findUnique({ where: { id }, include: { demands: { include: { assignees: { include: { user: { select: { id: true, name: true, email: true } } } } }, orderBy: [{ column: "asc" }, { position: "asc" }, { createdAt: "asc" }] } } }), prisma.user.findMany({ where: { active: true, role: { in: [UserRole.ADMIN, UserRole.OPERATOR] } }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } })]);
  if (!area) notFound();
  const demands = area.demands.map((demand) => ({ ...demand, scheduledAt: demand.scheduledAt?.toISOString() ?? null }));
  return <AppShell user={user} current="demands"><div className="page-back"><Link href="/admin/demandas">← Áreas de trabalho</Link></div><DemandBoard areaId={area.id} areaName={area.name} initialDemands={demands} people={people} /></AppShell>;
}
