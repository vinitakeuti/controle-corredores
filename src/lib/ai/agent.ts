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
      result.push({ role: "user", content: stampUserMessage(message.content, message.createdAt) });
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

export type TurnInput = { conversationId?: string | null; text: string; context: Omit<ToolContext, "conversationId">; channel?: AiChannel };

export async function runAssistantTurn({ conversationId, text, context, channel = AiChannel.APP }: TurnInput) {
  const settings = await getAiSettingsSummary();
  if (!settings.enabled) throw new AssistantError("O assistente está desligado. Um administrador pode ativá-lo em Integrações › OpenRouter.", 503);
  if (!settings.model) throw new AssistantError("Nenhum modelo escolhido. Um administrador pode escolher em Integrações.", 503);
  const apiKey = await getAiApiKey();
  if (!apiKey) throw new AssistantError("Chave do OpenRouter não configurada. Um administrador pode cadastrá-la em Integrações.", 503);
  if (settings.monthlyBudgetUsd != null && (await monthCostMicros()) >= settings.monthlyBudgetUsd * 1_000_000) {
    throw new AssistantError("O limite de gasto mensal do assistente foi atingido. Um administrador pode ajustá-lo em Configurações.", 429);
  }

  const conversation = conversationId
    ? await prisma.aiConversation.findFirst({ where: { id: conversationId, userId: context.actor.id, channel, archivedAt: null } })
    : await prisma.aiConversation.create({ data: { channel, audience: context.audience, userId: context.actor.id, title: text.slice(0, 80) } });
  if (!conversation) throw new AssistantError("Conversa não encontrada.", 404);
  if (running.has(conversation.id)) throw new AssistantError("Aguarde a resposta anterior terminar.", 409);
  running.add(conversation.id);

  const fullContext: ToolContext = { ...context, conversationId: conversation.id };
  const startedAt = new Date();
  let inputTokens = 0;
  let outputTokens = 0;
  let costMicros = 0;
  try {
    await prisma.aiMessage.create({ data: { conversationId: conversation.id, role: AiMessageRole.USER, content: text, authorId: context.actor.id } });

    const available = toolsFor(fullContext);
    const allowedNames = new Set(available.map((tool) => tool.name));
    const system = buildSystemPrompt({ context: fullContext, tools: available, denied: deniedAreas(fullContext), generalInstructions: settings.generalInstructions, businessInfo: settings.businessInfo });
    const definitions = available.length && settings.modelSupportsTools ? toolDefinitions(available) : undefined;

    const history = (await prisma.aiMessage.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: "desc" }, take: HISTORY_LIMIT })).reverse();
    const messages: ChatMessage[] = [{ role: "system", content: system }, ...toChatMessages(history)];

    let finished = false;
    for (let round = 0; round < MAX_ROUNDS && !finished; round += 1) {
      const result = await chatCompletion({ apiKey, model: settings.model, messages, tools: definitions, cache: isAnthropic(settings.model) });
      const cost = costMicrosFor(result.usage, settings.modelPricing);
      inputTokens += result.usage.inputTokens;
      outputTokens += result.usage.outputTokens;
      costMicros += cost;
      const usage = { model: result.model, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, cachedTokens: result.usage.cachedTokens, costMicros: cost };

      if (result.toolCalls.length && definitions) {
        await prisma.aiMessage.create({ data: { conversationId: conversation.id, role: AiMessageRole.ASSISTANT, content: result.content, toolCalls: result.toolCalls as unknown as Prisma.InputJsonValue, ...usage } });
        messages.push({ role: "assistant", content: result.content || null, tool_calls: result.toolCalls });
        for (const call of result.toolCalls) {
          const output = serialize(await runTool(call, fullContext, allowedNames));
          await prisma.aiMessage.create({ data: { conversationId: conversation.id, role: AiMessageRole.TOOL, content: output, toolCallId: call.id, toolName: call.function.name } });
          messages.push({ role: "tool", tool_call_id: call.id, content: output });
        }
        continue;
      }

      const content = result.content.trim() || (result.finishReason === "length" ? "A resposta ficou longa demais e foi cortada. Pode pedir de um jeito mais específico?" : "Não consegui gerar uma resposta. Pode reformular?");
      await prisma.aiMessage.create({ data: { conversationId: conversation.id, role: AiMessageRole.ASSISTANT, content, ...usage } });
      finished = true;
    }
    if (!finished) {
      await prisma.aiMessage.create({ data: { conversationId: conversation.id, role: AiMessageRole.ASSISTANT, content: "Precisei de passos demais para responder e parei por aqui. Pode dividir o pedido em partes menores?" } });
    }
  } catch (error) {
    if (error instanceof OpenRouterError) {
      await prisma.aiMessage.create({ data: { conversationId: conversation.id, role: AiMessageRole.ASSISTANT, kind: "error", content: error.message } });
      throw new AssistantError(error.message, error.status === 401 || error.status === 402 ? 503 : 502, conversation.id);
    }
    throw error;
  } finally {
    running.delete(conversation.id);
    await prisma.aiConversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date(), inputTokens: { increment: inputTokens }, outputTokens: { increment: outputTokens }, costMicros: { increment: costMicros } } }).catch(() => undefined);
  }

  return { conversationId: conversation.id, since: startedAt };
}

export type ActionDecision = { action: { id: string; status: AiActionStatus; summary: string; error: string | null }; message: string; display?: Executed["display"] };

// Só quem pediu confirma. A troca de estado é atômica, então um clique duplo não executa duas vezes.
export async function decideAction({ actionId, decision, context }: { actionId: string; decision: "confirm" | "reject"; context: Omit<ToolContext, "conversationId"> }): Promise<ActionDecision> {
  const action = await prisma.aiAction.findUnique({ where: { id: actionId }, include: { conversation: { select: { id: true, userId: true } } } });
  if (!action || action.requestedById !== context.actor.id || action.conversation.userId !== context.actor.id) throw new AssistantError("Ação não encontrada.", 404);
  if (action.status !== AiActionStatus.PENDING || action.decidedAt) throw new AssistantError("Esta ação já foi decidida.", 409);
  if (action.expiresAt < new Date()) {
    await prisma.aiAction.update({ where: { id: action.id }, data: { status: AiActionStatus.EXPIRED, decidedAt: new Date() } });
    throw new AssistantError("Esta ação expirou. Peça de novo ao assistente.", 410);
  }
  const claimed = await prisma.aiAction.updateMany({ where: { id: action.id, status: AiActionStatus.PENDING, decidedAt: null }, data: { decidedAt: new Date() } });
  if (claimed.count !== 1) throw new AssistantError("Esta ação já foi decidida.", 409);

  const fullContext: ToolContext = { ...context, conversationId: action.conversationId };
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
  return { audience: AiAudience.STAFF, actor: { id: user.id, name: user.name, role: user.role, managerPermissions: user.managerPermissions } };
}
