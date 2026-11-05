"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Feedback } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { StatusPill } from "@/components/ui/status-pill";

type Template = "password-reset" | "payment-failed" | "payment-paid" | "due-tomorrow";
const labels: Record<Template, string> = { "password-reset": "Redefinição de senha", "payment-failed": "Falha no pagamento", "payment-paid": "Pagamento confirmado", "due-tomorrow": "Vencimento amanhã" };

export function EmailTestingPanel({ initialRecipient, configured, host }: { initialRecipient: string; configured: boolean; host: string | null }) {
  const router = useRouter();
  const [recipient, setRecipient] = useState(initialRecipient);
  const [type, setType] = useState<Template>("password-reset");
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  async function sendPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setSuccess(""); setError("");
    try {
      const response = await fetch("/api/admin/email/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipient, type }) });
      const data = await response.json();
      if (response.ok) setSuccess(`Pronto: ${data.message}`); else setError(data.error ?? "Não foi possível enviar o teste.");
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setLoading(false); router.refresh(); }
  }
  async function runReminders() {
    setRunning(true); setSuccess(""); setError("");
    try {
      const response = await fetch("/api/admin/email/reminders", { method: "POST" });
      const data = await response.json();
      if (response.ok) setSuccess(`Verificação concluída: ${data.checked} ${data.checked === 1 ? "assinatura analisada" : "assinaturas analisadas"}, ${data.sent} ${data.sent === 1 ? "e-mail enviado" : "e-mails enviados"}.`); else setError(data.error ?? "Não foi possível executar os lembretes.");
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setRunning(false); router.refresh(); }
  }
  return <section className="section-block email-test" aria-labelledby="email-test-title">
    <div className="section-head">
      <div><h2 className="section-title" id="email-test-title">E-mails da Pace Lab</h2><p className="section-lead">Envie uma prévia dos modelos. Os testes também aparecem no registro de envios abaixo.</p></div>
      <StatusPill tone={configured ? "positive" : "warning"}>{configured ? "SMTP configurado" : "SMTP pendente"}</StatusPill>
    </div>
    <p className="message" data-tone={configured ? "neutral" : "warning"}><Icon name={configured ? "info" : "alert"} /><span>{configured ? `Servidor configurado: ${host}. Os e-mails reais são enviados após os eventos de senha e pagamento.` : "Adicione as variáveis SMTP no EasyPanel e reinicie o serviço para liberar envios."}</span></p>
    <form className="email-preview-form" onSubmit={sendPreview}>
      <div className="form-field"><label htmlFor="email-test-recipient">Enviar teste para</label><input className="control" id="email-test-recipient" type="email" value={recipient} onChange={(event) => setRecipient(event.target.value)} required /></div>
      <div className="form-field"><label htmlFor="email-test-template">Modelo</label><select className="control" id="email-test-template" value={type} onChange={(event) => setType(event.target.value as Template)}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <button className="btn btn-primary" type="submit" disabled={!configured || loading} aria-busy={loading}><Icon name="mail" />{loading ? "Enviando..." : "Enviar e-mail de teste"}</button>
    </form>
    <div className="email-reminders">
      <span className="activity-copy"><strong>Verificar lembretes agora</strong><span>Executa a mesma checagem diária para vencimentos de amanhã.</span></span>
      <button className="btn btn-secondary" type="button" disabled={!configured || running} aria-busy={running} onClick={runReminders}>{running ? "Verificando..." : "Executar verificação"}</button>
    </div>
    <Feedback success={success} error={error} />
  </section>;
}
