"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Method = "PIX" | "CARD" | "BOLETO";
type StudentPrice = { id: string; name: string; email: string; priceCents: number };

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export function BillingSettingsForm({ initialBasePriceCents, initialAllowedMethods, students }: { initialBasePriceCents: number; initialAllowedMethods: Method[]; students: StudentPrice[] }) {
  const router = useRouter();
  const [price, setPrice] = useState((initialBasePriceCents / 100).toFixed(2));
  const [allowedMethods, setAllowedMethods] = useState<Method[]>(initialAllowedMethods);
  const [applyToExisting, setApplyToExisting] = useState(false);
  const [excludedStudentIds, setExcludedStudentIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  function toggleMethod(method: Method) { setAllowedMethods((current) => current.includes(method) ? current.filter((item) => item !== method) : [...current, method]); }
  function toggleStudent(studentId: string) { setExcludedStudentIds((current) => current.includes(studentId) ? current.filter((id) => id !== studentId) : [...current, studentId]); }
  const nextPriceCents = Math.round(Number(price.replace(",", ".")) * 100);
  const canAdjustExisting = applyToExisting && Number.isInteger(nextPriceCents) && nextPriceCents >= 100 && nextPriceCents !== initialBasePriceCents;
  const priceGroups = students.reduce<Map<number, StudentPrice[]>>((groups, student) => {
    groups.set(student.priceCents, [...(groups.get(student.priceCents) ?? []), student]);
    return groups;
  }, new Map());
  async function save() {
    const basePriceCents = Math.round(Number(price.replace(",", ".")) * 100);
    if (!Number.isInteger(basePriceCents) || basePriceCents < 100 || allowedMethods.length === 0) { setError("Informe um valor válido e selecione ao menos um método."); return; }
    setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/billing-settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ basePriceCents, defaultAllowedMethods: allowedMethods, applyToExisting, excludedStudentIds }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Não foi possível atualizar a configuração."); return; }
      setMessage(applyToExisting ? `${data.updatedStudents} aluno(s) terão o novo valor na próxima cobrança.${data.excludedStudents ? ` ${data.excludedStudents} aluno(s) foram mantidos com o valor atual.` : ""}${data.reauthorizationRequired ? ` ${data.reauthorizationRequired} autorização(ões) de Pix Automático foram canceladas e precisarão de novo consentimento.` : ""}` : "Preço-base atualizado para novos alunos e novos links.");
      router.refresh();
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }
  return <section className="panel billing-settings"><div className="panel-heading"><div><h2>Preço e métodos padrão</h2><p>Usados ao pré-cadastrar um aluno ou gerar um novo link.</p></div></div><div className="billing-fields"><div className="field"><label htmlFor="platform-price">Mensalidade padrão (R$)</label><input id="platform-price" type="number" min="1" max="100000" step="0.01" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} /></div><fieldset className="method-options"><legend>Métodos padrão</legend>{(["PIX", "CARD", "BOLETO"] as Method[]).map((method) => <label key={method}><input type="checkbox" checked={allowedMethods.includes(method)} onChange={() => toggleMethod(method)} />{method === "PIX" ? "Pix" : method === "CARD" ? "Cartão" : "Boleto"}</label>)}</fieldset></div><label className="bulk-option"><input type="checkbox" checked={applyToExisting} onChange={(event) => setApplyToExisting(event.target.checked)} />Aplicar este novo valor aos alunos ativos na próxima cobrança</label>{applyToExisting ? <div className="notice"><strong>Reajuste seletivo</strong><p>Desmarque abaixo os alunos com condição especial. Apenas os marcados receberão o novo valor.</p></div> : null}{canAdjustExisting ? <section className="billing-price-groups" aria-labelledby="billing-price-groups-title"><div className="billing-price-groups-heading"><div><p className="eyebrow">Confirme o reajuste</p><h3 id="billing-price-groups-title">Valores atuais por aluno</h3><p>{students.length - excludedStudentIds.length} de {students.length} aluno(s) selecionado(s) para {formatCurrency(nextPriceCents)}.</p></div></div>{[...priceGroups.entries()].map(([currentPrice, group]) => <div className="billing-price-group" key={currentPrice}><div className="billing-price-group-heading"><strong>{formatCurrency(currentPrice)}</strong><span>{group.length} aluno(s)</span></div><div className="billing-student-list">{group.map((student) => <label key={student.id} className="billing-student-option"><input type="checkbox" checked={!excludedStudentIds.includes(student.id)} onChange={() => toggleStudent(student.id)} /><span><strong>{student.name}</strong><small>{student.email}</small></span><em>{excludedStudentIds.includes(student.id) ? "Manter valor" : `Reajustar para ${formatCurrency(nextPriceCents)}`}</em></label>)}</div></div>)}</section> : <section className="billing-price-groups billing-price-overview" aria-labelledby="billing-price-overview-title"><div className="billing-price-groups-heading"><div><p className="eyebrow">Visão atual</p><h3 id="billing-price-overview-title">Valores por aluno</h3><p>Confira condições especiais antes de iniciar um reajuste.</p></div></div>{[...priceGroups.entries()].map(([currentPrice, group]) => <div className="billing-price-group" key={currentPrice}><div className="billing-price-group-heading"><strong>{formatCurrency(currentPrice)}</strong><span>{group.length} aluno(s)</span></div><div className="billing-student-names">{group.map((student) => <span key={student.id}>{student.name}</span>)}</div></div>)}</section>}{applyToExisting && !canAdjustExisting && nextPriceCents === initialBasePriceCents ? <p className="billing-adjustment-note">Informe um novo valor para selecionar os alunos que receberão o reajuste.</p> : null}{canAdjustExisting ? <div className="notice"><strong>Impacto no Pix Automático</strong><p>As autorizações vigentes dos alunos selecionados serão canceladas para evitar cobrança com valor antigo. Eles precisarão consentir novamente no próximo Pix.</p></div> : null}{error ? <p className="error-message">{error}</p> : null}{message ? <p className="success-message">{message}</p> : null}<div className="creation-actions"><button className="button button-dark" type="button" onClick={save} disabled={pending}>{pending ? "Salvando..." : "Salvar configuração"}</button></div></section>;
}
