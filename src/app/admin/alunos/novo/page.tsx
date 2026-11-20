import { AppShell } from "@/components/app-shell";
import { StudentCreateForm } from "@/components/student-create-form";
import { PageHeader } from "@/components/ui/page-header";
import { canAccessFeature } from "@/lib/access-control";
import { requireFeature } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import { getStaffPlans, planDisplayName } from "@/lib/plans";

export default async function NewStudentPage() {
  const user = await requireFeature("students");
  const specialPlans = (await getStaffPlans()).filter((plan) => plan.isHidden).map((plan) => ({ id: plan.id, isCourtesy: plan.isCourtesy, label: `${planDisplayName(plan)} — ${plan.isCourtesy ? "Cortesia" : `${formatCurrency(plan.priceCents)}/mês`}` }));

  return <AppShell user={user} current="students">
    <PageHeader context={{ label: "Alunos", href: "/admin/alunos", current: "Novo aluno" }} title="Adicionar aluno." lead="Escolha como o próximo aluno vai entrar na assessoria." />
    <StudentCreateForm specialPlans={specialPlans} canUseSalesCards={canAccessFeature(user, "sales")} />
  </AppShell>;
}
