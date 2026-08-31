import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { CollaboratorsManager } from "@/components/collaborators-manager";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function SettingsPage() {
  const user = await requireRole(UserRole.ADMIN);
  const collaborators = await prisma.user.findMany({ where: { role: { in: [UserRole.ADMIN, UserRole.OPERATOR] } }, select: { id: true, name: true, email: true, role: true, active: true, joinedAt: true }, orderBy: [{ role: "asc" }, { name: "asc" }] });
  return <AppShell user={user} current="settings"><header className="page-heading"><div><p className="eyebrow">Administração</p><h1>Configurações.</h1><p>Gerencie os acessos da equipe Pace Lab.</p></div></header><CollaboratorsManager initialCollaborators={collaborators.map((collaborator) => ({ ...collaborator, role: collaborator.role as "ADMIN" | "OPERATOR" }))} /></AppShell>;
}
