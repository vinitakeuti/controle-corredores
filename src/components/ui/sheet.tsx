"use client";

import { useEffect, useId, useRef } from "react";
import { Icon } from "@/components/ui/icon";

// Diálogo do sistema sobre <dialog> nativo: foco preso, Esc fecha, fundo inerte e o foco volta
// para quem abriu. No desktop aparece centralizado; abaixo de 560px vira bottom sheet.
export function Sheet({ open, onClose, title, children, closeLabel = "Fechar", className = "" }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; closeLabel?: string; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => {
      returnFocus.current?.focus();
      returnFocus.current = null;
    };
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  return (
    <dialog
      ref={ref}
      className={`sheet ${className}`.trim()}
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="sheet-grabber" aria-hidden="true" />
      <div className="sheet-head">
        <h2 className="sheet-title" id={titleId}>{title}</h2>
        <button className="icon-btn" type="button" aria-label={closeLabel} onClick={onClose}><Icon name="close" /></button>
      </div>
      <div className="sheet-body">{children}</div>
    </dialog>
  );
}
