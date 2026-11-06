"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Feedback } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";

type Audience = "lead" | "student" | "staff";
type Initial = { assistantName: string; generalInstructions: string; businessInfo: string; leadInstructions: string; studentInstructions: string; staffInstructions: string; monthlyBudgetUsd: number | null };

const audiences: { key: Audience; label: string; when: string; placeholder: string }[] = [
  { key: "lead", label: "Leads", when: "Quem ainda não é aluno e fala com a Pace Lab pelo WhatsApp.", placeholder: "Ex.: convide para uma aula experimental no sábado; pergunte o objetivo e há quanto tempo corre; não insista se a pessoa disser que vai pensar..." },
  { key: "student", label: "Alunos", when: "Alunos reconhecidos pelo telefone do cadastro, no WhatsApp.", placeholder: "Ex.: lembre que a planilha da semana sai no domingo; dúvidas de treino individual vão para o treinador; chame pelo primeiro nome..." },
  { key: "staff", label: "Equipe", when: "A equipe no chat da gestão e no WhatsApp, cada pessoa com o acesso do seu cargo.", placeholder: "Ex.: ao listar inadimplentes, ordene pelo vencimento mais antigo; respostas curtas, em tópicos..." },
];

export function AiAssistantSettings({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [name, setName] = useState(initial.assistantName);
  const [businessInfo, setBusinessInfo] = useState(initial.businessInfo);
  const [generalInstructions, setGeneralInstructions] = useState(initial.generalInstructions);
  const [byAudience, setByAudience] = useState<Record<Audience, string>>({ lead: initial.leadInstructions, student: initial.studentInstructions, staff: initial.staffInstructions });
  const [tab, setTab] = useState<Audience>("lead");
  const [budget, setBudget] = useState(initial.monthlyBudgetUsd != null ? String(initial.monthlyBudgetUsd).replace(".", ",") : "");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const current = audiences.find((item) => item.key === tab) ?? audiences[0];

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setSuccess(""); setError("");
    const normalizedBudget = budget.trim().replace(/\./g, "").replace(",", ".");
    try {
      const response = await fetch("/api/admin/ai/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assistantName: name, businessInfo, generalInstructions, leadInstructions: byAudience.lead, studentInstructions: byAudience.student, staffInstructions: byAudience.staff, monthlyBudgetUsd: normalizedBudget ? Number(normalizedBudget) : null }),
      });
      const data = await response.json();
      if (response.ok) { setSuccess("Configuração do assistente salva."); router.refresh(); } else setError(data.error ?? "Não foi possível salvar.");
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setSaving(false); }
  }

  return (
    <section className="section-block" aria-labelledby="ai-settings-title">
      <div className="section-head">
        <div>
          <h2 className="section-title" id="ai-settings-title">Assistente</h2>
          <p className="section-lead">Nome, o que ele sabe sobre a Pace Lab e como atender cada público. A instrução base (tom, segurança, confirmação das ações) já vem pronta, e as permissões de cada pessoa são conferidas pelo sistema, não por estes textos.</p>
        </div>
      </div>
      <form className="ai-settings-form" onSubmit={onSubmit}>
        <div className="form-field ai-name-field">
          <label htmlFor="ai-name">Nome do assistente</label>
          <input className="control" id="ai-name" maxLength={30} value={name} onChange={(event) => setName(event.target.value)} placeholder="Assistente" autoComplete="off" />
          <p className="field-hint">Aparece no menu no lugar de “Assistente” e é como a IA se apresenta, no app e no WhatsApp.</p>
        </div>

        <div className="form-field">
          <label htmlFor="ai-business">Sobre a assessoria</label>
          <textarea className="control ai-textarea" id="ai-business" rows={7} maxLength={12000} value={businessInfo} onChange={(event) => setBusinessInfo(event.target.value)} placeholder="Ex.: local e horários dos treinos em grupo, como funciona a planilha, eventos, Lab Educa, política de cancelamento..." />
          <p className="field-hint">Leads e alunos também recebem este texto. Escreva só o que é verdade hoje e nada interno (faturamento, custos, senhas, dados de alunos).</p>
        </div>

        <div className="form-field">
          <label htmlFor="ai-general">Instruções gerais</label>
          <textarea className="control ai-textarea" id="ai-general" rows={4} maxLength={8000} value={generalInstructions} onChange={(event) => setGeneralInstructions(event.target.value)} placeholder="Ex.: trate todos por você; nunca use gírias; assine como Pace Lab quando for se despedir..." />
          <p className="field-hint">Valem em todas as conversas, inclusive com leads e alunos. Regras só da equipe vão em Instruções por público › Equipe.</p>
        </div>

        <fieldset className="ai-audience">
          <legend>Instruções por público</legend>
          <p className="field-hint">Cada texto entra só quando a IA está atendendo aquele público.</p>
          <div className="ai-audience-tabs" role="tablist" aria-label="Público">
            {audiences.map((item) => (
              <button key={item.key} type="button" role="tab" id={`ai-aud-${item.key}`} aria-selected={tab === item.key} aria-controls="ai-aud-panel" onClick={() => setTab(item.key)}>
                {item.label}{byAudience[item.key].trim() ? <span className="ai-audience-dot" aria-label="preenchido" /> : null}
              </button>
            ))}
          </div>
          <div className="form-field" id="ai-aud-panel" role="tabpanel" aria-labelledby={`ai-aud-${tab}`}>
            <label className="visually-hidden" htmlFor="ai-aud-text">Instruções para {current.label.toLowerCase()}</label>
            <textarea className="control ai-textarea" id="ai-aud-text" rows={6} maxLength={8000} value={byAudience[tab]} onChange={(event) => setByAudience((values) => ({ ...values, [tab]: event.target.value }))} placeholder={current.placeholder} />
            <p className="field-hint">{current.when}</p>
          </div>
        </fieldset>

        <div className="form-field ai-budget">
          <label htmlFor="ai-budget">Limite de gasto mensal (US$)</label>
          <input className="control" id="ai-budget" inputMode="decimal" value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="Sem limite" />
          <p className="field-hint">Ao atingir o limite, o assistente para de responder até o mês seguinte. Deixe vazio para não limitar.</p>
        </div>
        <div className="ai-settings-actions">
          <button className="btn btn-primary" type="submit" disabled={saving} aria-busy={saving}><Icon name="check" />{saving ? "Salvando..." : "Salvar"}</button>
        </div>
        <Feedback success={success} error={error} />
      </form>
    </section>
  );
}
