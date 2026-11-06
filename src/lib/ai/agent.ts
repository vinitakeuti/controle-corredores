import { AiActionStatus, AiAudience, AiChannel, AiMessageRole, Prisma, type AiMessage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { chatCompletion, OpenRouterError, type ChatMessage, type ToolCall } from "@/lib/ai/openrouter";
import { buildSystemPrompt, stampUserMessage } from "@/lib/ai/prompts";
import { costMicrosFor, getAiApiKey, getAiSettingsSummary, monthCostMicros } from "@/lib/ai/settings";
import { deniedAreas, findTool, toolDefinitions, toolsFor, type Executed, type ToolContext } from "@/lib/ai/tools";

const MAX_ROUNDS = 6;
const HISTORY_LIMIT = 60;
const TOOL_RESULT_LIMIT = 12_000;
const ACTION_TTL_MS = 30 * 60 * 1000;

export class AssistantError extends Error {
  constructor(message: string, readonly status = 400, readonly conversationId: string | null = null) {
    super(message);
    this.name = "AssistantError";
  }
}

// Uma resposta por conversa de cada vez (evita duas rodadas cruzadas na mesma conversa).
const running = new Set<string>();

function isAnthropic(model: string) {
  return model.startsWith("anthropic/") || model.startsWith("~anthropic/");
}

// Remonta o histórico no formato do Chat Completions. Pedidos de ferramenta sem a resposta
// correspondente (rodada interrompida) viram texto, para a API não recusar a conversa.
function toChatMessages(history: AiMessage[]): ChatMessage[] {
  const start = history.findIndex((message) => message.role === AiMessageRole.USER);
  const messages = start === -1 ? [] : history.slice(start);
  const answered = new Set(messages.filter((message) => message.role === AiMessageRole.TOOL && message.toolCallId).map((message) => message.toolCallId as string));
  const result: ChatMessage[] = [];
  for (const message of messages) {
    // Avisos de erro são só para a tela; o modelo não precisa vê-los.
    if (message.kind === "error") continue;
    if (message.role === AiMessageRole.USER) {
      result.push({ role: "user", content: stampUserMessage(message.content, message.createdAt, message.authorName) });
    } else if (message.kind === "human") {
      result.push({ role: "assistant", content: `(Resposta enviada por uma pessoa da equipe) ${message.content}` });
    } else if (message.role === AiMessageRole.TOOL) {
      if (message.toolCallId) result.push({ role: "tool", tool_call_id: message.toolCallId, content: message.content });
    } else {
      const calls = Array.isArray(message.toolCalls) ? (message.toolCalls as unknown as ToolCall[]) : [];
      const complete = calls.length > 0 && calls.every((call) => answered.has(call.id));
      if (complete) result.push({ role: "assistant", content: message.content || null, tool_calls: calls });
      else if (message.content) result.push({ role: "assistant", content: message.content });
    }
  }
  return result;
}

function parseArguments(raw: string) {
  try {
    const value = JSON.parse(raw || "{}") as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function serialize(value: unknown) {
  const text = JSON.stringify(value);
  return text.length > TOOL_RESULT_LIMIT ? `${text.slice(0, TOOL_RESULT_LIMIT)}… (resultado cortado)` : text;
}

async function runTool(call: ToolCall, context: ToolContext, allowedNames: Set<string>) {
  const tool = findTool(call.function.name);
  if (!tool || !allowedNames.has(tool.name) || !tool.allowed(context)) return { erro: "Ferramenta não liberada para este usuário." };
  const args = parseArguments(call.function.arguments);
  if (!args) return { erro: "Argumentos inválidos para a ferramenta." };
  try {
    if (!tool.mutating) return await tool.run(args, context);
    const prepared = await tool.prepare(args, context);
    if (!prepared.ok) return { erro: prepared.error };
    await prisma.aiAction.create({
      data: { conversationId: context.conversationId, requestedById: context.actor.id, tool: tool.name, input: prepared.input, summary: prepared.summary, expiresAt: new Date(Date.now() + ACTION_TTL_MS) },
    });
    return { status: "aguardando_confirmacao", acao: prepared.summary, orientacao: "Diga em uma frase o que ficou preparado e peça para a pessoa conferir e tocar em Confirmar. Ainda não foi executado." };
  } catch (error) {
    console.error(`assistant tool ${tool.name} failed`, error);
    return { erro: "Falha interna ao consultar os dados. Tente de novo em instantes." };
  }
}

export type AssistantSetup = { settings: Awaited<ReturnType<typeof getAiSettingsSummary>> & { model: string }; apiKey: string };

// Confere se o assistente pode responder agora (ligado, com chave, modelo e dentro do limite do mês).
export async function loadAssistantSetup(): Promise<AssistantSetup> {
  const settings = await getAiSettingsSummary();
  if (!settings.enabled) throw new AssistantError("O assistente está desligado. Um administrador pode ativá-lo em Integrações › OpenRouter.", 503);
  if (!settings.model) throw new AssistantError("Nenhum modelo escolhido. Um administrador pode escolher em Integrações.", 503);
  const apiKey = await getAiApiKey();
  if (!apiKey) throw new AssistantError("Chave do OpenRouter não configurada. Um administrador pode cadastrá-la em Integrações.", 503);
  if (settings.monthlyBudgetUsd != null && (await monthCostMicros()) >= settings.monthlyBudgetUsd * 1_000_000) {
    throw new AssistantError("O limite de gasto mensal do assistente foi atingido. Um administrador pode ajustá-lo em Configurações.", 429);
  }
  return { settings: { ...settings, model: settings.model }, apiKey };
}

export type Speaker = { authorId?: string | null; authorName?: string | null; authorPhone?: string | null; externalId?: string | null };

// Uma rodada de resposta numa conversa que já existe: grava a mensagem, chama o modelo com as
// ferramentas liberadas para este contexto e grava tudo, com tokens e custo. Serve ao app e ao WhatsApp.
export async function respond({ context, text, speaker, setup }: { context: ToolContext; text: string; speaker: Speaker; setup: AssistantSetup }) {
  const { settings, apiKey } = setup;
  const conversationId = context.conversationId;
  let inputTokens = 0;
  let outputTokens = 0;
  let costMicros = 0;
  let finalText = "";
  let finalMessageId: string | null = null;
  try {
    await prisma.aiMessage.create({ data: { conversationId, role: AiMessageRole.USER, content: text, authorId: speaker.authorId ?? null, authorName: speaker.authorName ?? null, authorPhone: speaker.authorPhone ?? null, externalId: speaker.externalId ?? null } });

    const available = toolsFor(context);
    const allowedNames = new Set(available.map((tool) => tool.name));
    const system = buildSystemPrompt({ context, tools: available, denied: deniedAreas(context), settings });
    const definitions = available.length && settings.modelSupportsTools ? toolDefinitions(available) : undefined;

    const history = (await prisma.aiMessage.findMany({ where: { conversationId }, orderBy: { createdAt: "desc" }, take: HISTORY_LIMIT })).reverse();
    const messages: ChatMessage[] = [{ role: "system", content: system }, ...toChatMessages(history)];

    for (let round = 0; round < MAX_ROUNDS && !finalMessageId; round += 1) {
      const result = await chatCompletion({ apiKey, model: settings.model, messages, tools: definitions, cache: isAnthropic(settings.model) });
      const cost = costMicrosFor(result.usage, settings.modelPricing);
      inputTokens += result.usage.inputTokens;
      outputTokens += result.usage.outputTokens;
      costMicros += cost;
      const usage = { model: result.model, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, cachedTokens: result.usage.cachedTokens, costMicros: cost };

      if (result.toolCalls.length && definitions) {
        await prisma.aiMessage.create({ data: { conversationId, role: AiMessageRole.ASSISTANT, content: result.content, toolCalls: result.toolCalls as unknown as Prisma.InputJsonValue, ...usage } });
        messages.push({ role: "assistant", content: result.content || null, tool_calls: result.toolCalls });
        for (const call of result.toolCalls) {
          const output = serialize(await runTool(call, context, allowedNames));
          await prisma.aiMessage.create({ data: { conversationId, role: AiMessageRole.TOOL, content: output, toolCallId: call.id, toolName: call.function.name } });
          messages.push({ role: "tool", tool_call_id: call.id, content: output });
        }
        continue;
      }

      finalText = result.content.trim() || (result.finishReason === "length" ? "A resposta ficou longa demais e foi cortada. Pode pedir de um jeito mais específico?" : "Não consegui gerar uma resposta. Pode reformular?");
      finalMessageId = (await prisma.aiMessage.create({ data: { conversationId, role: AiMessageRole.ASSISTANT, content: finalText, ...usage } })).id;
    }
    if (!finalMessageId) {
      finalText = "Precisei de passos demais para responder e parei por aqui. Pode dividir o pedido em partes menores?";
      finalMessageId = (await prisma.aiMessage.create({ data: { conversationId, role: AiMessageRole.ASSISTANT, content: finalText } })).id;
    }
  } catch (error) {
    if (error instanceof OpenRouterError) {
      await prisma.aiMessage.create({ data: { conversationId, role: AiMessageRole.ASSISTANT, kind: "error", content: error.message } });
      throw new AssistantError(error.message, error.status === 401 || error.status === 402 ? 503 : 502, conversationId);
    }
    throw error;
  } finally {
    await prisma.aiConversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date(), inputTokens: { increment: inputTokens }, outputTokens: { increment: outputTokens }, costMicros: { increment: costMicros } } }).catch(() => undefined);
  }
  return { finalText, finalMessageId, costMicros };
}

