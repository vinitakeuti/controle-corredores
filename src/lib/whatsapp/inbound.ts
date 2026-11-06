import { AiActionStatus, AiAudience, AiChannel, AiMessageRole, UserRole } from "@prisma/client";
import { AssistantError, decideAction, loadAssistantSetup, respond } from "@/lib/ai/agent";
import type { ToolContext } from "@/lib/ai/tools";
import { managementAppUrl } from "@/lib/portal";
import { prisma } from "@/lib/prisma";
import { sendPresence, sendText, type EvolutionConfig } from "@/lib/whatsapp/evolution";
import { identifyByPhone, type Identity } from "@/lib/whatsapp/identity";
import { notifyTeam } from "@/lib/whatsapp/notify";
import { digitsOnly, formatWhatsapp, isGroupJid, isIgnoredJid, isLidJid, jidUser, phoneKey, toWhatsappNumber } from "@/lib/whatsapp/phone";
import { evolutionConfigFrom, getWhatsAppRecord } from "@/lib/whatsapp/settings";

type Json = Record<string, unknown>;
type SettingsRecord = NonNullable<Awaited<ReturnType<typeof getWhatsAppRecord>>>;

const MAX_AGE_MS = 10 * 60 * 1000;
// Teto de respostas da IA por conversa: a equipe trabalha mais com ela; leads e alunos têm um limite
// menor, para ninguém usar o WhatsApp da Pace Lab como chatbot de uso geral.
const LIMITS = { staffPerHour: 60, publicPerHour: 20, publicPerDay: 60 };
const CHUNK = 3500;
const YES = /^(sim|s|confirmo|confirmar|confirma|pode|pode sim|ok|okay|isso|manda|fechado|beleza)\b/;
const NO = /^(nao|cancela|cancelar|cancele|deixa)\b/;

const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const str = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Uma mensagem por vez em cada conversa, na ordem em que chegaram.
const queues = new Map<string, Promise<unknown>>();
function enqueue(key: string, task: () => Promise<void>) {
  const previous = queues.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  queues.set(key, next);
  void next.finally(() => { if (queues.get(key) === next) queues.delete(key); });
  return next;
}

function textOf(message: unknown) {
  if (!isObject(message)) return "";
  const extended = isObject(message.extendedTextMessage) ? message.extendedTextMessage : null;
  const image = isObject(message.imageMessage) ? message.imageMessage : null;
  const video = isObject(message.videoMessage) ? message.videoMessage : null;
  return str(message.conversation) ?? str(extended?.text) ?? str(image?.caption) ?? str(video?.caption) ?? "";
}

function contextInfo(data: Json) {
  if (isObject(data.contextInfo)) return data.contextInfo;
  const message = isObject(data.message) ? data.message : null;
  const extended = message && isObject(message.extendedTextMessage) ? message.extendedTextMessage : null;
  return extended && isObject(extended.contextInfo) ? extended.contextInfo : null;
}

