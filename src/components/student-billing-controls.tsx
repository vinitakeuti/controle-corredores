"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Method = "PIX" | "CARD" | "BOLETO";

export function StudentBillingControls({ studentId, subscriptionId, initialPriceCents, initialAllowedMethods, automaticPixActive, hasCustomPrice, canDelete = false }: { studentId: string; subscriptionId: string; initialPriceCents: number; initialAllowedMethods: Method[]; automaticPixActive: boolean; hasCustomPrice: boolean; canDelete?: boolean }) {
  const router = useRouter();
  const [price, setPrice] = useState((initialPriceCents / 100).toFixed(2));
  const [allowedMethods, setAllowedMethods] = useState<Method[]>(initialAllowedMethods);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function toggleMethod(method: Method) {
    setAllowedMethods((current) => current.includes(method) ? current.filter((item) => item !== method) : [...current, method]);
  }

  async function save() {
    const priceCents = Math.round(Number(price.replace(",", ".")) * 100);
    if (!Number.isInteger(priceCents) || priceCents < 100 || allowedMethods.length === 0) {
      setError("Informe um valor válido e selecione ao menos um método.");
      return;
    }
    setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/students/${encodeURIComponent(studentId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscriptionId, priceCents, allowedMethods }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Não foi possível atualizar a cobrança."); return; }
      setMessage(data.reauthorizationRequired ? "Cobrança atualizada. O Pix Automático anterior foi cancelado; o aluno deverá autorizar um novo Pix no próximo pagamento." : "Cobrança atualizada para os próximos pagamentos.");
      router.refresh();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/admin/students/${encodeURIComponent(studentId)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Não foi possível excluir o aluno."); return; }
      router.push("/admin/alunos");
      router.refresh();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setPending(false);
    }
  }

  return <section className="panel profile-payments"><div className="panel-heading"><div><h2>Valor e pagamento deste produto</h2><p>O valor padrão vem do plano; altere aqui somente quando houver uma condição exclusiva.</p></div></div>{hasCustomPrice ? <div className="notice"><strong>Valor exclusivo ativo</strong><p>Este produto não acompanhará reajustes do plano até o valor voltar a coincidir com o plano escolhido.</p></div> : null}{automaticPixActive ? <div className="notice"><strong>Pix Automático ativo</strong><p>Ao alterar o valor ou retirar Pix, a autorização atual será cancelada e o aluno precisará consentir novamente.</p></div> : null}<div className="billing-fields"><div className="field"><label htmlFor={`student-price-${subscriptionId}`}>Valor mensal exclusivo (R$)</label><input id={`student-price-${subscriptionId}`} type="number" min="1" max="100000" step="0.01" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} /></div><fieldset className="method-options"><legend>Métodos permitidos</legend>{(["PIX", "CARD", "BOLETO"] as Method[]).map((method) => <label key={method}><input type="checkbox" checked={allowedMethods.includes(method)} onChange={() => toggleMethod(method)} />{method === "PIX" ? "Pix" : method === "CARD" ? "Cartão" : "Boleto"}</label>)}</fieldset></div>{error ? <p className="error-message">{error}</p> : null}{message ? <p className="success-message">{message}</p> : null}<div className="creation-actions"><button className="button button-dark" type="button" onClick={save} disabled={pending}>{pending ? "Salvando..." : "Salvar valor exclusivo"}</button>{canDelete ? (!confirmDelete ? <button className="button button-danger-quiet" type="button" onClick={() => setConfirmDelete(true)} disabled={pending}>Excluir aluno</button> : <><span className="delete-warning">Excluir remove o cadastro, pagamentos e links abertos.</span><button className="button button-quiet" type="button" onClick={() => setConfirmDelete(false)} disabled={pending}>Cancelar</button><button className="button button-danger" type="button" onClick={remove} disabled={pending}>Confirmar exclusão</button></>) : null}</div></section>;
}
