import { AppShell } from "@/components/app-shell";
import { StudentCreateForm } from "@/components/student-create-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireFeature } from "@/lib/auth";

export default async function NewStudentPage() {
  const user = await requireFeature("students");

  return <AppShell user={user} current="students">
    <PageHeader context={{ label: "Alunos", href: "/admin/alunos", current: "Novo aluno" }} title="Adicionar aluno." lead="Escolha como o próximo aluno vai entrar na assessoria." />
    <StudentCreateForm />
  </AppShell>;
}
