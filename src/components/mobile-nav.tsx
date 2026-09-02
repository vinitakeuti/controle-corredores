"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserRole } from "@prisma/client";
import type { SessionUser } from "@/lib/auth";
import { Brand } from "@/components/brand";


export function MobileNav({ user, current }: { user: SessionUser; current: "admin" | "students" | "analysis" | "plans" | "integrations" | "settings" | "student" | "demands" }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("menu-open", open);
    return () => document.body.classList.remove("menu-open");
  }, [open]);

  const close = () => setOpen(false);
  const openTutorial = () => {
    close();
    window.dispatchEvent(new Event("pace-lab:open-tutorial"));
  };

  return (
    <>
      <header className="mobile-nav">
        <Brand href={user.role === UserRole.STUDENT ? "/aluno" : user.role === UserRole.OPERATOR ? "/admin/alunos" : "/admin"} />
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
            {user.role === UserRole.ADMIN || user.role === UserRole.OPERATOR ? <Link className={`nav-link ${current === "demands" ? "active" : ""}`} href="/admin/demandas" onClick={close}>Demandas</Link> : null}
            {user.role !== UserRole.STUDENT ? <Link className={`nav-link ${current === "students" ? "active" : ""}`} href="/admin/alunos" onClick={close}>Alunos</Link> : null}
            {user.role !== UserRole.STUDENT ? <Link className={`nav-link ${current === "analysis" ? "active" : ""}`} href="/admin/analisar" onClick={close}>Analisar dados</Link> : null}
            {user.role === UserRole.ADMIN ? <Link className={`nav-link ${current === "plans" ? "active" : ""}`} href="/admin/planos" onClick={close}>Planos</Link> : null}
            {user.role === UserRole.ADMIN ? <Link className={`nav-link ${current === "integrations" ? "active" : ""}`} href="/admin/integracoes" onClick={close}>Integrações</Link> : null}
            {user.role === UserRole.STUDENT ? <Link className={`nav-link ${current === "student" ? "active" : ""}`} href="/aluno" onClick={close}>Minha assinatura</Link> : null}
            {user.role === UserRole.ADMIN ? <Link className={`nav-link ${current === "settings" ? "active" : ""}`} href="/admin/configuracoes" onClick={close}>Configurações</Link> : null}
            <button className="nav-link tutorial-launcher" type="button" onClick={openTutorial}>Tutorial</button>
          </nav>
          <div className="sidebar-footer"><strong>{user.name}</strong><span>{user.role === UserRole.ADMIN ? "Administrador" : user.role === UserRole.OPERATOR ? "Operador" : "Aluno"}</span><form action="/api/auth/logout" method="post"><button className="logout-button" type="submit">Sair da conta</button></form></div>
        </aside>
      </div> : null}
    </>
  );
}
