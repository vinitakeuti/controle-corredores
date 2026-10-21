import Link from "next/link";
import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { CollaboratorsManager } from "@/components/collaborators-manager";
import { EmailLogPanel } from "@/components/email-log-panel";
import { EmailTestingPanel } from "@/components/email-testing-panel";
import { requireRole } from "@/lib/auth";
import { getEmailConfiguration } from "@/lib/email";
import { getEmailLogReport } from "@/lib/email-log";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = { secao?: string; emailMonth?: string; emailStatus?: string; emailType?: string; emailPage?: string };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireRole(UserRole.ADMIN);
  const params = await searchParams;
  const section = params.secao === "emails" ? "emails" : "equipe";
  const tabs = <nav className="settings-tabs" aria-label="Seções de configurações"><Link className={section === "equipe" ? "active" : ""} aria-current={section === "equipe" ? "page" : undefined} href="/admin/configuracoes">Equipe</Link><Link className={section === "emails" ? "active" : ""} aria-current={section === "emails" ? "page" : undefined} href="/admin/configuracoes?secao=emails">E-mails</Link></nav>;

  if (section === "emails") {
    const email = getEmailConfiguration();
    const report = await getEmailLogReport({ month: params.emailMonth, status: params.emailStatus, type: params.emailType, page: params.emailPage });
    return <AppShell user={user} current="settings"><header className="page-heading"><div><p className="eyebrow">Administração</p><h1>Configurações.</h1><p>Teste os modelos e acompanhe cada e-mail disparado pela Pace Lab.</p></div></header>{tabs}<EmailTestingPanel initialRecipient={user.email} configured={email.configured} host={email.host} /><EmailLogPanel report={report} /></AppShell>;
  }

  const collaborators = await prisma.user.findMany({ where: { role: { in: [UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR] } }, select: { id: true, name: true, email: true, role: true, active: true, joinedAt: true, commissionRateBps: true, managerPermissions: true, passwordResetLinkAccess: true }, orderBy: [{ role: "asc" }, { name: "asc" }] });
  return <AppShell user={user} current="settings"><header className="page-heading"><div><p className="eyebrow">Administração</p><h1>Configurações.</h1><p>Gerencie os acessos da equipe Pace Lab.</p></div></header>{tabs}<CollaboratorsManager currentAdminId={user.id} initialCollaborators={collaborators.map((collaborator) => ({ ...collaborator, role: collaborator.role as "ADMIN" | "MANAGER" | "OPERATOR" }))} /></AppShell>;
}
