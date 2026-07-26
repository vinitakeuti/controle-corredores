import Link from "next/link";
import { UserRole } from "@prisma/client";
import type { SessionUser } from "@/lib/auth";

export function AppShell({ user, children, current }: { user: SessionUser; children: React.ReactNode; current: "admin" | "student" }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href={user.role === UserRole.ADMIN ? "/admin" : "/aluno"} className="brand-mark"><span className="brand-dot" /> PABULA</Link>
        <nav aria-label="Navegação principal">
          {user.role === UserRole.ADMIN ? <Link className={`nav-link ${current === "admin" ? "active" : ""}`} href="/admin">Visão geral</Link> : null}
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
