"use client";

import { useState } from "react";
import Link from "next/link";
import { UserRole } from "@prisma/client";
import type { SessionUser } from "@/lib/auth";
import { Brand } from "@/components/brand";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { homeHrefFor, navItemsFor, roleLabel, splitForTabbar, type ShellSection } from "@/components/shell/nav";
import { STORE_ADMIN_URL, STORE_URL } from "@/lib/store-url";

// Navegação abaixo de 900px. Equipe: topo compacto + barra inferior com as quatro primeiras áreas
// permitidas e "Mais". Aluno: topo compacto com menu.
export function MobileNav({ user, current }: { user: SessionUser; current: ShellSection }) {
  const [open, setOpen] = useState(false);
  const isStudent = user.role === UserRole.STUDENT;
  const items = navItemsFor(user);
  const { tabs, rest } = splitForTabbar(items);
  const menuItems = isStudent ? items : rest;
  const moreIsCurrent = current === "settings" || rest.some((item) => item.key === current);

  const close = () => setOpen(false);
  const openTutorial = () => {
    close();
    window.dispatchEvent(new Event("pace-lab:open-tutorial"));
  };

  return (
    <>
      <header className="shell-topbar brand-surface">
        <Brand className="shell-wordmark" href={homeHrefFor(user.role)} label="Pace Lab, página inicial" size={64} />
        {isStudent ? <button className="icon-btn" type="button" aria-label="Abrir menu" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)} data-tutorial-anchor="account-menu"><Icon name="menu" /></button> : null}
      </header>

      {!isStudent ? <nav className="shell-tabbar" aria-label="Navegação principal" style={{ "--tab-count": tabs.length + 1 } as React.CSSProperties}>
        {tabs.map((item) => (
          <Link key={item.key} className="shell-tab" href={item.href} aria-current={current === item.key ? "page" : undefined} data-tutorial-anchor={item.tutorialAnchor}>
            <Icon name={item.icon} /><span>{item.shortLabel ?? item.label}</span>
          </Link>
        ))}
        <button className="shell-tab" type="button" aria-haspopup="dialog" aria-expanded={open} aria-current={moreIsCurrent ? "page" : undefined} onClick={() => setOpen(true)} data-tutorial-anchor="account-menu">
          <Icon name="more" /><span>Mais</span>
        </button>
      </nav> : null}

      <Sheet open={open} onClose={close} title="Menu">
        <nav aria-label="Mais opções">
          <ul className="shell-menu-list">
            {menuItems.map((item) => (
              <li key={item.key}>
                <Link className="shell-menu-link" href={item.href} onClick={close} aria-current={current === item.key ? "page" : undefined} data-tutorial-anchor={item.tutorialAnchor}>
                  <Icon name={item.icon} />{item.label}
                </Link>
              </li>
            ))}
            {user.role === UserRole.ADMIN ? <li><Link className="shell-menu-link" href="/admin/configuracoes" onClick={close} aria-current={current === "settings" ? "page" : undefined}><Icon name="settings" />Configurações</Link></li> : null}
            {user.role === UserRole.ADMIN ? <li><a className="shell-menu-link" href={STORE_ADMIN_URL} target="_blank" rel="noreferrer"><Icon name="store" />Admin da loja<Icon name="external" className="icon-external" /><span className="visually-hidden"> (abre em nova aba)</span></a></li> : null}
            {isStudent ? <li><a className="shell-menu-link" href={STORE_URL}><Icon name="store" />Loja</a></li> : null}
            {user.active ? <li><button className="shell-menu-link" type="button" onClick={openTutorial}><Icon name="help" />Tutorial</button></li> : null}
          </ul>
        </nav>
        <div className="shell-menu-account">
          <div><strong>{user.name}</strong><span>{roleLabel(user.role)}</span></div>
          <form action="/api/auth/logout" method="post"><button className="btn btn-secondary" type="submit"><Icon name="logout" />Sair da conta</button></form>
        </div>
      </Sheet>
    </>
  );
}
