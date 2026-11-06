import { AiChannel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const CONVERSATION_PAGE = 30;

export type ConversationListItem = { id: string; title: string | null; lastMessageAt: string; costMicros: number };
export type ConversationPage = { items: ConversationListItem[]; nextCursor: string | null };

// Histórico paginado (mais recentes primeiro) com busca pelo título. O cursor é o id do último item.
export async function listConversations(userId: string, { query = "", cursor = null }: { query?: string; cursor?: string | null } = {}): Promise<ConversationPage> {
  const where: Prisma.AiConversationWhereInput = { userId, channel: AiChannel.APP, archivedAt: null, ...(query ? { title: { contains: query, mode: "insensitive" } } : {}) };
  const rows = await prisma.aiConversation.findMany({
    where,
    orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
    take: CONVERSATION_PAGE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { id: true, title: true, lastMessageAt: true, costMicros: true },
  });
  const page = rows.slice(0, CONVERSATION_PAGE);
  return {
    items: page.map((row) => ({ ...row, lastMessageAt: row.lastMessageAt.toISOString() })),
    nextCursor: rows.length > CONVERSATION_PAGE ? page[page.length - 1].id : null,
  };
}

export function cleanTitle(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, 80) : "";
}
