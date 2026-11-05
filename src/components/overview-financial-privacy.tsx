"use client";

import { createContext, useContext, useState } from "react";
import { Icon } from "@/components/ui/icon";

const FinancialValuesContext = createContext<{ hidden: boolean; toggle: () => void }>({ hidden: false, toggle: () => undefined });

export function FinancialValues({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);

  return (
    <FinancialValuesContext.Provider value={{ hidden, toggle: () => setHidden((current) => !current) }}>
      <div className="financial-values" data-values-hidden={hidden}>
        {children}
      </div>
    </FinancialValuesContext.Provider>
  );
}

// Valor financeiro que some de verdade quando ocultado: na tela e para o leitor de tela.
export function HideableMoney({ value, className }: { value: string; className?: string }) {
  const { hidden } = useContext(FinancialValuesContext);
  return hidden ? <span className={className} aria-label="Valor oculto">R$ ••••</span> : <span className={className}>{value}</span>;
}

export function FinancialVisibilityToggle() {
  const { hidden, toggle } = useContext(FinancialValuesContext);
  const label = hidden ? "Exibir valores financeiros" : "Ocultar valores financeiros";

  return (
    <button className="btn btn-quiet privacy-toggle" type="button" onClick={toggle} title={label}>
      <Icon name={hidden ? "eye" : "eyeOff"} />{hidden ? "Exibir valores" : "Ocultar valores"}
    </button>
  );
}
