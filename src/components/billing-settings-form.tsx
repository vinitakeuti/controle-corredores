"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Method = "PIX" | "CARD" | "BOLETO";

export function BillingSettingsForm({ initialBasePriceCents, initialAllowedMethods }: { initialBasePriceCents: number; initialAllowedMethods: Method[] }) {
  const router = useRouter();
  const [price, setPrice] = useState((initialBasePriceCents / 100).toFixed(2));
  const [allowedMethods, setAllowedMethods] = useState<Method[]>(initialAllowedMethods);
  const [applyToExisting, setApplyToExisting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  function toggleMethod(method: Method) { setAllowedMethods((current) => current.includes(method) ? current.filter((item) => item !== method) : [...current, method]); }
  async function save() {
    const basePriceCents = Math.round(Number(price.replace(",", ".")) * 100);
    if (!Number.isInteger(basePriceCents) || basePriceCents < 100 || allowedMethods.length === 0) { setError("Informe um valor válido e selecione ao menos um método."); return; }
    setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/billing-settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ basePriceCents, defaultAllowedMethods: allowedMethods, applyToExisting }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Não foi possível atualizar a configuração."); return; }
      setMessage(applyToExisting ? `${data.updatedStudents} aluno(s) terão o novo valor na próxima cobrança.${data.reauthorizationRequired ? ` ${data.reauthorizationRequired} autorização(ões) de Pix Automático foram canceladas e precisarão de novo consentimento.` : ""}` : "Preço-base atualizado para novos alunos e novos links.");
      router.refresh();
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }
  return <section className="panel billing-settings"><div className="panel-heading"><div><h2>Preço e métodos padrão</h2><p>Usados ao pré-cadastrar um aluno ou gerar um novo link.</p></div></div><div className="billing-fields"><div className="field"><label htmlFor="platform-price">Mensalidade padrão (R$)</label><input id="platform-price" type="number" min="1" max="100000" step="0.01" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} /></div><fieldset className="method-options"><legend>Métodos padrão</legend>{(["PIX", "CARD", "BOLETO"] as Method[]).map((method) => <label key={method}><input type="checkbox" checked={allowedMethods.includes(method)} onChange={() => toggleMethod(method)} />{method === "PIX" ? "Pix" : method === "CARD" ? "Cartão" : "Boleto"}</label>)}</fieldset></div><label className="bulk-option"><input type="checkbox" checked={applyToExisting} onChange={(event) => setApplyToExisting(event.target.checked)} />Aplicar este novo valor a todos os alunos ativos na próxima cobrança</label>{applyToExisting ? <div className="notice"><strong>Impacto no Pix Automático</strong><p>Como o valor é autorizado pelo aluno, as autorizações vigentes serão canceladas para evitar cobrança com valor antigo. O aluno consentirá novamente no próximo Pix.</p></div> : null}{error ? <p className="error-message">{error}</p> : null}{message ? <p className="success-message">{message}</p> : null}<div className="creation-actions"><button className="button button-dark" type="button" onClick={save} disabled={pending}>{pending ? "Salvando..." : "Salvar configuração"}</button></div></section>;
}
