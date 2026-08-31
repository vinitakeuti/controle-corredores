"use client";

import Link from "next/link";
import { useState } from "react";

type Method = "PIX" | "CARD" | "BOLETO";

export function BillingSettingsForm({ initialAllowedMethods }: { initialAllowedMethods: Method[] }) {
  const [allowedMethods, setAllowedMethods] = useState<Method[]>(initialAllowedMethods);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  function toggleMethod(method: Method) { setAllowedMethods((current) => current.includes(method) ? current.filter((item) => item !== method) : [...current, method]); }
  async function save() {
    if (!allowedMethods.length) { setError("Selecione ao menos um método de pagamento."); return; }
    setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/billing-settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ defaultAllowedMethods: allowedMethods }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Não foi possível atualizar a configuração."); return; }
      setMessage("Métodos padrão atualizados para novos cadastros.");
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }
  return <section className="panel billing-settings"><div className="panel-heading"><div><h2>Valores e métodos</h2><p>Os valores padrão são definidos pelos planos. Use o perfil do aluno apenas para criar uma condição exclusiva.</p></div></div><div className="notice"><strong>Valores centralizados em Planos</strong><p>Crie e ajuste serviços, períodos e preços em <Link href="/admin/planos">Planos</Link>. Reajustes de um plano atingem todos os alunos desse plano, exceto os que tiverem valor exclusivo.</p></div><fieldset className="method-options billing-method-options"><legend>Métodos padrão para novos alunos</legend>{(["PIX", "CARD", "BOLETO"] as Method[]).map((method) => <label key={method}><input type="checkbox" checked={allowedMethods.includes(method)} onChange={() => toggleMethod(method)} />{method === "PIX" ? "Pix" : method === "CARD" ? "Cartão" : "Boleto"}</label>)}</fieldset>{error ? <p className="error-message">{error}</p> : null}{message ? <p className="success-message">{message}</p> : null}<div className="creation-actions"><button className="button button-dark" type="button" onClick={save} disabled={pending}>{pending ? "Salvando..." : "Salvar métodos"}</button></div></section>;
}
