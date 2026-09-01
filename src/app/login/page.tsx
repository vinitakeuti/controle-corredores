import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Brand } from "@/components/brand";
import { LoginForm } from "@/components/login-form";
import { defaultPathForRole, getCurrentUser, isStaffRole } from "@/lib/auth";
import { isStudentPortalEnabled, portalForHost, portalUrlForRole } from "@/lib/portal";

export default async function LoginPage() {
  const user = await getCurrentUser();
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
    <main className="login-page">
      <div className="login-layout">
        <section className="login-identity">
          <Brand />
          <div>
            <p className="eyebrow">Pace Lab</p>
            <h1>A academia do corredor.</h1>
            <p>Um espaço para acompanhar sua jornada e manter o foco no próximo treino.</p>
          </div>
          <small>PACE LAB · ACADEMIA DO CORREDOR</small>
        </section>
        <section className="login-card">
          <p className="eyebrow">{isStudentPortal ? "Área do aluno" : "Acesso à plataforma"}</p>
          <h1>Bem-vindo de volta.</h1>
          <p>{isStudentPortal ? "Entre para acompanhar seu plano e seus pagamentos." : "Entre para acompanhar a sua operação."}</p>
          <LoginForm />
        </section>
      </div>
    </main>
  );
}
