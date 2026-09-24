import Link from "next/link";
import { UserRole } from "@prisma/client";
import { canAccessFeature } from "@/lib/access-control";
import type { SessionUser } from "@/lib/auth";
import { Brand } from "@/components/brand";
import { MobileNav } from "@/components/mobile-nav";
import { PlatformTutorial } from "@/components/platform-tutorial";
import { STORE_ADMIN_URL, STORE_URL } from "@/lib/store-url";


export function AppShell({ user, children, current }: { user: SessionUser; children: React.ReactNode; current: "admin" | "students" | "analysis" | "plans" | "integrations" | "settings" | "student" | "demands" | "sales" | "finance" }) {
  return (
    <div className="app-shell">
      <MobileNav user={user} current={current} />
      <aside className={`sidebar sidebar-${user.role.toLowerCase()}`}>
        <Brand href={user.role === UserRole.STUDENT ? "/aluno" : user.role === UserRole.OPERATOR ? "/admin/alunos" : "/admin"} />
        <nav aria-label="Navegação principal">
          {canAccessFeature(user, "overview") ? <Link className={`nav-link ${current === "admin" ? "active" : ""}`} href="/admin">Visão geral</Link> : null}
          {(user.role === UserRole.OPERATOR || canAccessFeature(user, "demands")) ? <Link className={`nav-link ${current === "demands" ? "active" : ""}`} href="/admin/demandas">Demandas</Link> : null}
          {(user.role === UserRole.OPERATOR || canAccessFeature(user, "sales")) ? <Link className={`nav-link ${current === "sales" ? "active" : ""}`} href="/admin/vendas">Vendas</Link> : null}
          {(user.role === UserRole.OPERATOR || canAccessFeature(user, "students")) ? <Link className={`nav-link ${current === "students" ? "active" : ""}`} href="/admin/alunos" data-tutorial-anchor="nav-students">Alunos</Link> : null}
          {(user.role === UserRole.OPERATOR || canAccessFeature(user, "analysis")) ? <Link className={`nav-link ${current === "analysis" ? "active" : ""}`} href="/admin/analisar">Analisar dados</Link> : null}
          {canAccessFeature(user, "finance") ? <Link className={`nav-link ${current === "finance" ? "active" : ""}`} href="/admin/financeiro">Financeiro</Link> : null}
          {canAccessFeature(user, "plans") ? <Link className={`nav-link ${current === "plans" ? "active" : ""}`} href="/admin/planos" data-tutorial-anchor="nav-plans">Planos</Link> : null}
          {canAccessFeature(user, "integrations") ? <Link className={`nav-link ${current === "integrations" ? "active" : ""}`} href="/admin/integracoes">Integrações</Link> : null}
          {user.role === UserRole.STUDENT ? <Link className={`nav-link ${current === "student" ? "active" : ""}`} href="/aluno" data-tutorial-anchor="nav-student">Minha assinatura</Link> : null}
          <button className="nav-link tutorial-launcher" type="button" data-open-tutorial>Tutorial</button>
          {user.role === UserRole.STUDENT ? <a className="nav-link" href={STORE_URL}>Loja</a> : null}
        </nav>
        {user.role === UserRole.ADMIN ? <div className="sidebar-settings"><Link className={`nav-link ${current === "settings" ? "active" : ""}`} href="/admin/configuracoes">Configurações</Link><a className="nav-link" href={STORE_ADMIN_URL} target="_blank" rel="noreferrer">Admin da loja</a></div> : null}
        <div className="sidebar-footer" data-tutorial-anchor="account-menu">
          <strong>{user.name}</strong>
          <span>{user.role === UserRole.ADMIN ? "Administrador" : user.role === UserRole.MANAGER ? "Gerente" : user.role === UserRole.OPERATOR ? "Operador" : "Aluno"}</span>
          <form action="/api/auth/logout" method="post">
            <button className="logout-button" type="submit">Sair da conta</button>
          </form>
        </div>
      </aside>
      <main className="main-content"><div className="content-wrap">{user.role === UserRole.STUDENT ? <a className="student-store-button" href={STORE_URL}>IR PARA A LOJA</a> : null}{children}</div></main>
      <PlatformTutorial role={user.role} name={user.name} userId={user.id} initiallySeen={Boolean(user.tutorialSeenAt)} />
    </div>
  );
}
