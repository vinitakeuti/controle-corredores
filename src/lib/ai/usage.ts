import { AiChannel, AiMessageRole } from "@prisma/client";
import { maceioDayStart } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export type AiUsageReport = {
  monthKey: string;
  monthLabel: string;
  costMicros: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  calls: number;
  conversations: number;
  byChannel: { channel: AiChannel; costMicros: number; calls: number }[];
  byModel: { model: string; costMicros: number; calls: number; inputTokens: number; outputTokens: number }[];
  byPerson: { name: string; costMicros: number; conversations: number }[];
  previousMonthCostMicros: number;
};

const channelOrder: AiChannel[] = [AiChannel.APP, AiChannel.WHATSAPP, AiChannel.SITE];

// Custos do assistente por mês (Maceió): total, por canal, por modelo e por pessoa da equipe.
export async function getAiUsageReport(month?: string): Promise<AiUsageReport> {
  const match = month?.match(/^(\d{4})-(\d{2})$/);
  const now = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Maceio", year: "numeric", month: "2-digit" }).format(new Date()).split("-");
  const year = match ? Number(match[1]) : Number(now[0]);
  const monthNumber = match ? Number(match[2]) : Number(now[1]);
  const from = maceioDayStart(year, monthNumber, 1);
  const to = maceioDayStart(year, monthNumber + 1, 1);
  const previousFrom = maceioDayStart(year, monthNumber - 1, 1);
  const where = { role: AiMessageRole.ASSISTANT, createdAt: { gte: from, lt: to }, model: { not: null } };

  const [totals, byModel, messagesByConversation, previous] = await Promise.all([
    prisma.aiMessage.aggregate({ where, _sum: { costMicros: true, inputTokens: true, outputTokens: true, cachedTokens: true }, _count: { _all: true } }),
    prisma.aiMessage.groupBy({ by: ["model"], where, _sum: { costMicros: true, inputTokens: true, outputTokens: true }, _count: { _all: true } }),
    prisma.aiMessage.groupBy({ by: ["conversationId"], where, _sum: { costMicros: true }, _count: { _all: true } }),
    prisma.aiMessage.aggregate({ where: { role: AiMessageRole.ASSISTANT, createdAt: { gte: previousFrom, lt: from } }, _sum: { costMicros: true } }),
  ]);

  const conversations = await prisma.aiConversation.findMany({ where: { id: { in: messagesByConversation.map((item) => item.conversationId) } }, select: { id: true, channel: true, user: { select: { name: true } }, contactName: true } });
  const conversationById = new Map(conversations.map((conversation) => [conversation.id, conversation]));
  const channelTotals = new Map<AiChannel, { costMicros: number; calls: number }>();
  const personTotals = new Map<string, { costMicros: number; conversations: number }>();
  for (const item of messagesByConversation) {
    const conversation = conversationById.get(item.conversationId);
    if (!conversation) continue;
    const channel = channelTotals.get(conversation.channel) ?? { costMicros: 0, calls: 0 };
    channel.costMicros += item._sum.costMicros ?? 0;
    channel.calls += item._count._all;
    channelTotals.set(conversation.channel, channel);
    const name = conversation.user?.name ?? conversation.contactName ?? "Contato sem nome";
    const person = personTotals.get(name) ?? { costMicros: 0, conversations: 0 };
    person.costMicros += item._sum.costMicros ?? 0;
    person.conversations += 1;
    personTotals.set(name, person);
  }

  return {
    monthKey: `${year}-${String(monthNumber).padStart(2, "0")}`,
    monthLabel: new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "America/Maceio" }).format(from),
    costMicros: totals._sum.costMicros ?? 0,
    inputTokens: totals._sum.inputTokens ?? 0,
    outputTokens: totals._sum.outputTokens ?? 0,
    cachedTokens: totals._sum.cachedTokens ?? 0,
    calls: totals._count._all,
    conversations: messagesByConversation.length,
    byChannel: channelOrder.filter((channel) => channelTotals.has(channel)).map((channel) => ({ channel, ...(channelTotals.get(channel) as { costMicros: number; calls: number }) })),
    byModel: byModel.map((item) => ({ model: item.model ?? "—", costMicros: item._sum.costMicros ?? 0, calls: item._count._all, inputTokens: item._sum.inputTokens ?? 0, outputTokens: item._sum.outputTokens ?? 0 })).sort((left, right) => right.costMicros - left.costMicros),
    byPerson: [...personTotals.entries()].map(([name, value]) => ({ name, ...value })).sort((left, right) => right.costMicros - left.costMicros).slice(0, 10),
    previousMonthCostMicros: previous._sum.costMicros ?? 0,
  };
}
