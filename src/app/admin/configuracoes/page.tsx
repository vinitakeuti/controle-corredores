import Link from "next/link";
import { UserRole } from "@prisma/client";
import { AiAssistantSettings } from "@/components/ai-assistant-settings";
import { AiUsagePanel } from "@/components/ai-usage-panel";
import { TeamWhatsappPanel } from "@/components/team-whatsapp-panel";
import { AiActionsLog } from "@/components/ai-actions-log";
import { getAiActionLog } from "@/lib/ai/audit";
import { canAccessFeature } from "@/lib/access-control";
import { AppShell } from "@/components/app-shell";
import { CollaboratorsManager } from "@/components/collaborators-manager";
import { EmailLogPanel } from "@/components/email-log-panel";
import { EmailTestingPanel } from "@/components/email-testing-panel";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getEmailConfiguration } from "@/lib/email";
import { getEmailLogReport } from "@/lib/email-log";
import { getAiSettingsSummary } from "@/lib/ai/settings";
import { getAiUsageReport } from "@/lib/ai/usage";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = { secao?: string; emailMonth?: string; emailStatus?: string; emailType?: string; emailPage?: string };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireRole(UserRole.ADMIN);
  const params = await searchParams;
  const section = params.secao === "emails" ? "emails" : params.secao === "assistente" ? "assistente" : "equipe";
  const tabs = <nav className="tabs settings-tabs-nav" aria-label="Seções de configurações"><Link aria-current={section === "equipe" ? "page" : undefined} href="/admin/configuracoes">Equipe</Link><Link aria-current={section === "emails" ? "page" : undefined} href="/admin/configuracoes?secao=emails">E-mails</Link><Link aria-current={section === "assistente" ? "page" : undefined} href="/admin/configuracoes?secao=assistente">Assistente IA</Link></nav>;

  if (section === "assistente") {
    const [settings, report, team, actionLog] = await Promise.all([
      getAiSettingsSummary(),
      getAiUsageReport(),
      prisma.user.findMany({ where: { role: { in: [UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR] } }, select: { id: true, name: true, role: true, active: true, assistantWhatsapp: true, managerPermissions: true }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
      getAiActionLog(),
    ]);
    const members = team.map((member) => ({ id: member.id, name: member.name, role: member.role as "ADMIN" | "MANAGER" | "OPERATOR", active: member.active, whatsapp: member.assistantWhatsapp, hasAssistant: canAccessFeature(member, "assistant") }));
    return <AppShell user={user} current="settings"><PageHeader context={{ label: "Administração" }} title="Configurações." lead="Ajuste o que o assistente sabe sobre a Pace Lab e acompanhe quanto ele custa." />{tabs}<AiAssistantSettings initial={{ assistantName: settings.assistantName, generalInstructions: settings.generalInstructions, businessInfo: settings.businessInfo, leadInstructions: settings.leadInstructions, studentInstructions: settings.studentInstructions, staffInstructions: settings.staffInstructions, monthlyBudgetUsd: settings.monthlyBudgetUsd }} /><TeamWhatsappPanel members={members} /><AiUsagePanel report={report} budgetUsd={settings.monthlyBudgetUsd} /><AiActionsLog rows={actionLog} /></AppShell>;
  }

  if (section === "emails") {
    const email = getEmailConfiguration();
    const report = await getEmailLogReport({ month: params.emailMonth, status: params.emailStatus, type: params.emailType, page: params.emailPage });
    return <AppShell user={user} current="settings"><PageHeader context={{ label: "Administração" }} title="Configurações." lead="Teste os modelos e acompanhe cada e-mail disparado pela Pace Lab." />{tabs}<EmailTestingPanel initialRecipient={user.email} configured={email.configured} host={email.host} /><EmailLogPanel report={report} /></AppShell>;
  }

  const collaborators = await prisma.user.findMany({ where: { role: { in: [UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR] } }, select: { id: true, name: true, email: true, role: true, active: true, joinedAt: true, commissionRateBps: true, managerPermissions: true, passwordResetLinkAccess: true }, orderBy: [{ role: "asc" }, { name: "asc" }] });
  return <AppShell user={user} current="settings"><PageHeader context={{ label: "Administração" }} title="Configurações." lead="Gerencie os acessos da equipe Pace Lab." />{tabs}<CollaboratorsManager currentAdminId={user.id} initialCollaborators={collaborators.map((collaborator) => ({ ...collaborator, role: collaborator.role as "ADMIN" | "MANAGER" | "OPERATOR" }))} /></AppShell>;
}
