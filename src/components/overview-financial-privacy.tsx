"use client";

import { createContext, useContext, useState } from "react";

const FinancialValuesContext = createContext<{ hidden: boolean; toggle: () => void }>({ hidden: false, toggle: () => undefined });

export function FinancialValues({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);

  return (
    <FinancialValuesContext.Provider value={{ hidden, toggle: () => setHidden((current) => !current) }}>
      <div className="overview-values" data-values-hidden={hidden}>
        {children}
      </div>
    </FinancialValuesContext.Provider>
  );
}

export function FinancialVisibilityToggle() {
  const { hidden, toggle } = useContext(FinancialValuesContext);
  const label = hidden ? "Exibir valores financeiros" : "Ocultar valores financeiros";

  return (
    <button className="financial-visibility-toggle" type="button" onClick={toggle} aria-label={label} aria-pressed={hidden} title={label}>
      {hidden ? (
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 5.1A10.8 10.8 0 0 1 12 5c5.5 0 9.2 5 9.2 7s-1.5 4.1-3.8 5.5M6.1 6.1C3.9 7.5 2.8 10 2.8 12c0 2 3.7 7 9.2 7 1 0 1.9-.2 2.8-.5M12 9.9a2 2 0 0 1 2.1 2.1" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.8 12S6.5 5 12 5s9.2 7 9.2 7-3.7 7-9.2 7S2.8 12 2.8 12Z" /><circle cx="12" cy="12" r="2.6" /></svg>
      )}
    </button>
  );
}
