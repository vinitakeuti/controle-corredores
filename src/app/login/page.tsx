import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "ADMIN" ? "/admin" : "/aluno");

  return (
    <main className="login-page">
      <section className="login-card">
        <Brand />
        <h1>Controle simples para treinar melhor.</h1>
        <p>Acesse sua conta para acompanhar assinaturas, pagamentos e vencimentos.</p>
        <LoginForm />
      </section>
    </main>
  );
}
