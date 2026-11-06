import Link from "next/link";
import { UserRole } from "@prisma/client";
import type { SessionUser } from "@/lib/auth";
import { Brand } from "@/components/brand";
import { MobileNav } from "@/components/mobile-nav";
import { PlatformTutorial } from "@/components/platform-tutorial";
import { Icon } from "@/components/ui/icon";
import { homeHrefFor, navGroupLabels, navItemsFor, roleLabel, type NavItem, type ShellSection } from "@/components/shell/nav";
import { STORE_ADMIN_URL, STORE_URL } from "@/lib/store-url";
import { getAssistantName } from "@/lib/ai/settings";

function SidebarLink({ item, current }: { item: NavItem; current: ShellSection }) {
  return (
    <li>
      <Link className="shell-link" href={item.href} aria-current={current === item.key ? "page" : undefined} data-tutorial-anchor={item.tutorialAnchor}>
        <Icon name={item.icon} />{item.label}
      </Link>
    </li>
  );
}

export async function AppShell({ user, children, current }: { user: SessionUser; children: React.ReactNode; current: ShellSection }) {
  // O nome do assistente (Configurações › Assistente IA) substitui "Assistente" no menu.
  const assistantName = user.role === UserRole.STUDENT ? null : await getAssistantName();
  const items = navItemsFor(user, assistantName);
  const isStudent = user.role === UserRole.STUDENT;
  const groups = (["operation", "commercial", "finance", "student"] as const)
    .map((group) => ({ group, items: items.filter((item) => item.group === group) }))
    .filter((entry) => entry.items.length > 0);

  return (
    <div className="shell" data-nav={isStudent ? "student" : "staff"}>
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
      <MobileNav user={user} current={current} assistantName={assistantName} />
      <aside className="shell-sidebar brand-surface" aria-label="Menu lateral">
        <Brand className="shell-wordmark" href={homeHrefFor(user.role)} label="Pace Lab, página inicial" size={104} />
        <nav className="shell-nav" aria-label="Navegação principal">
          {groups.map(({ group, items: groupItems }) => (
            <div className="shell-nav-group" key={group}>
              {!isStudent ? <span className="shell-nav-label" id={`nav-group-${group}`}>{navGroupLabels[group]}</span> : null}
              <ul className="shell-nav-list" aria-labelledby={!isStudent ? `nav-group-${group}` : undefined}>
                {groupItems.map((item) => <SidebarLink key={item.key} item={item} current={current} />)}
                {isStudent ? <li><a className="shell-link" href={STORE_URL}><Icon name="store" />Loja</a></li> : null}
              </ul>
            </div>
          ))}
        </nav>
        <div className="shell-sidebar-footer">
          <ul className="shell-nav-list">
            {user.role === UserRole.ADMIN ? <li><Link className="shell-link" href="/admin/configuracoes" aria-current={current === "settings" ? "page" : undefined}><Icon name="settings" />Configurações</Link></li> : null}
            {user.role === UserRole.ADMIN ? <li><a className="shell-link" href={STORE_ADMIN_URL} target="_blank" rel="noreferrer"><Icon name="store" />Admin da loja<Icon name="external" className="icon-external" /><span className="visually-hidden"> (abre em nova aba)</span></a></li> : null}
            {user.active ? <li><button className="shell-link" type="button" data-open-tutorial><Icon name="help" />Tutorial</button></li> : null}
          </ul>
          <div className="shell-account" data-tutorial-anchor="account-menu">
            <div className="shell-account-name"><strong title={user.name}>{user.name}</strong><span>{roleLabel(user.role)}</span></div>
            <form action="/api/auth/logout" method="post">
              <button className="shell-logout" type="submit" aria-label="Sair da conta"><Icon name="logout" />Sair</button>
            </form>
          </div>
        </div>
      </aside>
      <main className="shell-main" id="conteudo" tabIndex={-1}>
        <div className="shell-content">
          {isStudent ? <a className="btn btn-secondary store-link" href={STORE_URL}><Icon name="store" />IR PARA A LOJA</a> : null}
          {children}
        </div>
      </main>
      {user.active ? <PlatformTutorial role={user.role} name={user.name} userId={user.id} initiallySeen={Boolean(user.tutorialSeenAt)} /> : null}
    </div>
  );
}
