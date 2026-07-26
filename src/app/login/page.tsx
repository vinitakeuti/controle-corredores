import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "ADMIN" ? "/admin" : "/aluno");

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand-mark"><span className="brand-dot" /> PABULA</div>
        <h1>Controle simples para treinar melhor.</h1>
        <p>Acesse sua conta para acompanhar assinaturas, pagamentos e vencimentos.</p>
        <LoginForm />
        <div className="demo-note">Ambiente de demonstração<br />Admin: admin@pabula.com / Admin@123<br />Aluno: aluno@pabula.com / Aluno@123</div>
      </section>
    </main>
  );
}
