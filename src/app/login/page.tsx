import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AuthHeading, AuthLayout } from "@/components/auth-layout";
import { LoginForm } from "@/components/login-form";
import { defaultPathForRole, getCurrentUser, isStaffRole } from "@/lib/auth";
import { isStudentPortalEnabled, portalForHost, portalUrlForRole } from "@/lib/portal";

export default async function LoginPage() {
  const user = await getCurrentUser({ allowInactiveStudent: true });
  const requestHeaders = await headers();
  const portal = portalForHost(requestHeaders.get("host"));
  if (user) {
    if (isStudentPortalEnabled() && ((portal === "STUDENT" && isStaffRole(user.role)) || (portal === "MANAGEMENT" && !isStaffRole(user.role)))) {
      redirect(portalUrlForRole(user.role, defaultPathForRole(user.role)));
    }
    redirect(defaultPathForRole(user.role));
  }

  const isStudentPortal = isStudentPortalEnabled() && portal === "STUDENT";

  return (
    <AuthLayout brandTitle="A academia do corredor." brandLead="Um espaço para acompanhar sua jornada e manter o foco no próximo treino.">
      <AuthHeading context={isStudentPortal ? "Área do aluno" : "Acesso à plataforma"} title="Bem-vindo de volta." lead={isStudentPortal ? "Entre para acompanhar seu plano e seus pagamentos." : "Entre para acompanhar a sua operação."} />
      <LoginForm />
    </AuthLayout>
  );
}
