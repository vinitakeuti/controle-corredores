"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/ui/icon";

export type MenuItem = { label: string; icon?: IconName; onSelect: () => void; tone?: "danger" };

// Menu de ações: setas navegam, Esc fecha e devolve o foco, clique fora fecha.
export function MenuButton({ label, items, icon = "more", text }: { label: string; items: MenuItem[]; icon?: IconName; text?: string }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const first = menuRef.current?.querySelector<HTMLButtonElement>("[role=menuitem]");
    first?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node) && !buttonRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  function onMenuKey(event: React.KeyboardEvent<HTMLDivElement>) {
    const options = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [])];
    const index = options.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); buttonRef.current?.focus(); }
    if (event.key === "ArrowDown") { event.preventDefault(); options[(index + 1) % options.length]?.focus(); }
    if (event.key === "ArrowUp") { event.preventDefault(); options[(index - 1 + options.length) % options.length]?.focus(); }
    if (event.key === "Home") { event.preventDefault(); options[0]?.focus(); }
    if (event.key === "End") { event.preventDefault(); options.at(-1)?.focus(); }
    if (event.key === "Tab") setOpen(false);
  }

  return (
    <div className="menu">
      <button ref={buttonRef} className={text ? "btn btn-secondary" : "icon-btn menu-trigger-icon"} type="button" aria-label={text ? undefined : label} title={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} onClick={() => setOpen((value) => !value)}>
        <Icon name={icon} />{text}
      </button>
      {open ? <div ref={menuRef} className="menu-list" id={menuId} role="menu" aria-label={label} onKeyDown={onMenuKey}>
        {items.map((item) => (
          <button key={item.label} className="menu-item" data-tone={item.tone} type="button" role="menuitem" tabIndex={-1} onClick={() => { setOpen(false); item.onSelect(); }}>
            {item.icon ? <Icon name={item.icon} /> : null}{item.label}
          </button>
        ))}
      </div> : null}
    </div>
  );
}
