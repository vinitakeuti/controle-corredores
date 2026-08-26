"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserRole } from "@prisma/client";
import type { SessionUser } from "@/lib/auth";
import { Brand } from "@/components/brand";

export function MobileNav({ user, current }: { user: SessionUser; current: "admin" | "students" | "analysis" | "billing" | "integrations" | "student" }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("menu-open", open);
    return () => document.body.classList.remove("menu-open");
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <header className="mobile-nav">
        <Brand href={user.role === UserRole.ADMIN ? "/admin" : "/aluno"} />
        <button className="menu-trigger" type="button" aria-label={open ? "Fechar menu" : "Abrir menu"} aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen((value) => !value)}>
          <span /><span /><span />
        </button>
      </header>
      {open ? <div className="mobile-menu-layer">
        <button className="mobile-menu-overlay" type="button" aria-label="Fechar menu" onClick={close} />
        <aside className="mobile-drawer" id="mobile-menu">
          <div className="mobile-drawer-header"><span className="eyebrow">Menu</span><button className="drawer-close" type="button" aria-label="Fechar menu" onClick={close}>×</button></div>
          <nav aria-label="Navegação mobile">
            {user.role === UserRole.ADMIN ? <Link className={`nav-link ${current === "admin" ? "active" : ""}`} href="/admin" onClick={close}>Visão geral</Link> : null}
            {user.role === UserRole.ADMIN ? <Link className={`nav-link ${current === "students" ? "active" : ""}`} href="/admin/alunos" onClick={close}>Alunos</Link> : null}
            {user.role === UserRole.ADMIN ? <Link className={`nav-link ${current === "analysis" ? "active" : ""}`} href="/admin/analisar" onClick={close}>Analisar dados</Link> : null}
            {user.role === UserRole.ADMIN ? <Link className={`nav-link ${current === "billing" ? "active" : ""}`} href="/admin/cobrancas" onClick={close}>Cobranças</Link> : null}
            {user.role === UserRole.ADMIN ? <Link className={`nav-link ${current === "integrations" ? "active" : ""}`} href="/admin/integracoes" onClick={close}>Integrações</Link> : null}
            {user.role === UserRole.STUDENT ? <Link className={`nav-link ${current === "student" ? "active" : ""}`} href="/aluno" onClick={close}>Minha assinatura</Link> : null}
          </nav>
          <div className="sidebar-footer"><strong>{user.name}</strong><span>{user.role === UserRole.ADMIN ? "Administrador" : "Aluno"}</span><form action="/api/auth/logout" method="post"><button className="logout-button" type="submit">Sair da conta</button></form></div>
        </aside>
      </div> : null}
    </>
  );
}
