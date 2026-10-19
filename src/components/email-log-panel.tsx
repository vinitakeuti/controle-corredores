import Link from "next/link";
import { emailTypeLabels, type EmailLogReport } from "@/lib/email-log";

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

  return <section className="email-log-panel" id="registro-de-emails" aria-labelledby="email-log-title">
    <div className="email-log-heading">
      <div><p className="eyebrow">Monitoramento</p><h2 id="email-log-title">Registro de envios</h2><p>Cada disparo fica registrado com data, horário, destinatário e o motivo de eventuais falhas.</p></div>
      <form className="email-log-filters" method="get" action="/admin/configuracoes#registro-de-emails">
        <input type="hidden" name="secao" value="emails" />
        <label><span>Mês</span><input type="month" name="emailMonth" defaultValue={report.month.key} /></label>
        <label><span>Status</span><select name="emailStatus" defaultValue={report.filters.status ?? ""}><option value="">Todos</option><option value="SENT">Enviados</option><option value="FAILED">Com falha</option></select></label>
        <label><span>Tipo</span><select name="emailType" defaultValue={report.filters.type ?? ""}><option value="">Todos os tipos</option>{Object.entries(emailTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <button className="button button-dark" type="submit">Filtrar</button>
      </form>
    </div>

    <div className="email-log-metrics" aria-label={`Resumo de ${report.month.label}`}>
      <article className="sent"><p>Enviados com sucesso</p><strong>{summary.sent}</strong><small>em {report.month.label}</small></article>
      <article className="failed"><p>Com falha</p><strong>{summary.failed}</strong><small>em {report.month.label}</small></article>
      <article><p>Taxa de entrega</p><strong>{successRate === null ? "—" : `${successRate}%`}</strong><small>{count(total, "disparo", "disparos")} no mês</small></article>
    </div>

    {report.types.length ? <div className="email-log-types">
      <p>Por tipo de e-mail</p>
      {report.types.map((row) => <div key={row.type}><span>{row.label}</span><b className="sent">{row.sent} enviado{row.sent === 1 ? "" : "s"}</b><b className={row.failed ? "failed" : "muted"}>{row.failed} com falha</b></div>)}
    </div> : null}

    <div className="email-log-results-heading"><p>{count(report.total, "registro encontrado", "registros encontrados")}</p><span>Mais recentes primeiro</span></div>
    {report.logs.length ? <ol className="email-log-list">
      {report.logs.map((log) => <li key={log.id} className={log.status === "FAILED" ? "is-failed" : "is-sent"}>
        <div className="email-log-row-top">
          <span className={`email-log-status ${log.status === "FAILED" ? "failed" : "sent"}`}>{log.status === "FAILED" ? "Falhou" : "Enviado"}</span>
          <strong>{emailTypeLabels[log.type as keyof typeof emailTypeLabels] ?? log.type}</strong>
          {log.isTest ? <em>Teste</em> : null}
          <time dateTime={log.createdAt.toISOString()}>{dateTime.format(log.createdAt)}</time>
        </div>
        <p className="email-log-recipient">Para <b>{log.recipient}</b> · {log.subject}</p>
        {log.status === "FAILED" ? <p className="email-log-error"><b>Motivo:</b> {log.error ?? "Falha não identificada."}</p> : null}
        {log.detail ? <p className="email-log-detail">{log.detail}</p> : null}
      </li>)}
    </ol> : <p className="empty-state">Nenhum e-mail registrado com esses filtros.</p>}

    {report.totalPages > 1 ? <nav className="email-log-pagination" aria-label="Paginação do registro de e-mails">
      <span>Página {report.page} de {report.totalPages}</span>
      <div>
        {report.page > 1 ? <Link className="button button-quiet" href={pageHref(report, report.page - 1)}>Anterior</Link> : null}
        {report.page < report.totalPages ? <Link className="button button-quiet" href={pageHref(report, report.page + 1)}>Próxima</Link> : null}
      </div>
    </nav> : null}
  </section>;
}
