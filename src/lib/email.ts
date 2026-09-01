import nodemailer from "nodemailer";
import { Prisma, SubscriptionStatus } from "@prisma/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { canonicalStudentAppUrl, managementAppUrl } from "@/lib/portal";
import { prisma } from "@/lib/prisma";

type EmailTemplate = "password-reset" | "payment-failed" | "payment-paid" | "due-tomorrow";
type Message = { subject: string; html: string; text: string };

const timeZone = "America/Maceio";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || "corredor";
}

function textDate(date: Date | null | undefined) {
  return formatDate(date) || "a data programada";
}

function emailLayout({ eyebrow, title, intro, details, action, note }: { eyebrow: string; title: string; intro: string; details?: Array<{ label: string; value: string }>; action?: { label: string; href: string }; note?: string }) {
  const safeTitle = escapeHtml(title);
  const safeIntro = escapeHtml(intro);
  const safeNote = note ? escapeHtml(note) : "";
  const actionHtml = action ? `<a href="${escapeHtml(action.href)}" style="display:inline-block;padding:14px 20px;color:#ffffff;background:#18231f;border:1px solid #18231f;text-decoration:none;font:700 14px Arial,sans-serif;letter-spacing:.01em">${escapeHtml(action.label)}</a>` : "";
  const detailsHtml = details?.length ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:25px 0 0;border-top:1px solid #d9ded8">${details.map((detail) => `<tr><td style="padding:13px 0;border-bottom:1px solid #d9ded8"><p style="margin:0 0 4px;color:#8a948e;font:700 10px/1.3 Arial,sans-serif;letter-spacing:1px;text-transform:uppercase">${escapeHtml(detail.label)}</p><p style="margin:0;color:#24332c;font:500 14px/1.45 Arial,sans-serif">${escapeHtml(detail.value)}</p></td></tr>`).join("")}</table>` : "";
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:0;background:#ecefe9;color:#18231f"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ecefe9"><tr><td style="padding:30px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;background:#ffffff"><tr><td style="padding:30px 34px;background:#121916;background-image:linear-gradient(120deg,transparent 0 52%,rgba(255,255,255,.11) 52.2% 58%,transparent 58.2%)"><div style="color:#ffffff;font:900 italic 26px/22px Arial,sans-serif;letter-spacing:-1.5px">PACE<br>LAB.</div></td></tr><tr><td style="padding:34px;font-family:Arial,sans-serif"><p style="margin:0 0 12px;color:#d35b3a;font-size:10px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase">${escapeHtml(eyebrow)}</p><h1 style="margin:0 0 14px;color:#18231f;font-size:30px;line-height:1.05;letter-spacing:-1.4px">${safeTitle}</h1><p style="margin:0;color:#66716b;font-size:15px;line-height:1.65">${safeIntro}</p>${detailsHtml}${actionHtml ? `<div style="margin-top:25px">${actionHtml}</div>` : ""}${note ? `<p style="margin:24px 0 0;color:#87918b;font-size:12px;line-height:1.55">${safeNote}</p>` : ""}</td></tr><tr><td style="padding:18px 34px;background:#f4f6f2;color:#87918b;font:11px/1.5 Arial,sans-serif">PACE LAB · ACADEMIA DO CORREDOR</td></tr></table></td></tr></table></body></html>`;
}

export function getEmailConfiguration() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT ?? "465");
  const secure = process.env.SMTP_SECURE?.trim().toLowerCase() === "true";
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.EMAIL_FROM?.trim();
  const configured = Boolean(host && Number.isInteger(port) && port > 0 && user && password && from);
  return { configured, host: host ?? null, port, secure, user: user ?? null, from: from ?? null };
}

function mailer() {
  const config = getEmailConfiguration();
  if (!config.configured || !config.host || !config.user || !process.env.SMTP_PASSWORD || !config.from) {
    throw new Error("O e-mail SMTP ainda não está configurado nas variáveis de ambiente.");
  }
  return { from: config.from, transport: nodemailer.createTransport({ host: config.host, port: config.port, secure: config.secure, auth: { user: config.user, pass: process.env.SMTP_PASSWORD } }) };
}

export async function sendMessage(to: string, message: Message) {
  const { from, transport } = mailer();
  await transport.sendMail({ from, to, subject: message.subject, html: message.html, text: message.text });
}