export type TurnInput = { conversationId?: string | null; text: string; context: Omit<ToolContext, "conversationId"> };

// Conversa do app de gestão: cada pessoa só vê e continua as próprias conversas.
export async function runAssistantTurn({ conversationId, text, context }: TurnInput) {
  const setup = await loadAssistantSetup();
  const conversation = conversationId
    ? await prisma.aiConversation.findFirst({ where: { id: conversationId, userId: context.actor.id, channel: AiChannel.APP, archivedAt: null } })
    : await prisma.aiConversation.create({ data: { channel: AiChannel.APP, audience: context.audience, userId: context.actor.id, title: text.slice(0, 80) } });
  if (!conversation) throw new AssistantError("Conversa não encontrada.", 404);
  if (running.has(conversation.id)) throw new AssistantError("Aguarde a resposta anterior terminar.", 409);
  running.add(conversation.id);
  try {
    await respond({ context: { ...context, conversationId: conversation.id }, text, speaker: { authorId: context.actor.id }, setup });
  } finally {
    running.delete(conversation.id);
  }
  return { conversationId: conversation.id };
}

export type ActionDecision = { action: { id: string; status: AiActionStatus; summary: string; error: string | null }; message: string; display?: Executed["display"] };

// Só quem pediu confirma. A troca de estado é atômica, então um clique duplo não executa duas vezes.
export async function decideAction({ actionId, decision, context }: { actionId: string; decision: "confirm" | "reject"; context: Omit<ToolContext, "conversationId"> }): Promise<ActionDecision> {
  const action = await prisma.aiAction.findUnique({ where: { id: actionId }, include: { conversation: { select: { id: true, userId: true, channel: true, isGroup: true } } } });
  // No app, a conversa precisa ser da pessoa; no WhatsApp, basta ser quem pediu a ação naquela conversa.
  const owner = action && (action.conversation.channel === AiChannel.APP ? action.conversation.userId === context.actor.id : true);
  if (!action || action.requestedById !== context.actor.id || !owner) throw new AssistantError("Ação não encontrada.", 404);
  if (action.status !== AiActionStatus.PENDING || action.decidedAt) throw new AssistantError("Esta ação já foi decidida.", 409);
  if (action.expiresAt < new Date()) {
    await prisma.aiAction.update({ where: { id: action.id }, data: { status: AiActionStatus.EXPIRED, decidedAt: new Date() } });
    throw new AssistantError("Esta ação expirou. Peça de novo ao assistente.", 410);
  }
  const claimed = await prisma.aiAction.updateMany({ where: { id: action.id, status: AiActionStatus.PENDING, decidedAt: null }, data: { decidedAt: new Date() } });
  if (claimed.count !== 1) throw new AssistantError("Esta ação já foi decidida.", 409);

  const fullContext: ToolContext = { ...context, conversationId: action.conversationId, channel: action.conversation.channel, isGroup: action.conversation.isGroup };
  const note = async (content: string) => {
    await prisma.aiMessage.create({ data: { conversationId: action.conversationId, role: AiMessageRole.ASSISTANT, kind: "action", content } });
    await prisma.aiConversation.update({ where: { id: action.conversationId }, data: { lastMessageAt: new Date() } });
  };

  if (decision === "reject") {
    const updated = await prisma.aiAction.update({ where: { id: action.id }, data: { status: AiActionStatus.REJECTED } });
    await note(`Ação cancelada pela pessoa: ${action.summary}`);
    return { action: updated, message: "Ação cancelada." };
  }

  const tool = findTool(action.tool);
  if (!tool || !tool.mutating || !tool.allowed(fullContext)) {
    const updated = await prisma.aiAction.update({ where: { id: action.id }, data: { status: AiActionStatus.FAILED, error: "Seu perfil não tem mais permissão para esta ação." } });
    await note(`Não executado (sem permissão): ${action.summary}`);
    return { action: updated, message: updated.error ?? "Sem permissão." };
  }
  try {
    const executed = await tool.execute(action.input as Record<string, unknown>, fullContext);
    const updated = await prisma.aiAction.update({ where: { id: action.id }, data: { status: AiActionStatus.EXECUTED, result: executed.result } });
    await note(`Feito: ${executed.message}`);
    return { action: updated, message: executed.message, display: executed.display };
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message.slice(0, 300) : "Falha ao executar a ação.";
    console.error("assistant action failed", error);
    const updated = await prisma.aiAction.update({ where: { id: action.id }, data: { status: AiActionStatus.FAILED, error: message } });
    await note(`Não foi possível executar (${message}): ${action.summary}`);
    return { action: updated, message };
  }
}

