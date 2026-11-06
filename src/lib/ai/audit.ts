import { prisma } from "@/lib/prisma";

export type AiActionLogRow = { id: string; tool: string; summary: string; status: string; error: string | null; createdAt: string; decidedAt: string | null; requester: string; channel: string };

// Últimas ações que a IA preparou, com quem pediu e o que aconteceu. Só leitura, para os administradores.
export async function getAiActionLog(limit = 40): Promise<AiActionLogRow[]> {
  const actions = await prisma.aiAction.findMany({ orderBy: { createdAt: "desc" }, take: limit, include: { conversation: { select: { channel: true } } } });
  const ids = [...new Set(actions.map((action) => action.requestedById).filter((id): id is string => Boolean(id && !id.startsWith("lead:"))))];
  const users = new Map((await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((user) => [user.id, user.name]));
  return actions.map((action) => ({
    id: action.id,
    tool: action.tool,
    summary: action.summary,
    status: action.status,
    error: action.error,
    createdAt: action.createdAt.toISOString(),
    decidedAt: action.decidedAt?.toISOString() ?? null,
    requester: (action.requestedById && users.get(action.requestedById)) || "Desconhecido",
    channel: action.conversation.channel,
  }));
}
