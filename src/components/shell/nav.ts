import { UserRole } from "@prisma/client";
import { canAccessFeature } from "@/lib/access-control";
import type { SessionUser } from "@/lib/auth";
import type { IconName } from "@/components/ui/icon";

export type ShellSection = "admin" | "students" | "analysis" | "plans" | "integrations" | "settings" | "student" | "demands" | "sales" | "finance" | "assistant" | "marketing" | "program" | "program-sales" | "program-payouts" | "program-ranking";

export type NavItem = {
  key: ShellSection;
  label: string;
  shortLabel?: string;
  href: string;
  icon: IconName;
  group: "operation" | "commercial" | "marketing" | "finance" | "student" | "program";
  tutorialAnchor?: string;
};

export const navGroupLabels: Record<NavItem["group"], string> = {
  operation: "Operação",
  commercial: "Comercial",
  marketing: "Marketing",
  finance: "Financeiro",
  student: "Aluno",
  program: "Experts & Creators",
};

export const navGroupOrder: NavItem["group"][] = ["operation", "commercial", "marketing", "finance", "student", "program"];

// Aluno e parceiro do programa usam o layout simples (menu no topo, sem barra inferior).
export function usesMemberLayout(role: UserRole) {
  return role === UserRole.STUDENT || role === UserRole.PARTNER;
}

// Mesmas regras de visibilidade do menu anterior (app-shell e mobile-nav). Só muda a ordem e o agrupamento.
export function navItemsFor(user: Pick<SessionUser, "role" | "managerPermissions" | "influencer">, assistantName?: string | null): NavItem[] {
  const isOperator = user.role === UserRole.OPERATOR;
  const items: (NavItem | null)[] = [
    canAccessFeature(user, "overview") ? { key: "admin", label: "Visão geral", href: "/admin", icon: "home", group: "operation" } : null,
    canAccessFeature(user, "assistant") ? { key: "assistant", label: assistantName || "Assistente", href: "/admin/assistente", icon: "chat", group: "operation" } : null,
    isOperator || canAccessFeature(user, "demands") ? { key: "demands", label: "Demandas", href: "/admin/demandas", icon: "board", group: "operation" } : null,
    isOperator || canAccessFeature(user, "students") ? { key: "students", label: "Alunos", href: "/admin/alunos", icon: "users", group: "operation", tutorialAnchor: "nav-students" } : null,
    isOperator || canAccessFeature(user, "analysis") ? { key: "analysis", label: "Analisar dados", shortLabel: "Analisar", href: "/admin/analisar", icon: "chart", group: "operation" } : null,
    isOperator || canAccessFeature(user, "sales") ? { key: "sales", label: "Vendas", href: "/admin/vendas", icon: "tag", group: "commercial" } : null,
    canAccessFeature(user, "plans") ? { key: "plans", label: "Planos", href: "/admin/planos", icon: "layers", group: "commercial", tutorialAnchor: "nav-plans" } : null,
    canAccessFeature(user, "marketing") ? { key: "marketing", label: "Experts & Creators", shortLabel: "Creators", href: "/admin/marketing/creators", icon: "megaphone", group: "marketing" } : null,
    canAccessFeature(user, "finance") ? { key: "finance", label: "Financeiro", href: "/admin/financeiro", icon: "wallet", group: "finance" } : null,
    canAccessFeature(user, "integrations") ? { key: "integrations", label: "Integrações", href: "/admin/integracoes", icon: "plug", group: "finance" } : null,
    user.role === UserRole.STUDENT ? { key: "student", label: "Minha assinatura", href: "/aluno", icon: "wallet", group: "student", tutorialAnchor: "nav-student" } : null,
    ...(user.influencer && usesMemberLayout(user.role) ? [
      { key: "program", label: "Minha área", href: "/programa", icon: "home", group: "program" },
      { key: "program-sales", label: "Minhas vendas", href: "/programa/vendas", icon: "chart", group: "program" },
      { key: "program-payouts", label: "Repasses", href: "/programa/repasses", icon: "wallet", group: "program" },
      { key: "program-ranking", label: "Ranking", href: "/programa/ranking", icon: "trophy", group: "program" },
    ] satisfies NavItem[] : []),
  ];
  return items.filter((item): item is NavItem => item !== null);
}

export function homeHrefFor(role: UserRole) {
  return role === UserRole.STUDENT ? "/aluno" : role === UserRole.PARTNER ? "/programa" : role === UserRole.OPERATOR ? "/admin/alunos" : "/admin";
}

export function roleLabel(role: UserRole) {
  return role === UserRole.ADMIN ? "Administrador" : role === UserRole.MANAGER ? "Gerente" : role === UserRole.OPERATOR ? "Operador" : role === UserRole.PARTNER ? "Expert & Creator" : "Aluno";
}

// Prioridade na barra inferior do celular: as quatro primeiras áreas permitidas.
const tabPriority: ShellSection[] = ["admin", "demands", "assistant", "sales", "students", "analysis", "finance", "plans", "marketing", "integrations"];

export function splitForTabbar(items: NavItem[]) {
  const ordered = tabPriority.map((key) => items.find((item) => item.key === key)).filter((item): item is NavItem => Boolean(item));
  const tabs = ordered.slice(0, 4);
  const rest = items.filter((item) => !tabs.includes(item));
  return { tabs, rest };
}
