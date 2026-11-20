"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { emptyInfluencerDraft, InfluencerFields, influencerPayload, percentText, type InfluencerDraft, type ProgramDefaults } from "@/components/influencer-fields";
import { Feedback } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { QrPanel } from "@/components/ui/qr-code";
import { Sheet } from "@/components/ui/sheet";
import { StatusPill } from "@/components/ui/status-pill";
import { formatCpfInput, formatCurrency, formatPhoneInput } from "@/lib/format";

export type InfluencerRow = {
  id: string; name: string; isStudent: boolean; type: "EXPERT" | "CREATOR"; couponCode: string; rule: string; customRule: boolean; discount: string | null; active: boolean;
  sales: number; amountCents: number; commissionCents: number; salesDelta: number; payout: "APPROVED" | "PAID" | null;
};
type StudentOption = { id: string; name: string; email: string };
type Access = { name: string; email: string; temporaryPassword: string; loginUrl: string; firstAccessUrl: string };

const typeLabel = { EXPERT: "Expert", CREATOR: "Creator" } as const;
const payoutLabel = (payout: InfluencerRow["payout"], closed: boolean) => payout === "PAID" ? <StatusPill tone="positive">Pago</StatusPill> : payout === "APPROVED" ? <StatusPill tone="info">Aprovado</StatusPill> : <StatusPill tone="neutral">{closed ? "A aprovar" : "Em aberto"}</StatusPill>;

