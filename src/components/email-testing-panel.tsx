"use client";

import { FormEvent, useState } from "react";

type Template = "password-reset" | "payment-failed" | "payment-paid" | "due-tomorrow";
const labels: Record<Template, string> = { "password-reset": "Redefinição de senha", "payment-failed": "Falha no pagamento", "payment-paid": "Pagamento confirmado", "due-tomorrow": "Vencimento amanhã" };

export function EmailTestingPanel({ initialRecipient, configured, host }: { initialRecipient: string; configured: boolean; host: string | null }) {
  const [recipient, setRecipient] = useState(initialRecipient);
  const [type, setType] = useState<Template>("password-reset");
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [feedback, setFeedback] = useState("");
  async function sendPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setFeedback("");
    try {
      const response = await fetch("/api/admin/email/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipient, type }) });
      const data = await response.json();
      setFeedback(response.ok ? `Pronto: ${data.message}` : data.error ?? "Não foi possível enviar o teste.");
    } catch { setFeedback("Não foi possível conectar ao servidor."); } finally { setLoading(false); }
  }
  async function runReminders() {
    setRunning(true); setFeedback("");
    try {
      const response = await fetch("/api/admin/email/reminders", { method: "POST" });
      const data = await response.json();
      setFeedback(response.ok ? `Verificação concluída: ${data.checked} assinaturas analisadas, ${data.sent} e-mail(s) enviado(s).` : data.error ?? "Não foi possível executar os lembretes.");
    } catch { setFeedback("Não foi possível conectar ao servidor."); } finally { setRunning(false); }
  }
  return <section className="email-testing-panel"><div className="email-testing-heading"><div><p className="eyebrow">Comunicação</p><h2>E-mails da Pace Lab</h2><p>Envie uma prévia dos modelos antes de ativar os disparos automáticos.</p></div><span className={configured ? "email-status ready" : "email-status"}>{configured ? "SMTP configurado" : "SMTP pendente"}</span></div>{configured ? <p className="email-config-note">Servidor configurado: {host}. Os e-mails reais são enviados após os eventos de senha e pagamento.</p> : <p className="email-config-note">Adicione as variáveis SMTP no EasyPanel e reinicie o serviço para liberar envios.</p>}<form className="email-test-form" onSubmit={sendPreview}><div className="field"><label htmlFor="email-test-recipient">Enviar teste para</label><input id="email-test-recipient" type="email" value={recipient} onChange={(event) => setRecipient(event.target.value)} required /></div><div className="field"><label htmlFor="email-test-template">Modelo</label><select id="email-test-template" value={type} onChange={(event) => setType(event.target.value as Template)}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><button className="button button-dark" type="submit" disabled={!configured || loading}>{loading ? "Enviando..." : "Enviar e-mail de teste"}</button></form><div className="email-reminder-run"><div><strong>Verificar lembretes agora</strong><span>Executa a mesma checagem diária para vencimentos de amanhã.</span></div><button className="button button-quiet" type="button" disabled={!configured || running} onClick={runReminders}>{running ? "Verificando..." : "Executar verificação"}</button></div>{feedback ? <p className={feedback.startsWith("Pronto") || feedback.startsWith("Verificação concluída") ? "success-message" : "error-message"}>{feedback}</p> : null}</section>;
}
