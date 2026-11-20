"use client";

// Campos do influenciador no programa: os mesmos para adicionar e para editar.
// Comissão: cada item (plano, loja, percentual) segue o programa ou tem valor próprio.
import { percentText, type ProgramDefaults, type RuleChoice } from "@/lib/influencer-draft";

export type { ProgramDefaults, RuleChoice };
export { choiceOf, percentText } from "@/lib/influencer-draft";

export type InfluencerDraft = { type: "EXPERT" | "CREATOR"; couponCode: string; plan: RuleChoice; store: RuleChoice; commissionPercent: string; discountPercent: string; discountUntil: string };

export const emptyInfluencerDraft: InfluencerDraft = { type: "CREATOR", couponCode: "", plan: "program", store: "program", commissionPercent: "", discountPercent: "", discountUntil: "" };

const valueOf = (choice: RuleChoice) => choice === "program" ? null : choice === "yes";

export function influencerPayload(draft: InfluencerDraft) {
  const commission = draft.commissionPercent.trim() ? Number(draft.commissionPercent.replace(",", ".")) : null;
  const discount = draft.discountPercent.trim() ? Number(draft.discountPercent) : 0;
  // A data do desconto vale até o fim do dia escolhido (horário de Maceió).
  const until = draft.discountUntil ? new Date(`${draft.discountUntil}T23:59:59-03:00`).toISOString() : null;
  return { type: draft.type, couponCode: draft.couponCode, planCommission: valueOf(draft.plan), storeCommission: valueOf(draft.store), commissionPercent: commission, discountPercent: discount, discountUntil: discount > 0 ? until : null };
}

// Regra que vai valer para este influenciador, em uma frase.
export function draftRuleSummary(draft: InfluencerDraft, program: ProgramDefaults) {
  const plan = draft.plan === "program" ? program.plan : draft.plan === "yes";
  const store = draft.store === "program" ? program.store : draft.store === "yes";
  const typed = Number(draft.commissionPercent.replace(",", "."));
  const percent = draft.commissionPercent.trim() && Number.isFinite(typed) ? typed : program.percent;
  if ((!plan && !store) || percent === 0) return "Sem comissão: as vendas contam no ranking, mas não geram valor a repassar.";
  const where = plan && store ? "no 1º pagamento do plano e nas compras da loja" : plan ? "só no 1º pagamento do plano" : "só nas compras da loja";
  const follows = draft.plan === "program" && draft.store === "program" && !draft.commissionPercent.trim();
  return `${percentText(percent)} ${where}${follows ? " (segue o programa)" : ""}.`;
}

export function InfluencerFields({ idPrefix, draft, onChange, program }: { idPrefix: string; draft: InfluencerDraft; onChange: (draft: InfluencerDraft) => void; program: ProgramDefaults }) {
  const set = (patch: Partial<InfluencerDraft>) => onChange({ ...draft, ...patch });
  const hasDiscount = Boolean(draft.discountPercent.trim()) && Number(draft.discountPercent) > 0;
  const choice = (id: string, label: string, value: RuleChoice, programValue: boolean, onPick: (value: RuleChoice) => void) => <div className="form-field">
    <label htmlFor={id}>{label}</label>
    <select className="control" id={id} value={value} onChange={(event) => onPick(event.target.value as RuleChoice)}>
      <option value="program">Padrão ({programValue ? "sim" : "não"})</option>
      <option value="yes">Sim</option>
      <option value="no">Não</option>
    </select>
  </div>;
  return <>
    <fieldset className="plan-fieldset">
      <legend className="form-label">Tipo</legend>
      <div className="choice-toggle influencer-type">
        {(["CREATOR", "EXPERT"] as const).map((type) => <button key={type} type="button" aria-pressed={draft.type === type} onClick={() => set({ type })}>
          <strong>{type === "CREATOR" ? "Creator" : "Expert"}</strong>
          <small>{type === "CREATOR" ? "Cria conteúdo e indica pelo cupom." : "Referência técnica que indica pelo cupom."}</small>
        </button>)}
      </div>
    </fieldset>
    <div className="form-field">
      <label htmlFor={`${idPrefix}-coupon`}>Cupom</label>
      <input className="control coupon-input" id={`${idPrefix}-coupon`} value={draft.couponCode} onChange={(event) => set({ couponCode: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} maxLength={20} placeholder="Ex.: GUSTAVO10" autoComplete="off" spellCheck={false} aria-describedby={`${idPrefix}-coupon-hint`} />
      <p className="field-hint" id={`${idPrefix}-coupon-hint`}>Fixo: é com ele que as vendas são atribuídas.</p>
    </div>
    <fieldset className="plan-fieldset commission-rules">
      <legend className="form-label">Comissão</legend>
      <div className="commission-rules-grid">
        {choice(`${idPrefix}-plan`, "No plano (1º pagamento)", draft.plan, program.plan, (plan) => set({ plan }))}
        {choice(`${idPrefix}-store`, "Na loja", draft.store, program.store, (store) => set({ store }))}
        <div className="form-field">
          <label htmlFor={`${idPrefix}-commission`}>Percentual (%)</label>
          <input className="control" id={`${idPrefix}-commission`} type="number" min="0" max="50" step="0.5" inputMode="decimal" value={draft.commissionPercent} onChange={(event) => set({ commissionPercent: event.target.value })} placeholder={`Padrão: ${percentText(program.percent)}`} aria-describedby={`${idPrefix}-commission-hint`} />
          <p className="field-hint" id={`${idPrefix}-commission-hint`}>Em branco segue o padrão do programa.</p>
        </div>
      </div>
      <p className="commission-rule-summary" aria-live="polite">{draftRuleSummary(draft, program)}</p>
    </fieldset>
    <div className="form-grid">
      <div className="form-field">
        <label htmlFor={`${idPrefix}-discount`}>Desconto para quem usa o cupom (%) <span className="optional-tag">opcional</span></label>
        <input className="control" id={`${idPrefix}-discount`} type="number" min="0" max="50" step="1" inputMode="numeric" value={draft.discountPercent} onChange={(event) => set({ discountPercent: event.target.value })} placeholder="Sem desconto" aria-describedby={`${idPrefix}-discount-hint`} />
        <p className="field-hint" id={`${idPrefix}-discount-hint`}>Normalmente vazio. Vale no 1º pagamento do plano e na loja.</p>
      </div>
      {hasDiscount ? <div className="form-field">
        <label htmlFor={`${idPrefix}-discount-until`}>Desconto válido até <span className="optional-tag">opcional</span></label>
        <input className="control" id={`${idPrefix}-discount-until`} type="date" value={draft.discountUntil} onChange={(event) => set({ discountUntil: event.target.value })} aria-describedby={`${idPrefix}-discount-until-hint`} />
        <p className="field-hint" id={`${idPrefix}-discount-until-hint`}>Em branco: vale até alguém tirar o desconto.</p>
      </div> : null}
    </div>
  </>;
}