export function InfluencersManager({ rows, students, showCommission, monthClosed, initialStudentId, program }: { rows: InfluencerRow[]; students: StudentOption[]; showCommission: boolean; monthClosed: boolean; initialStudentId: string | null; program: ProgramDefaults }) {
  const router = useRouter();
  const preselected = students.find((student) => student.id === initialStudentId) ?? null;
  const [adding, setAdding] = useState(Boolean(preselected));
  const [source, setSource] = useState<"student" | "partner">("student");
  const [studentQuery, setStudentQuery] = useState(preselected?.name ?? "");
  const [studentId, setStudentId] = useState(preselected?.id ?? "");
  const [partner, setPartner] = useState({ name: "", email: "", phone: "", cpf: "" });
  const [draft, setDraft] = useState<InfluencerDraft>(emptyInfluencerDraft);
  const [access, setAccess] = useState<Access | null>(null);
  const [visible, setVisible] = useState(showCommission);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState("");
  const [editingRules, setEditingRules] = useState(false);
  const [rulesDraft, setRulesDraft] = useState({ plan: program.plan, store: program.store, percent: String(program.percent) });

  const matches = useMemo(() => {
    const query = studentQuery.trim().toLowerCase();
    if (!query || students.some((student) => student.id === studentId && student.name.toLowerCase() === query)) return [];
    return students.filter((student) => student.name.toLowerCase().includes(query) || student.email.includes(query)).slice(0, 6);
  }, [studentQuery, studentId, students]);

  function openAdd() { setError(""); setAccess(null); setSource("student"); setStudentQuery(""); setStudentId(""); setPartner({ name: "", email: "", phone: "", cpf: "" }); setDraft(emptyInfluencerDraft); setAdding(true); }
  function closeAdd() { setAdding(false); setError(""); if (access) router.refresh(); setAccess(null); if (initialStudentId) router.replace("/admin/marketing/creators"); }

  async function submit() {
    if (source === "student" && !studentId) { setError("Escolha o aluno na lista."); return; }
    if (draft.couponCode.length < 3) { setError("Defina um cupom com pelo menos 3 letras ou números."); return; }
    setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/influencers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...influencerPayload(draft), ...(source === "student" ? { studentId } : { partner }) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível adicionar ao programa.");
      if (data.access) { setAccess(data.access); return; }
      setMessage(`${students.find((student) => student.id === studentId)?.name ?? "Aluno"} agora faz parte do programa com o cupom ${draft.couponCode}.`);
      setAdding(false); router.replace("/admin/marketing/creators"); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }

  async function toggleVisibility(next: boolean) {
    setVisible(next); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/marketing/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ showCommission: next }) });
      if (!response.ok) throw new Error();
      setMessage(next ? "Os influenciadores já veem os valores de comissão no portal." : "Valores de comissão ocultos no portal dos influenciadores.");
    } catch { setVisible(!next); setError("Não foi possível alterar a exibição da comissão."); }
  }

  async function saveRules() {
    const percent = Number(rulesDraft.percent.replace(",", "."));
    if (!rulesDraft.percent.trim() || !Number.isFinite(percent) || percent < 0 || percent > 50) { setError("Informe um percentual entre 0% e 50%."); return; }
    setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/marketing/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planCommissionEnabled: rulesDraft.plan, storeCommissionEnabled: rulesDraft.store, defaultCommissionPercent: percent }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível salvar as regras.");
      setMessage("Regras do programa salvas. Valem para as próximas vendas de quem segue o programa.");
      setEditingRules(false); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }

  async function copy(label: string, value: string) {
    try { await navigator.clipboard.writeText(value); setCopied(label); window.setTimeout(() => setCopied(""), 1800); } catch { setError("Não foi possível copiar."); }
  }

  const accessMessage = access ? `Olá, ${access.name.split(" ")[0]}!\n\nSeu acesso ao programa Experts & Creators da Pace Lab foi criado. Entre em:\n${access.loginUrl}\n\nE-mail: ${access.email}\nSenha temporária: ${access.temporaryPassword}\n\nSeu cupom: ${draft.couponCode}` : "";

  return <div className="influencers">
    <section className="section-block program-rules" aria-labelledby="program-rules-title">
      <div className="commission-visibility-copy">
        <h2 className="section-title" id="program-rules-title">Regras do programa</h2>
        <p className="section-lead">Padrão para quem não tem regra própria. Cada influenciador pode ter a sua.</p>
      </div>
      <dl className="program-rules-list">
        <div><dt>Plano (1º pagamento)</dt><dd>{program.plan ? "Com comissão" : "Sem comissão"}</dd></div>
        <div><dt>Loja</dt><dd>{program.store ? "Com comissão" : "Sem comissão"}</dd></div>
        <div><dt>Percentual</dt><dd>{percentText(program.percent)}</dd></div>
      </dl>
      <button className="btn btn-secondary" type="button" onClick={() => { setRulesDraft({ plan: program.plan, store: program.store, percent: String(program.percent) }); setError(""); setEditingRules(true); }}><Icon name="edit" />Editar regras</button>
    </section>

    <section className="section-block commission-visibility" aria-labelledby="commission-visibility-title">
      <div className="commission-visibility-copy">
        <h2 className="section-title" id="commission-visibility-title">Comissão no portal</h2>
        <p className="section-lead">{visible ? "Os influenciadores veem quanto têm de comissão e os repasses." : "Os influenciadores veem vendas e valores vendidos, mas não a comissão."}</p>
      </div>
      <label className="switch"><input type="checkbox" role="switch" checked={visible} onChange={(event) => { void toggleVisibility(event.target.checked); }} /><span className="switch-track" aria-hidden="true" /><span>{visible ? "Mostrando" : "Oculta"}</span></label>
    </section>

    <div className="plans-toolbar">
      <p className="plans-summary">{rows.length} {rows.length === 1 ? "influenciador" : "influenciadores"} · {rows.filter((row) => row.active).length} ativos</p>
      <button className="btn btn-primary" type="button" onClick={openAdd}><Icon name="plus" />Adicionar ao programa</button>
    </div>
    <Feedback success={message} error={!adding && !editingRules ? error : ""} />

    {rows.length ? <>
      <div className="data-table-wrap responsive-table influencer-table-wrap">
        <table className="data-table influencer-table">
          <caption className="visually-hidden">Influenciadores e resultado do mês</caption>
          <thead><tr><th scope="col">Influenciador</th><th scope="col">Cupom</th><th scope="col" className="num">Vendas</th><th scope="col" className="num">Valor vendido</th><th scope="col" className="num">Comissão</th><th scope="col">Repasse</th><th scope="col"><span className="visually-hidden">Ações</span></th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id} data-paused={row.active ? undefined : true}>
            <td><span className="cell-primary influencer-name">{row.name}<StatusPill tone="info">{typeLabel[row.type]}</StatusPill>{row.active ? null : <StatusPill tone="neutral">Pausado</StatusPill>}</span><span className="cell-secondary">{row.isStudent ? "Aluno" : "Parceiro"} · {row.rule}{row.customRule ? " (regra própria)" : ""}{row.discount ? ` · desconto ${row.discount}` : ""}</span></td>
            <td><code className="coupon-code">{row.couponCode}</code></td>
            <td className="num"><strong>{row.sales}</strong>{row.salesDelta ? <span className="cell-secondary">{row.salesDelta > 0 ? "+" : ""}{row.salesDelta} vs. mês anterior</span> : null}</td>
            <td className="num">{formatCurrency(row.amountCents)}</td>
            <td className="num">{formatCurrency(row.commissionCents)}</td>
            <td>{row.sales ? payoutLabel(row.payout, monthClosed) : <span className="cell-secondary">—</span>}</td>
            <td><Link className="btn btn-quiet" href={`/admin/marketing/creators/${row.id}`} aria-label={`Ver ${row.name}`}>Ver</Link></td>
          </tr>)}</tbody>
        </table>
      </div>
      <ul className="data-rows responsive-rows influencer-rows" aria-label="Influenciadores">
        {rows.map((row) => <li key={row.id}>
          <Link className="row-title" href={`/admin/marketing/creators/${row.id}`}>{row.name}</Link>
          <StatusPill tone="info">{typeLabel[row.type]}</StatusPill>
          <span className="row-meta"><code className="coupon-code">{row.couponCode}</code><span>{row.sales} {row.sales === 1 ? "venda" : "vendas"} · {formatCurrency(row.amountCents)}</span><span>Comissão {formatCurrency(row.commissionCents)}</span></span>
        </li>)}
      </ul>
    </> : <div className="state-empty"><strong>Ninguém no programa ainda.</strong><p>Adicione um aluno ou um parceiro como Expert ou Creator e defina o cupom dele.</p></div>}

    {editingRules ? <Sheet open onClose={() => { setEditingRules(false); setError(""); }} title="Regras do programa">
      <form className="sheet-form" onSubmit={(event) => { event.preventDefault(); void saveRules(); }}>
        <label className="check"><input type="checkbox" checked={rulesDraft.plan} onChange={(event) => setRulesDraft({ ...rulesDraft, plan: event.target.checked })} /><span className="check-copy"><strong>Comissão no plano</strong><small>Sobre o 1º pagamento do aluno indicado pelo cupom.</small></span></label>
        <label className="check"><input type="checkbox" checked={rulesDraft.store} onChange={(event) => setRulesDraft({ ...rulesDraft, store: event.target.checked })} /><span className="check-copy"><strong>Comissão na loja</strong><small>Sobre cada pedido pago com o cupom.</small></span></label>
        <div className="form-field"><label htmlFor="program-percent">Percentual padrão (%)</label><input className="control" id="program-percent" type="number" min="0" max="50" step="0.5" inputMode="decimal" value={rulesDraft.percent} onChange={(event) => setRulesDraft({ ...rulesDraft, percent: event.target.value })} /></div>
        <p className="message" data-tone="info"><Icon name="info" /><span>Vale para as próximas vendas de quem segue o programa. Vendas já registradas mantêm a comissão da época, e regras próprias não mudam.</span></p>
        <Feedback error={error} />
        <div className="btn-row btn-row-split sheet-actions">
          <button className="btn btn-quiet" type="button" onClick={() => { setEditingRules(false); setError(""); }} disabled={pending}>Cancelar</button>
          <button className="btn btn-primary" type="submit" disabled={pending} aria-busy={pending}>{pending ? "Salvando..." : "Salvar regras"}</button>
        </div>
      </form>
    </Sheet> : null}

    {adding ? <Sheet open onClose={closeAdd} title={access ? "Acesso criado" : "Adicionar ao programa"} className="sheet-wide">
      {access ? <div className="sheet-form">
        <QrPanel value={access.firstAccessUrl} label={`QR Code de primeiro acesso de ${access.name}`} title="Escaneie com a câmera do celular">
          <p>{access.name.split(" ")[0]} cria a própria senha e já entra no portal do programa. Vale por 24 horas e uma única vez.</p>
        </QrPanel>
        <dl className="summary-strip create-credentials">
          <div><dt>E-mail</dt><dd>{access.email}</dd></div>
          <div><dt>Senha temporária</dt><dd className="create-password">{access.temporaryPassword}</dd></div>
        </dl>
        <span className="visually-hidden" aria-live="polite">{copied ? "Copiado." : ""}</span>
        <div className="btn-row btn-row-split sheet-actions">
          <button className="btn btn-quiet" type="button" onClick={closeAdd}>Concluir</button>
          <button className="btn btn-primary" type="button" onClick={() => copy("message", accessMessage)}><Icon name={copied === "message" ? "check" : "copy"} />{copied === "message" ? "Mensagem copiada" : "Copiar mensagem com acesso"}</button>
        </div>
      </div> : <form className="sheet-form" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <div className="choice-toggle influencer-source">
          <button type="button" aria-pressed={source === "student"} onClick={() => setSource("student")}><strong>Aluno da Pace Lab</strong><small>Já tem conta; o portal aparece no menu dele.</small></button>
          <button type="button" aria-pressed={source === "partner"} onClick={() => setSource("partner")}><strong>Parceiro</strong><small>Não é aluno; recebe um acesso só ao programa.</small></button>
        </div>
        {source === "student" ? <div className="form-field student-search">
          <label htmlFor="influencer-student">Aluno</label>
          <input className="control" id="influencer-student" value={studentQuery} onChange={(event) => { setStudentQuery(event.target.value); setStudentId(""); }} placeholder="Busque pelo nome ou e-mail" autoComplete="off" aria-describedby="influencer-student-chosen" />
          {matches.length ? <ul className="student-search-results" role="listbox" aria-label="Alunos encontrados">{matches.map((student) => <li key={student.id}><button type="button" role="option" aria-selected={studentId === student.id} onClick={() => { setStudentId(student.id); setStudentQuery(student.name); }}><strong>{student.name}</strong><span>{student.email}</span></button></li>)}</ul> : null}
          <p className="field-hint" id="influencer-student-chosen">{studentId ? `Selecionado: ${students.find((student) => student.id === studentId)?.email}` : "Só aparecem alunos que ainda não estão no programa."}</p>
        </div> : <div className="create-fields">
          <div className="form-field create-field-wide"><label htmlFor="partner-name">Nome completo</label><input className="control" id="partner-name" value={partner.name} onChange={(event) => setPartner({ ...partner, name: event.target.value })} autoComplete="off" /></div>
          <div className="form-field create-field-wide"><label htmlFor="partner-email">E-mail</label><input className="control" id="partner-email" type="email" value={partner.email} onChange={(event) => setPartner({ ...partner, email: event.target.value })} autoComplete="off" /></div>
          <div className="form-field"><label htmlFor="partner-phone">Telefone</label><input className="control" id="partner-phone" value={partner.phone} onChange={(event) => setPartner({ ...partner, phone: formatPhoneInput(event.target.value) })} inputMode="tel" maxLength={15} /></div>
          <div className="form-field"><label htmlFor="partner-cpf">CPF <span className="optional-tag">opcional</span></label><input className="control" id="partner-cpf" value={partner.cpf} onChange={(event) => setPartner({ ...partner, cpf: formatCpfInput(event.target.value) })} inputMode="numeric" maxLength={14} /></div>
        </div>}
        <InfluencerFields idPrefix="new-influencer" draft={draft} onChange={setDraft} program={program} />
        <Feedback error={error} />
        <div className="btn-row btn-row-split sheet-actions">
          <button className="btn btn-quiet" type="button" onClick={closeAdd} disabled={pending}>Cancelar</button>
          <button className="btn btn-primary" type="submit" disabled={pending} aria-busy={pending}>{pending ? "Salvando..." : source === "student" ? "Adicionar aluno" : "Criar acesso do parceiro"}</button>
        </div>
      </form>}
    </Sheet> : null}
  </div>;
}