// O que a tela de conversa precisa: mensagens visíveis e ações, sem o JSON bruto das ferramentas.
export async function loadConversationView(conversationId: string, userId: string) {
  const conversation = await prisma.aiConversation.findFirst({ where: { id: conversationId, userId, archivedAt: null } });
  if (!conversation) return null;
  const [messages, actions] = await Promise.all([
    prisma.aiMessage.findMany({ where: { conversationId }, orderBy: { createdAt: "asc" }, take: 400 }),
    prisma.aiAction.findMany({ where: { conversationId }, orderBy: { createdAt: "asc" } }),
  ]);
  const now = new Date();
  return {
    conversation: { id: conversation.id, title: conversation.title, costMicros: conversation.costMicros, inputTokens: conversation.inputTokens, outputTokens: conversation.outputTokens, lastMessageAt: conversation.lastMessageAt.toISOString() },
    messages: messages.map((message) => ({
      id: message.id,
      role: message.role,
      kind: message.kind,
      content: message.role === AiMessageRole.TOOL ? "" : message.content,
      toolName: message.toolName,
      model: message.model,
      costMicros: message.costMicros,
      createdAt: message.createdAt.toISOString(),
    })),
    actions: actions.map((action) => ({
      id: action.id,
      tool: action.tool,
      summary: action.summary,
      status: action.status === AiActionStatus.PENDING && action.expiresAt < now ? AiActionStatus.EXPIRED : action.status,
      error: action.error,
      result: action.result,
      createdAt: action.createdAt.toISOString(),
    })),
  };
}

export type ConversationView = NonNullable<Awaited<ReturnType<typeof loadConversationView>>>;

export function staffContext(user: ToolContext["actor"]): Omit<ToolContext, "conversationId"> {
  return { audience: AiAudience.STAFF, channel: AiChannel.APP, isGroup: false, leadPrices: false, actor: { id: user.id, name: user.name, role: user.role, managerPermissions: user.managerPermissions } };
}
