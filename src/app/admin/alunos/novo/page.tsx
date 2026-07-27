import Link from "next/link";
import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { StudentCreateForm } from "@/components/student-create-form";
import { requireRole } from "@/lib/auth";

export default async function NewStudentPage() {
  const user = await requireRole(UserRole.ADMIN);

  return <AppShell user={user} current="students"><div className="page-back"><Link href="/admin/alunos">← Alunos</Link></div><header className="page-heading"><div><p className="eyebrow">Gestão de acessos</p><h1>Adicionar aluno.</h1><p>Escolha como o próximo aluno vai entrar na assessoria.</p></div></header><StudentCreateForm /></AppShell>;
}