export function passwordResetMessage(name: string, resetUrl: string): Message {
  const greeting = firstName(name);
  return { subject: "Redefina sua senha · Pace Lab", html: emailLayout({ eyebrow: "Segurança da conta", title: `Olá, ${greeting}.`, intro: "Recebemos um pedido para redefinir a senha da sua conta Pace Lab.", action: { label: "Redefinir minha senha", href: resetUrl }, note: "Este link é válido por uma hora. Se você não solicitou a alteração, pode ignorar esta mensagem." }), text: `Olá, ${greeting}.\n\nRedefina sua senha da Pace Lab: ${resetUrl}\n\nO link é válido por uma hora.` };
}

export function collaboratorWelcomeMessage({ name, email, temporaryPassword, role }: { name: string; email: string; temporaryPassword: string; role: "ADMIN" | "OPERATOR" }): Message {
  const appUrl = managementAppUrl();
  const loginUrl = `${appUrl}/login`;
  const roleLabel = role === "ADMIN" ? "Administrador" : "Operador";
  const greeting = firstName(name);
  return {
    subject: "Seu acesso à Pace Lab está pronto",
    html: emailLayout({
      eyebrow: "Boas-vindas à equipe",
      title: `Bem-vindo, ${greeting}.`,
      intro: "É um prazer ter você no time. Seu acesso à plataforma Pace Lab já está pronto.",
      details: [
        { label: "Acesso", value: loginUrl },
        { label: "E-mail", value: email },
        { label: "Senha temporária", value: temporaryPassword },
        { label: "Papel", value: roleLabel },
      ],
      action: { label: "Acessar plataforma", href: loginUrl },
      note: "Por segurança, altere sua senha após o primeiro acesso.",
    }),
    text: [
      `Bem-vindo à Pace Lab, ${greeting}.`,
      "É um prazer ter você no time. Seu acesso à plataforma já está pronto.",
      `Acesse: ${loginUrl}`,
      `E-mail: ${email}`,
      `Senha temporária: ${temporaryPassword}`,
      `Papel: ${roleLabel}`,
      "Por segurança, altere sua senha após o primeiro acesso.",
    ].join("\n"),
  };
}

function paymentPaidMessage(name: string, amountCents: number, planName: string, paidAt?: Date | null): Message {
  const greeting = firstName(name);
  const details = [{ label: "Plano", value: planName }, { label: "Pagamento confirmado", value: textDate(paidAt) }, { label: "Valor recebido", value: formatCurrency(amountCents) }];
  const studentUrl = `${canonicalStudentAppUrl()}/aluno`;
  return { subject: "Pagamento confirmado · Pace Lab", html: emailLayout({ eyebrow: "Pagamento confirmado", title: `Bom treino, ${greeting}.`, intro: "Recebemos seu pagamento e sua assinatura está em dia.", details, action: { label: "Abrir área do aluno", href: studentUrl } }), text: `Pagamento confirmado.\nPlano: ${planName}\nPagamento confirmado: ${textDate(paidAt)}\nValor recebido: ${formatCurrency(amountCents)}\nÁrea do aluno: ${studentUrl}` };
}

function paymentFailedMessage(name: string, amountCents: number, planName: string): Message {
  const greeting = firstName(name);
  const details = [{ label: "Plano", value: planName }, { label: "Valor da cobrança", value: formatCurrency(amountCents) }, { label: "Status", value: "Pagamento não confirmado" }];
  const studentUrl = `${canonicalStudentAppUrl()}/aluno`;
  return { subject: "Não foi possível concluir seu pagamento · Pace Lab", html: emailLayout({ eyebrow: "Pagamento pendente", title: `Vamos resolver, ${greeting}.`, intro: "Não conseguimos confirmar sua cobrança. Você pode tentar novamente ou escolher outra forma de pagamento.", details, action: { label: "Ver opções de pagamento", href: studentUrl } }), text: `Não foi possível concluir seu pagamento.\nPlano: ${planName}\nValor da cobrança: ${formatCurrency(amountCents)}\nStatus: Pagamento não confirmado\nOpções de pagamento: ${studentUrl}` };
}