// Em grupo, a IA só fala quando é chamada: marcada (@número ou @lid), respondida (citação de uma
// mensagem dela) ou com a palavra de chamada configurada.
function calledInGroup(text: string, data: Json, settings: SettingsRecord) {
  const info = contextInfo(data);
  const mentions = Array.isArray(info?.mentionedJid) ? info.mentionedJid.filter((item): item is string => typeof item === "string") : [];
  const botKey = phoneKey(settings.botNumber);
  const isBot = (jid: string | null) => Boolean(jid && ((botKey && phoneKey(jidUser(jid)) === botKey) || (settings.botLid && jid === settings.botLid)));
  if (mentions.some(isBot)) return true;
  if (botKey && [...text.matchAll(/@(\d{8,15})/g)].some((match) => phoneKey(match[1]) === botKey)) return true;
  if (isBot(str(info?.participant))) return true;
  const trigger = normalize(settings.groupTrigger || "");
  return Boolean(trigger && new RegExp(`(^|[^a-z0-9])@?${trigger.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(normalize(text)));
}

const cleanMentions = (text: string) => text.replace(/@\d{6,}/g, "").replace(/\s{2,}/g, " ").trim();
// Negrito do WhatsApp usa um asterisco; o modelo às vezes manda dois.
const toWhatsappFormat = (text: string) => text.replace(/\*\*(.+?)\*\*/g, "*$1*").replace(/^#{1,6}\s+/gm, "");

function chunks(text: string) {
  if (text.length <= CHUNK) return [text];
  const parts: string[] = [];
  let current = "";
  for (const paragraph of text.split(/\n{2,}/)) {
    if ((current + "\n\n" + paragraph).length > CHUNK && current) { parts.push(current); current = paragraph; } else current = current ? `${current}\n\n${paragraph}` : paragraph;
  }
  if (current) parts.push(current);
  return parts.flatMap((part) => (part.length > CHUNK ? part.match(new RegExp(`[\\s\\S]{1,${CHUNK}}`, "g")) ?? [] : [part]));
}

// Envia e guarda o id da primeira parte, para reconhecer o eco da própria mensagem depois.
async function deliver(config: EvolutionConfig, chatJid: string, conversationId: string, text: string, messageId?: string | null) {
  let firstId: string | null = null;
  for (const part of chunks(toWhatsappFormat(text))) {
    const id = await sendText(config, chatJid, part);
    firstId ??= id;
  }
  if (messageId && firstId) await prisma.aiMessage.update({ where: { id: messageId }, data: { externalId: firstId } }).catch(() => undefined);
  else if (!messageId) await prisma.aiMessage.create({ data: { conversationId, role: AiMessageRole.ASSISTANT, kind: "notice", content: text, externalId: firstId } });
}

// Em grupo, a equipe e o público (alunos e leads) têm históricos separados: o que a IA consultou para a
// equipe nunca entra no contexto de uma resposta para aluno ou lead.
const teamThread = (groupJid: string) => `${groupJid}#equipe`;

async function conversationFor(chatJid: string, isGroup: boolean, identity: Identity, phone: string | null, pushName: string | null) {
  const threadId = isGroup && identity.audience === AiAudience.STAFF ? teamThread(chatJid) : chatJid;
  const existing = await prisma.aiConversation.findUnique({ where: { externalId: threadId } });
  const name = identity.user?.name ?? pushName ?? (phone ? formatWhatsapp(phone) : null);
  if (existing) {
    const changes = isGroup ? { archivedAt: null } : { archivedAt: null, audience: identity.audience, userId: identity.user?.id ?? null, contactPhone: phone ?? existing.contactPhone, contactName: identity.user?.name ?? existing.contactName ?? pushName };
    return prisma.aiConversation.update({ where: { id: existing.id }, data: changes });
  }
  return prisma.aiConversation.create({
    data: { channel: AiChannel.WHATSAPP, externalId: threadId, isGroup, audience: isGroup ? (threadId === chatJid ? AiAudience.LEAD : AiAudience.STAFF) : identity.audience, userId: isGroup ? null : identity.user?.id ?? null, contactPhone: isGroup ? null : phone, contactName: isGroup ? null : name, title: isGroup ? (threadId === chatJid ? "Grupo do WhatsApp" : "Grupo do WhatsApp · equipe") : name },
  });
}

async function handleFromMe(key: Json, chatJid: string, id: string, text: string, settings: SettingsRecord) {
  // O eco do que a própria IA mandou chega aqui também; damos um tempo para o envio gravar o id.
  await wait(2500);
  const own = await prisma.aiMessage.findUnique({ where: { externalId: id }, select: { id: true } });
  const participant = str(key.participant);
  if (own) {
    if (isGroupJid(chatJid) && participant && isLidJid(participant) && !settings.botLid) await prisma.whatsAppSettings.update({ where: { id: settings.id }, data: { botLid: participant } }).catch(() => undefined);
    return;
  }
  if (!text) return;
  // Alguém da equipe respondeu pelo celular: guarda no histórico e a IA se afasta por algumas horas.
  const conversation = await prisma.aiConversation.findUnique({ where: { externalId: chatJid } });
  if (!conversation) return;
  await prisma.aiMessage.create({ data: { conversationId: conversation.id, role: AiMessageRole.ASSISTANT, kind: "human", content: text, externalId: id } });
  await prisma.aiConversation.update({ where: { id: conversation.id }, data: { aiPausedUntil: new Date(Date.now() + settings.pauseHours * 3_600_000), needsHuman: false, lastMessageAt: new Date() } });
}

async function handleIncoming(data: Json, key: Json, chatJid: string, id: string, rawText: string, settings: SettingsRecord, config: EvolutionConfig) {
  const isGroup = isGroupJid(chatJid);
  if (isGroup && !calledInGroup(rawText, data, settings)) return;
  const senderJid = isGroup ? str(key.participantAlt) ?? str(key.participant) : chatJid;
  const phone = senderJid && !isLidJid(senderJid) ? digitsOnly(jidUser(senderJid)) : null;
  const pushName = str(data.pushName);
  const identity = await identifyByPhone(phone, pushName);
  const conversation = await conversationFor(chatJid, isGroup, identity, phone, pushName);
  const text = cleanMentions(rawText);
  const speaker = { authorId: identity.user?.id ?? null, authorName: identity.label, authorPhone: phone, externalId: id };

  if (!text) {
    if (!isGroup) await deliver(config, chatJid, conversation.id, "Por enquanto eu leio só mensagens de texto. Pode me escrever?");
    return;
  }
  // Atendimento humano em andamento: guarda a mensagem e não responde.
  if (conversation.aiPausedUntil && conversation.aiPausedUntil > new Date()) {
    await prisma.aiMessage.create({ data: { conversationId: conversation.id, role: AiMessageRole.USER, content: text, ...speaker } });
    await prisma.aiConversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } });
    return;
  }
  if (identity.audience === AiAudience.STAFF && !identity.allowed) {
    await deliver(config, chatJid, conversation.id, "Seu perfil ainda não tem acesso ao assistente. Peça para um administrador liberar em Configurações › Equipe.");
    return;
  }
  const replies = (since: number) => prisma.aiMessage.count({ where: { conversationId: conversation.id, role: AiMessageRole.ASSISTANT, model: { not: null }, createdAt: { gte: new Date(Date.now() - since) } } });
  const isStaff = identity.audience === AiAudience.STAFF;
  const overLimit = isStaff ? (await replies(3_600_000)) >= LIMITS.staffPerHour : (await replies(3_600_000)) >= LIMITS.publicPerHour || (await replies(86_400_000)) >= LIMITS.publicPerDay;
  if (overLimit) {
    if (!conversation.needsHuman) await prisma.aiConversation.update({ where: { id: conversation.id }, data: { needsHuman: true, needsHumanReason: "Muitas mensagens em pouco tempo: a IA parou de responder nesta conversa." } });
    return;
  }

  const actor = identity.user ? { id: identity.user.id, name: identity.user.name, role: identity.user.role, managerPermissions: identity.user.managerPermissions } : { id: `lead:${phone ?? chatJid}`, name: pushName ?? "Contato", role: UserRole.STUDENT, managerPermissions: null };
  // Equipe em grupo que não é interno: sem dados internos nem ações ali.
  const restricted = isGroup && isStaff && !settings.internalGroups.includes(chatJid);
  const context: ToolContext = { audience: identity.audience, channel: AiChannel.WHATSAPP, isGroup, leadPrices: settings.leadPrices, actor, contact: { phone, name: identity.user?.name ?? pushName }, conversationId: conversation.id, restricted };

  // "sim" / "não" de quem pediu uma ação: decide sem passar pelo modelo.
  const answer = normalize(text);
  if (identity.audience === AiAudience.STAFF && text.length <= 40 && (YES.test(answer) || NO.test(answer))) {
    const pending = await prisma.aiAction.findFirst({ where: { conversationId: conversation.id, requestedById: actor.id, status: AiActionStatus.PENDING, decidedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
    if (pending) {
      await prisma.aiMessage.create({ data: { conversationId: conversation.id, role: AiMessageRole.USER, content: text, ...speaker } });
      try {
        const outcome = await decideAction({ actionId: pending.id, decision: YES.test(answer) ? "confirm" : "reject", context });
        let reply = outcome.action.status === AiActionStatus.EXECUTED ? `Feito. ${outcome.message}` : outcome.action.status === AiActionStatus.REJECTED ? "Combinado, cancelei." : outcome.message;
        if (outcome.display) {
          const lines = Object.entries(outcome.display).map(([label, value]) => `*${label}:* ${value}`).join("\n");
          if (!isGroup) reply = `Feito. ${outcome.message.replace(/ A senha temporária.*$/, "")}\n\n${lines}`;
          else {
            const privateTo = toWhatsappNumber(phone);
            if (privateTo) await sendText(config, privateTo, `Dados do cadastro (só para você):\n\n${lines}`).catch(() => undefined);
            reply = `Feito. ${outcome.message.replace(/ A senha temporária.*$/, "")} Te mandei a senha temporária e o link de pagamento no privado.`;
          }
        }
        await deliver(config, chatJid, conversation.id, reply);
      } catch (error) {
        await deliver(config, chatJid, conversation.id, error instanceof AssistantError ? error.message : "Não consegui concluir a ação agora.");
      }
      return;
    }
  }

  let setup;
  try {
    setup = await loadAssistantSetup();
  } catch {
    // IA desligada ou sem crédito: a mensagem fica registrada para a equipe responder.
    await prisma.aiMessage.create({ data: { conversationId: conversation.id, role: AiMessageRole.USER, content: text, ...speaker } });
    await prisma.aiConversation.update({ where: { id: conversation.id }, data: { needsHuman: true, needsHumanReason: "Assistente indisponível no momento.", lastMessageAt: new Date() } });
    return;
  }

  await sendPresence(config, chatJid);
  try {
    const result = await respond({ context, text, speaker, setup });
    await deliver(config, chatJid, conversation.id, result.finalText, result.finalMessageId);
  } catch (error) {
    console.error("whatsapp assistant reply failed", error);
    await deliver(config, chatJid, conversation.id, "Tive uma instabilidade agora. Já avisei a equipe da Pace Lab e alguém te responde por aqui.").catch(() => undefined);
    if (!conversation.needsHuman) {
      await prisma.aiConversation.update({ where: { id: conversation.id }, data: { needsHuman: true, needsHumanReason: "A IA falhou ao responder." } });
      await notifyTeam(`A IA falhou ao responder no WhatsApp.\nContato: ${conversation.contactName ?? "sem nome"}\nConversa: ${managementAppUrl()}/admin/assistente/whatsapp?c=${conversation.id}`);
    }
  }
}

async function handleMessage(data: Json, settings: SettingsRecord, config: EvolutionConfig) {
  const key = isObject(data.key) ? data.key : null;
  const id = str(key?.id);
  const remote = str(key?.remoteJid);
  if (!key || !id || !remote) return;
  // Conversa direta com @lid: o número real vem no campo alternativo.
  const chatJid = isLidJid(remote) && str(key.remoteJidAlt) ? (str(key.remoteJidAlt) as string) : remote;
  if (isIgnoredJid(chatJid)) return;
  const timestamp = typeof data.messageTimestamp === "number" ? data.messageTimestamp * 1000 : Number(data.messageTimestamp) * 1000;
  if (Number.isFinite(timestamp) && timestamp > 0 && Date.now() - timestamp > MAX_AGE_MS) return;
  const text = textOf(data.message);
  await enqueue(chatJid, async () => {
    // A Evolution pode reenviar o mesmo evento: a checagem roda dentro da fila da conversa.
    if (await prisma.aiMessage.findUnique({ where: { externalId: id }, select: { id: true } })) return;
    if (key.fromMe === true) await handleFromMe(key, chatJid, id, text, settings);
    else await handleIncoming(data, key, chatJid, id, text, settings, config);
  });
}

// Evento do webhook da Evolution. Só interessa "messages.upsert"; o resto é ignorado.
export async function handleEvolutionEvent(payload: unknown) {
  if (!isObject(payload)) return;
  const event = String(payload.event ?? "").toLowerCase().replace(/_/g, ".");
  if (event !== "messages.upsert") return;
  const settings = await getWhatsAppRecord();
  const config = evolutionConfigFrom(settings);
  if (!settings?.enabled || !config) return;
  if (str(payload.instance) && settings.instance && str(payload.instance) !== settings.instance) return;
  const items = Array.isArray(payload.data) ? payload.data : [payload.data];
  for (const item of items) {
    if (!isObject(item)) continue;
    try {
      await handleMessage(item, settings, config);
    } catch (error) {
      console.error("whatsapp message handling failed", error);
    }
  }
}
