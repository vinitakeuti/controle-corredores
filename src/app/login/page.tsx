import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { LoginForm } from "@/components/login-form";
import { defaultPathForRole, getCurrentUser } from "@/lib/auth";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(defaultPathForRole(user.role));

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
          <p className="eyebrow">Acesso à plataforma</p>
          <h1>Bem-vindo de volta.</h1>
          <p>Entre para acompanhar a sua operação.</p>
          <LoginForm />
        </section>
      </div>
    </main>
  );
}