function dueTomorrowMessage(name: string, amountCents: number, planName: string, dueAt: Date): Message {
  const greeting = firstName(name);
  const details = [{ label: "Plano", value: planName }, { label: "Vencimento", value: `Amanhã, ${textDate(dueAt)}` }, { label: "Valor da mensalidade", value: formatCurrency(amountCents) }];
  const studentUrl = `${canonicalStudentAppUrl()}/aluno`;
  return { subject: "Sua mensalidade vence amanhã · Pace Lab", html: emailLayout({ eyebrow: "Lembrete de mensalidade", title: `Seu próximo passo, ${greeting}.`, intro: "Sua mensalidade vence amanhã. Deixe o pagamento preparado para seguir treinando sem interrupções.", details, action: { label: "Abrir pagamentos", href: studentUrl } }), text: `Sua mensalidade vence amanhã.\nPlano: ${planName}\nVencimento: Amanhã, ${textDate(dueAt)}\nValor da mensalidade: ${formatCurrency(amountCents)}\nPagamentos: ${studentUrl}` };
}

async function sendTracked({ dedupeKey, type, userId, recipient, message }: { dedupeKey: string; type: string; userId: string; recipient: string; message: Message }) {
  let delivery = await prisma.emailDelivery.findUnique({ where: { dedupeKey } });
  if (!delivery) {
    try {
      delivery = await prisma.emailDelivery.create({ data: { dedupeKey, type, userId, recipient } });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      delivery = await prisma.emailDelivery.findUnique({ where: { dedupeKey } });
    }
  }
  if (!delivery || delivery.sentAt) return false;
  try {
    await sendMessage(recipient, message);
    await prisma.emailDelivery.update({ where: { id: delivery.id }, data: { sentAt: new Date(), lastError: null } });
    return true;
  } catch (error) {
    await prisma.emailDelivery.update({ where: { id: delivery.id }, data: { lastError: error instanceof Error ? error.message.slice(0, 240) : "Falha ao enviar e-mail" } }).catch(() => undefined);
    console.error("email delivery failed", { type, userId, error });
    return false;
  }
}

export async function sendPaymentNotification(paymentId: string, type: "paid" | "failed") {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { user: true, subscription: true } });
  if (!payment) return false;
  const planName = payment.subscription?.planName ?? "Assinatura Pace Lab";
  const message = type === "paid" ? paymentPaidMessage(payment.user.name, payment.amountCents, planName, payment.paidAt) : paymentFailedMessage(payment.user.name, payment.amountCents, planName);
  return sendTracked({ dedupeKey: `payment:${payment.id}:${type}`, type: type === "paid" ? "PAYMENT_PAID" : "PAYMENT_FAILED", userId: payment.userId, recipient: payment.user.email, message });
}

function dateInMaceio(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export async function sendDueTomorrowReminders() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateKey = dateInMaceio(tomorrow);
  const scheduledFor = new Date(`${dateKey}T12:00:00.000Z`);
  const subscriptions = await prisma.subscription.findMany({ where: { status: SubscriptionStatus.ACTIVE, nextBillingAt: { not: null } }, include: { user: { select: { id: true, name: true, email: true } } } });
  let sent = 0;
  for (const subscription of subscriptions) {
    if (!subscription.nextBillingAt || dateInMaceio(subscription.nextBillingAt) !== dateKey) continue;
    const reminder = await prisma.renewalReminder.upsert({ where: { userId_type_scheduledFor: { userId: subscription.userId, type: "UPCOMING", scheduledFor } }, update: {}, create: { userId: subscription.userId, type: "UPCOMING", scheduledFor } });
    if (reminder.sentAt) continue;
    try {
      await sendMessage(subscription.user.email, dueTomorrowMessage(subscription.user.name, subscription.priceCents, subscription.planName, subscription.nextBillingAt));
      await prisma.renewalReminder.update({ where: { id: reminder.id }, data: { sentAt: new Date() } });
      sent += 1;
    } catch (error) {
      console.error("due tomorrow email failed", { userId: subscription.userId, error });
    }
  }
  return { checked: subscriptions.length, sent };
}

export async function sendEmailPreview(type: EmailTemplate, recipient: string) {
  const appUrl = managementAppUrl();
  const message = type === "password-reset" ? passwordResetMessage("Maria Corredora", `${appUrl}/redefinir-senha/visualizacao`) : type === "payment-paid" ? paymentPaidMessage("Maria Corredora", 15000, "Fortalecimento · Trimestral", new Date()) : type === "payment-failed" ? paymentFailedMessage("Maria Corredora", 15000, "Fortalecimento · Trimestral") : dueTomorrowMessage("Maria Corredora", 15000, "Fortalecimento · Trimestral", new Date(Date.now() + 24 * 60 * 60 * 1000));
  await sendMessage(recipient, message);
}
