import { EmailLogStatus, Prisma } from "@prisma/client";
import { currentMonthInMaceio } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const emailTypeLabels = {
  PASSWORD_RESET: "Redefinição de senha",
  COLLABORATOR_WELCOME: "Boas-vindas ao colaborador",
  DEMAND_ASSIGNMENT: "Nova demanda",
  PAYMENT_PAID: "Pagamento confirmado",
  PAYMENT_FAILED: "Falha no pagamento",
  DUE_TOMORROW: "Vencimento amanhã",
} as const;

export type EmailType = keyof typeof emailTypeLabels;

const PAGE_SIZE = 25;
const CONNECTION_CODES = new Set(["ECONNECTION", "ETIMEDOUT", "ESOCKET", "EDNS", "ECONNREFUSED", "ECONNRESET", "EHOSTUNREACH", "ENOTFOUND"]);

export function emailTypeLabel(type: string) {
  return (emailTypeLabels as Record<string, string>)[type] ?? type;
}

export function isEmailType(value: unknown): value is EmailType {
  return typeof value === "string" && Object.hasOwn(emailTypeLabels, value);
}

/**
 * Traduz os erros do nodemailer em um motivo legível. O detalhe técnico
 * (código, resposta SMTP ou mensagem original) é guardado à parte para suporte.
 */
export function describeEmailFailure(error: unknown) {
  const value = (error && typeof error === "object" ? error : {}) as { code?: unknown; responseCode?: unknown; response?: unknown };
  const code = typeof value.code === "string" ? value.code : "";
  const responseCode = typeof value.responseCode === "number" ? value.responseCode : null;
  const response = typeof value.response === "string" ? value.response : "";
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";

  let reason = "Falha inesperada no envio.";
  if (code === "SMTP_NOT_CONFIGURED") reason = "SMTP não configurado: faltam variáveis de ambiente no servidor.";
  else if (code === "EAUTH" || responseCode === 535) reason = "O servidor SMTP recusou o usuário ou a senha.";
  else if (CONNECTION_CODES.has(code)) reason = "Não foi possível conectar ao servidor SMTP.";
  else if (code === "ETLS") reason = "Falha na conexão segura (TLS) com o servidor SMTP.";
  else if (responseCode === 552) reason = "Caixa do destinatário cheia ou mensagem grande demais.";
  else if (responseCode === 554) reason = "Mensagem rejeitada pelo servidor (possível bloqueio de spam).";
  else if (code === "EENVELOPE" || responseCode === 501 || (responseCode !== null && responseCode >= 550 && responseCode < 560)) reason = "Endereço do destinatário recusado (inexistente ou inválido).";
  else if (responseCode !== null && responseCode >= 400 && responseCode < 500) reason = "Recusa temporária do servidor SMTP (limite de envios ou instabilidade).";
  else if (code === "EMESSAGE") reason = "Não foi possível montar a mensagem.";

  const detail = [code, responseCode, response || message].filter(Boolean).join(" · ").slice(0, 500);
  return { reason, detail: detail || null };
}

export async function recordEmailLog(entry: { type: EmailType; subject: string; recipient: string; isTest?: boolean; status: EmailLogStatus; error?: string | null; detail?: string | null }) {
  // O log nunca pode impedir ou desfazer um envio já realizado.
  await prisma.emailLog.create({
    data: {
      type: entry.type,
      subject: entry.subject.slice(0, 200),
      recipient: entry.recipient.trim().toLowerCase().slice(0, 254),
      isTest: entry.isTest ?? false,
      status: entry.status,
      error: entry.error ?? null,
      detail: entry.detail?.slice(0, 500) ?? null,
    },
  }).catch((error) => console.error("email log failed", { type: entry.type, error }));
}

function monthRange(value?: string) {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  const current = currentMonthInMaceio().startsAt;
  const year = match ? Number(match[1]) : current.getUTCFullYear();
  const month = match && Number(match[2]) >= 1 && Number(match[2]) <= 12 ? Number(match[2]) - 1 : current.getUTCMonth();
  const from = new Date(Date.UTC(year, month, 1, 3));
  const to = new Date(Date.UTC(year, month + 1, 1, 3));
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "America/Maceio" }).format(from);
  return { from, to, label, key: `${year}-${String(month + 1).padStart(2, "0")}` };
}

export type EmailLogFilters = { month?: string; status?: string; type?: string; page?: string };

export async function getEmailLogReport(filters: EmailLogFilters) {
  const range = monthRange(filters.month);
  const status = filters.status === EmailLogStatus.SENT || filters.status === EmailLogStatus.FAILED ? filters.status : null;
  const type = isEmailType(filters.type) ? filters.type : null;
  const monthWhere: Prisma.EmailLogWhereInput = { createdAt: { gte: range.from, lt: range.to } };
  const listWhere: Prisma.EmailLogWhereInput = { ...monthWhere, ...(status ? { status } : {}), ...(type ? { type } : {}) };

  const [groups, total] = await Promise.all([
    prisma.emailLog.groupBy({ by: ["type", "status"], where: monthWhere, _count: { _all: true } }),
    prisma.emailLog.count({ where: listWhere }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const requestedPage = Number.parseInt(filters.page ?? "1", 10);
  const page = Math.min(Math.max(Number.isInteger(requestedPage) ? requestedPage : 1, 1), totalPages);
  const logs = await prisma.emailLog.findMany({ where: listWhere, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE });

  const byType = new Map<string, { type: string; label: string; sent: number; failed: number }>();
  for (const group of groups) {
    const row = byType.get(group.type) ?? { type: group.type, label: emailTypeLabel(group.type), sent: 0, failed: 0 };
    if (group.status === EmailLogStatus.SENT) row.sent += group._count._all;
    else row.failed += group._count._all;
    byType.set(group.type, row);
  }
  const types = [...byType.values()].sort((left, right) => right.sent + right.failed - (left.sent + left.failed) || left.label.localeCompare(right.label, "pt-BR"));

  return {
    month: { key: range.key, label: range.label },
    filters: { status, type },
    summary: { sent: types.reduce((sum, row) => sum + row.sent, 0), failed: types.reduce((sum, row) => sum + row.failed, 0) },
    types,
    logs,
    total,
    page,
    totalPages,
  };
}

export type EmailLogReport = Awaited<ReturnType<typeof getEmailLogReport>>;
