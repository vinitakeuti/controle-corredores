import Link from "next/link";
import { UserRole } from "@prisma/client";
import type { SessionUser } from "@/lib/auth";
import { Brand } from "@/components/brand";
import { MobileNav } from "@/components/mobile-nav";

export function AppShell({ user, children, current }: { user: SessionUser; children: React.ReactNode; current: "admin" | "students" | "analysis" | "integrations" | "student" }) {
  return (
    <div className="app-shell">
      <MobileNav user={user} current={current} />
      <aside className="sidebar">
        <Brand href={user.role === UserRole.ADMIN ? "/admin" : "/aluno"} />
        <nav aria-label="Navegação principal">
          {user.role === UserRole.ADMIN ? <Link className={`nav-link ${current === "admin" ? "active" : ""}`} href="/admin">Visão geral</Link> : null}
          {user.role === UserRole.ADMIN ? <Link className={`nav-link ${current === "students" ? "active" : ""}`} href="/admin/alunos">Alunos</Link> : null}
          {user.role === UserRole.ADMIN ? <Link className={`nav-link ${current === "analysis" ? "active" : ""}`} href="/admin/analisar">Analisar dados</Link> : null}
          {user.role === UserRole.ADMIN ? <Link className={`nav-link ${current === "integrations" ? "active" : ""}`} href="/admin/integracoes">Integrações</Link> : null}
          {user.role === UserRole.STUDENT ? <Link className={`nav-link ${current === "student" ? "active" : ""}`} href="/aluno">Minha assinatura</Link> : null}
        </nav>
        <div className="sidebar-footer">
          <strong>{user.name}</strong>
          <span>{user.role === UserRole.ADMIN ? "Administrador" : "Aluno"}</span>
          <form action="/api/auth/logout" method="post">
            <button className="logout-button" type="submit">Sair da conta</button>
          </form>
        </div>
      </aside>
      <main className="main-content"><div className="content-wrap">{children}</div></main>
    </div>
  );
}
