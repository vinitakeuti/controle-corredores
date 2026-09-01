import Link from "next/link";
import { UserRole } from "@prisma/client";
import type { SessionUser } from "@/lib/auth";
import { Brand } from "@/components/brand";
import { MobileNav } from "@/components/mobile-nav";
import { PlatformTutorial } from "@/components/platform-tutorial";
import { DemandsMenu } from "@/components/demands-menu";

export function AppShell({ user, children, current }: { user: SessionUser; children: React.ReactNode; current: "admin" | "students" | "analysis" | "plans" | "integrations" | "settings" | "student" | "demands" }) {
  return (
    <div className="app-shell">
      <MobileNav user={user} current={current} />
      <aside className="sidebar">
        <Brand href={user.role === UserRole.STUDENT ? "/aluno" : user.role === UserRole.OPERATOR ? "/admin/alunos" : "/admin"} />
        <nav aria-label="Navegação principal">
          {user.role === UserRole.ADMIN ? <Link className={`nav-link ${current === "admin" ? "active" : ""}`} href="/admin">Visão geral</Link> : null}
          {user.role !== UserRole.STUDENT ? <Link className={`nav-link ${current === "students" ? "active" : ""}`} href="/admin/alunos" data-tutorial-anchor="nav-students">Alunos</Link> : null}
          {user.role !== UserRole.STUDENT ? <Link className={`nav-link ${current === "analysis" ? "active" : ""}`} href="/admin/analisar">Analisar dados</Link> : null}
          {user.role === UserRole.ADMIN || user.role === UserRole.OPERATOR ? <DemandsMenu active={current === "demands"} /> : null}
          {user.role === UserRole.ADMIN ? <Link className={`nav-link ${current === "plans" ? "active" : ""}`} href="/admin/planos" data-tutorial-anchor="nav-plans">Planos</Link> : null}
          {user.role === UserRole.ADMIN ? <Link className={`nav-link ${current === "integrations" ? "active" : ""}`} href="/admin/integracoes">Integrações</Link> : null}
          {user.role === UserRole.STUDENT ? <Link className={`nav-link ${current === "student" ? "active" : ""}`} href="/aluno" data-tutorial-anchor="nav-student">Minha assinatura</Link> : null}
          <button className="nav-link tutorial-launcher" type="button" data-open-tutorial>Tutorial</button>
        </nav>
        {user.role === UserRole.ADMIN ? <div className="sidebar-settings"><Link className={`nav-link ${current === "settings" ? "active" : ""}`} href="/admin/configuracoes">Configurações</Link></div> : null}
        <div className="sidebar-footer" data-tutorial-anchor="account-menu">
          <strong>{user.name}</strong>
          <span>{user.role === UserRole.ADMIN ? "Administrador" : user.role === UserRole.OPERATOR ? "Operador" : "Aluno"}</span>
          <form action="/api/auth/logout" method="post">
            <button className="logout-button" type="submit">Sair da conta</button>
          </form>
        </div>
      </aside>
      <main className="main-content"><div className="content-wrap">{children}</div></main>
      <PlatformTutorial role={user.role} name={user.name} userId={user.id} initiallySeen={Boolean(user.tutorialSeenAt)} />
    </div>
  );
}
