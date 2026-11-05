import Link from "next/link";
import { emailTypeLabels, type EmailLogReport } from "@/lib/email-log";
import { Icon } from "@/components/ui/icon";
import { StatusPill } from "@/components/ui/status-pill";

const dateTime = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Maceio", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

function count(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function pageHref(report: EmailLogReport, page: number) {
  const params = new URLSearchParams({ secao: "emails", emailMonth: report.month.key, emailPage: String(page) });
  if (report.filters.status) params.set("emailStatus", report.filters.status);
  if (report.filters.type) params.set("emailType", report.filters.type);
  return `/admin/configuracoes?${params.toString()}#registro-de-emails`;
}

export function EmailLogPanel({ report }: { report: EmailLogReport }) {
  const { summary } = report;
  const total = summary.sent + summary.failed;
  const successRate = total ? Math.round((summary.sent / total) * 100) : null;

  return <section className="section-block email-log" id="registro-de-emails" aria-labelledby="email-log-title">
    <div className="section-head">
      <div><h2 className="section-title" id="email-log-title">Registro de envios</h2><p className="section-lead">Cada disparo fica registrado com data, horário, destinatário e o motivo de eventuais falhas.</p></div>
    </div>
    <form className="email-log-filter" method="get" action="/admin/configuracoes#registro-de-emails" aria-label="Filtrar registro de envios">
      <input type="hidden" name="secao" value="emails" />
      <div className="form-field"><label htmlFor="email-log-month">Mês</label><input className="control" id="email-log-month" type="month" name="emailMonth" defaultValue={report.month.key} /></div>
      <div className="form-field"><label htmlFor="email-log-status">Status</label><select className="control" id="email-log-status" name="emailStatus" defaultValue={report.filters.status ?? ""}><option value="">Todos</option><option value="SENT">Enviados</option><option value="FAILED">Com falha</option></select></div>
      <div className="form-field"><label htmlFor="email-log-type">Tipo</label><select className="control" id="email-log-type" name="emailType" defaultValue={report.filters.type ?? ""}><option value="">Todos os tipos</option>{Object.entries(emailTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <button className="btn btn-secondary" type="submit">Filtrar</button>
    </form>

    <div className="metric-strip email-log-summary" data-count={3} aria-label={`Resumo de ${report.month.label}`}>
      <div className="metric" data-tone="positive"><span className="metric-label">Enviados com sucesso</span><strong className="metric-value">{summary.sent}</strong><span className="metric-note">em {report.month.label}</span></div>
      <div className="metric" data-tone={summary.failed ? "danger" : undefined}><span className="metric-label">Com falha</span><strong className="metric-value">{summary.failed}</strong><span className="metric-note">em {report.month.label}</span></div>
      <div className="metric"><span className="metric-label">Taxa de entrega</span><strong className="metric-value">{successRate === null ? "—" : `${successRate}%`}</strong><span className="metric-note">{count(total, "disparo", "disparos")} no mês</span></div>
    </div>

    {report.types.length ? <div className="email-type-summary">
      <h3 className="ledger-subtitle">Por tipo de e-mail</h3>
      <ul className="ledger">{report.types.map((row) => <li className="ledger-row" key={row.type}><div className="ledger-row-content">
        <span className="ledger-copy"><strong>{row.label}</strong></span>
        <span className="pill-group"><StatusPill tone="positive">{row.sent} {row.sent === 1 ? "enviado" : "enviados"}</StatusPill><StatusPill tone={row.failed ? "danger" : "neutral"}>{row.failed} com falha</StatusPill></span>
      </div></li>)}</ul>
    </div> : null}

    <div className="email-log-results"><p className="section-lead">{count(report.total, "registro encontrado", "registros encontrados")}</p><span className="field-hint">Mais recentes primeiro</span></div>
    {report.logs.length ? <ol className="email-log-list-v2">
      {report.logs.map((log) => <li key={log.id} data-status={log.status}>
        <div className="email-log-line">
          <StatusPill tone={log.status === "FAILED" ? "danger" : "positive"}>{log.status === "FAILED" ? "Falhou" : "Enviado"}</StatusPill>
          <strong>{emailTypeLabels[log.type as keyof typeof emailTypeLabels] ?? log.type}</strong>
          {log.isTest ? <StatusPill tone="info">Teste</StatusPill> : null}
          <time dateTime={log.createdAt.toISOString()}>{dateTime.format(log.createdAt)}</time>
        </div>
        <p className="email-log-to">Para <b>{log.recipient}</b> · {log.subject}</p>
        {log.status === "FAILED" ? <p className="message" data-tone="danger"><Icon name="alert" /><span><b>Motivo:</b> {log.error ?? "Falha não identificada."}</span></p> : null}
        {log.detail ? <p className="field-hint">{log.detail}</p> : null}
      </li>)}
    </ol> : <div className="state-empty"><strong>Nenhum e-mail registrado com esses filtros.</strong><p>Escolha outro mês, status ou tipo.</p></div>}

    {report.totalPages > 1 ? <nav className="pager" aria-label="Paginação do registro de e-mails">
      <p className="pager-range">Página {report.page} de {report.totalPages}</p>
      <div className="pager-actions">
        {report.page > 1 ? <Link className="btn btn-secondary" href={pageHref(report, report.page - 1)} rel="prev"><Icon name="arrowLeft" />Anterior</Link> : null}
        {report.page < report.totalPages ? <Link className="btn btn-secondary" href={pageHref(report, report.page + 1)} rel="next">Próxima<Icon name="arrowRight" /></Link> : null}
      </div>
    </nav> : null}
  </section>;
}
