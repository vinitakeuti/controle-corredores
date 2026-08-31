import Link from "next/link";
import { UserRole } from "@prisma/client";
import type { SessionUser } from "@/lib/auth";
import { Brand } from "@/components/brand";
import { MobileNav } from "@/components/mobile-nav";
import { PlatformTutorial } from "@/components/platform-tutorial";

export function AppShell({ user, children, current }: { user: SessionUser; children: React.ReactNode; current: "admin" | "students" | "analysis" | "billing" | "plans" | "integrations" | "student" }) {
  return (
    <div className="app-shell">
      <MobileNav user={user} current={current} />
      <aside className="sidebar">
        <Brand href={user.role === UserRole.ADMIN ? "/admin" : "/aluno"} />
        <nav aria-label="Navegação principal">
          {user.role === UserRole.ADMIN ? <Link className={`nav-link ${current === "admin" ? "active" : ""}`} href="/admin">Visão geral</Link> : null}
          {user.role === UserRole.ADMIN ? <Link className={`nav-link ${current === "students" ? "active" : ""}`} href="/admin/alunos" data-tutorial-anchor="nav-students">Alunos</Link> : null}
          {user.role === UserRole.ADMIN ? <Link className={`nav-link ${current === "analysis" ? "active" : ""}`} href="/admin/analisar">Analisar dados</Link> : null}
          {user.role === UserRole.ADMIN ? <Link className={`nav-link ${current === "billing" ? "active" : ""}`} href="/admin/cobrancas" data-tutorial-anchor="nav-billing">Cobranças</Link> : null}
          {user.role === UserRole.ADMIN ? <Link className={`nav-link ${current === "plans" ? "active" : ""}`} href="/admin/planos">Planos</Link> : null}
          {user.role === UserRole.ADMIN ? <Link className={`nav-link ${current === "integrations" ? "active" : ""}`} href="/admin/integracoes">Integrações</Link> : null}
          {user.role === UserRole.STUDENT ? <Link className={`nav-link ${current === "student" ? "active" : ""}`} href="/aluno" data-tutorial-anchor="nav-student">Minha assinatura</Link> : null}
          <button className="nav-link tutorial-launcher" type="button" data-open-tutorial>Tutorial</button>
        </nav>
        <div className="sidebar-footer" data-tutorial-anchor="account-menu">
          <strong>{user.name}</strong>
          <span>{user.role === UserRole.ADMIN ? "Administrador" : "Aluno"}</span>
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
