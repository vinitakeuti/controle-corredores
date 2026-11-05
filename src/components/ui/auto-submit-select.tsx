"use client";

// Select que envia o formulário ao mudar. Sem JavaScript, o formulário continua com o botão de envio.
export function AutoSubmitSelect({ id, name, defaultValue, children, className = "control", ariaLabel }: { id: string; name: string; defaultValue: string; children: React.ReactNode; className?: string; ariaLabel?: string }) {
  return (
    <select id={id} name={name} defaultValue={defaultValue} className={className} aria-label={ariaLabel} onChange={(event) => event.currentTarget.form?.requestSubmit()}>
      {children}
    </select>
  );
}
