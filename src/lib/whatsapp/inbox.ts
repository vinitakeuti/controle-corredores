import { AiChannel, AiMessageRole, Prisma } from "@prisma/client";
import { canAccessFeature } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { sendText } from "@/lib/whatsapp/evolution";
import { getWhatsAppRecord, evolutionConfigFrom } from "@/lib/whatsapp/settings";

const PAGE = 30;

// Ler e responder conversas do WhatsApp: quem tem o assistente e acesso a Alunos.
export function canUseWhatsAppInbox(user: { role: string; managerPermissions: unknown }) {
  return canAccessFeature(user, "assistant") && canAccessFeature(user, "students");
}

export type WhatsAppListItem = { id: string; title: string | null; contactPhone: string | null; audience: string; isGroup: boolean; needsHuman: boolean; pausedUntil: string | null; lastMessageAt: string; preview: string };

export async function listWhatsAppConversations({ query = "", cursor = null, onlyNeedsHuman = false }: { query?: string; cursor?: string | null; onlyNeedsHuman?: boolean }) {
  const where: Prisma.AiConversationWhereInput = {
    channel: AiChannel.WHATSAPP,
    archivedAt: null,
    ...(onlyNeedsHuman ? { needsHuman: true } : {}),
    ...(query ? { OR: [{ title: { contains: query, mode: "insensitive" } }, { contactName: { contains: query, mode: "insensitive" } }, { contactPhone: { contains: query.replace(/\D/g, "") || query } }] } : {}),
  };
  const rows = await prisma.aiConversation.findMany({
    where, orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }], take: PAGE + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { id: true, title: true, contactName: true, contactPhone: true, audience: true, isGroup: true, needsHuman: true, aiPausedUntil: true, lastMessageAt: true, messages: { where: { role: { in: [AiMessageRole.USER, AiMessageRole.ASSISTANT] }, content: { not: "" } }, orderBy: { createdAt: "desc" }, take: 1, select: { content: true } } },
  });
  const page = rows.slice(0, PAGE);
  const now = new Date();
  return {
    items: page.map((row): WhatsAppListItem => ({ id: row.id, title: row.title ?? row.contactName, contactPhone: row.contactPhone, audience: row.audience, isGroup: row.isGroup, needsHuman: row.needsHuman, pausedUntil: row.aiPausedUntil && row.aiPausedUntil > now ? row.aiPausedUntil.toISOString() : null, lastMessageAt: row.lastMessageAt.toISOString(), preview: row.messages[0]?.content.slice(0, 120) ?? "" })),
    nextCursor: rows.length > PAGE ? page[page.length - 1].id : null,
    needsHumanCount: await prisma.aiConversation.count({ where: { channel: AiChannel.WHATSAPP, archivedAt: null, needsHuman: true } }),
  };
}

export async function loadWhatsAppView(id: string) {
  const conversation = await prisma.aiConversation.findFirst({ where: { id, channel: AiChannel.WHATSAPP } });
  if (!conversation) return null;
  const messages = await prisma.aiMessage.findMany({ where: { conversationId: id, OR: [{ role: AiMessageRole.USER }, { role: AiMessageRole.ASSISTANT, content: { not: "" } }] }, orderBy: { createdAt: "asc" }, take: 400 });
  const now = new Date();
  const groupJid = conversation.isGroup && conversation.externalId ? conversation.externalId.replace(/#equipe$/, "") : null;
  const internalGroup = groupJid ? Boolean((await prisma.whatsAppSettings.findUnique({ where: { id: "platform" }, select: { internalGroups: true } }))?.internalGroups.includes(groupJid)) : false;
  return {
    conversation: { internalGroup, id: conversation.id, title: conversation.title ?? conversation.contactName, contactName: conversation.contactName, contactPhone: conversation.contactPhone, audience: conversation.audience, isGroup: conversation.isGroup, needsHuman: conversation.needsHuman, needsHumanReason: conversation.needsHumanReason, pausedUntil: conversation.aiPausedUntil && conversation.aiPausedUntil > now ? conversation.aiPausedUntil.toISOString() : null, costMicros: conversation.costMicros },
    messages: messages.filter((message) => message.kind !== "error" && message.kind !== "action").map((message) => ({ id: message.id, role: message.role, kind: message.kind, content: message.content, authorName: message.authorName, model: message.model, costMicros: message.costMicros, createdAt: message.createdAt.toISOString() })),
  };
}

export type WhatsAppView = NonNullable<Awaited<ReturnType<typeof loadWhatsAppView>>>;

// Resposta da equipe enviada pela gestão: sai pelo WhatsApp e pausa a IA naquela conversa.
export async function sendHumanReply(id: string, text: string, author: { id: string; name: string }) {
  const record = await getWhatsAppRecord();
  const config = evolutionConfigFrom(record);
  if (!record?.enabled || !config) throw new Error("O WhatsApp não está conectado. Configure em Integrações › WhatsApp.");
  const conversation = await prisma.aiConversation.findFirst({ where: { id, channel: AiChannel.WHATSAPP } });
  if (!conversation?.externalId) throw new Error("Conversa não encontrada.");
  const externalId = await sendText(config, conversation.externalId, text);
  await prisma.aiMessage.create({ data: { conversationId: id, role: AiMessageRole.ASSISTANT, kind: "human", content: text, externalId, authorId: author.id, authorName: author.name } });
  await prisma.aiConversation.update({ where: { id }, data: { aiPausedUntil: new Date(Date.now() + record.pauseHours * 3_600_000), needsHuman: false, lastMessageAt: new Date() } });
}
