import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "ADMIN" ? "/admin" : "/aluno");

  return (
    <main className="login-page">
      <div className="login-layout">
        <section className="login-identity">
          <Brand />
          <div>
            <p className="eyebrow">Gestão de assinaturas</p>
            <h1>Ritmo para a sua operação.</h1>
            <p>Controle alunos, pagamentos e vencimentos com a precisão da Pace Lab.</p>
          </div>
          <div className="login-route" aria-hidden="true"><i /><span /><b /></div>
          <small>PACE LAB · CONTROLE DE ALUNOS</small>
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
