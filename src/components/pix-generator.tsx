"use client";

import { useState } from "react";

export function PixGenerator() {
  const [loading, setLoading] = useState(false);
  const [pix, setPix] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function generatePix() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/payments/pix", { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Não foi possível gerar o PIX.");
      setLoading(false);
      return;
    }
    setPix(data.pixCopyPaste);
    setLoading(false);
  }

  return (
    <div>
      <button className="button button-dark" type="button" onClick={generatePix} disabled={loading}>{loading ? "Gerando..." : "Gerar PIX"}</button>
      {error ? <p className="error-message" style={{ marginTop: 12, marginBottom: 0 }}>{error}</p> : null}
      {pix ? <div className="pix-result"><strong>PIX gerado para teste</strong>{pix}</div> : null}
    </div>
  );
}
