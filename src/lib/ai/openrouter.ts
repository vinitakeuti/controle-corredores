// Cliente do OpenRouter (API compatível com Chat Completions).
// Doc: https://openrouter.ai/docs — lista de modelos, uso/custo em `usage.cost`, cache em `cache_control`.
import { managementAppUrl } from "@/lib/portal";

// OPENROUTER_BASE_URL só existe para testes locais (servidor falso); em produção fica o padrão.
const BASE_URL = (process.env.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api/v1").replace(/\/$/, "");
const APP_TITLE = "Pace Lab Gestao";

export type ModelPricing = {
  prompt: number;
  completion: number;
  inputCacheRead: number | null;
  inputCacheWrite: number | null;
  request: number;
};

export type OpenRouterModel = {
  id: string;
  name: string;
  provider: string;
  contextLength: number;
  pricing: ModelPricing;
  supportsTools: boolean;
  inputModalities: string[];
};

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

type TextPart = { type: "text"; text: string; cache_control?: { type: "ephemeral" } };
export type ChatMessage =
  | { role: "system"; content: string | TextPart[] }
  | { role: "user"; content: string | TextPart[] }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ToolDefinition = { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } };

export type ChatUsage = {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  cacheWriteTokens: number;
  costUsd: number | null;
};

export type ChatResult = {
  model: string;
  content: string;
  toolCalls: ToolCall[];
  finishReason: string | null;
  usage: ChatUsage;
};

export class OpenRouterError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = "OpenRouterError";
  }
}

function headers(apiKey?: string) {
  return {
    "Content-Type": "application/json",
    "HTTP-Referer": managementAppUrl(),
    "X-Title": APP_TITLE,
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  };
}

// Mensagens de erro em português para o que a equipe consegue resolver.
function describeError(status: number, raw: string) {
  let detail = raw;
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } };
    detail = parsed.error?.message ?? raw;
  } catch { /* corpo não é JSON */ }
  if (status === 401) return "Chave do OpenRouter inválida ou revogada.";
  if (status === 402) return "Sem créditos no OpenRouter. Adicione créditos na conta para continuar.";
  if (status === 403) return "O OpenRouter bloqueou esta solicitação (moderação ou limite da chave).";
  if (status === 408 || status === 504) return "O modelo demorou demais para responder. Tente de novo.";
  if (status === 429) return "Muitas solicitações seguidas. Aguarde alguns segundos e tente de novo.";
  if (status === 404 && /tool/i.test(detail)) return "O modelo escolhido não aceita ferramentas. Escolha outro modelo em Integrações.";
  if (status >= 500) return "O OpenRouter ou o provedor do modelo está instável. Tente de novo em instantes.";
  return detail.slice(0, 300) || `Erro ${status} no OpenRouter.`;
}

const price = (value: unknown) => {
  const number = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  return Number.isFinite(number) && number >= 0 ? number : null;
};

type RawModel = {
  id?: string;
  name?: string;
  context_length?: number;
  pricing?: Record<string, unknown>;
  supported_parameters?: string[];
  architecture?: { input_modalities?: string[] };
};

function toModel(raw: RawModel): OpenRouterModel | null {
  if (!raw.id || typeof raw.id !== "string") return null;
  const pricing = raw.pricing ?? {};
  return {
    id: raw.id,
    name: typeof raw.name === "string" ? raw.name : raw.id,
    provider: raw.id.split("/")[0] ?? "outros",
    contextLength: typeof raw.context_length === "number" ? raw.context_length : 0,
    pricing: {
      prompt: price(pricing.prompt) ?? 0,
      completion: price(pricing.completion) ?? 0,
      inputCacheRead: price(pricing.input_cache_read),
      inputCacheWrite: price(pricing.input_cache_write),
      request: price(pricing.request) ?? 0,
    },
    supportsTools: Array.isArray(raw.supported_parameters) && raw.supported_parameters.includes("tools"),
    inputModalities: raw.architecture?.input_modalities ?? ["text"],
  };
}

let modelCache: { at: number; models: OpenRouterModel[] } | null = null;
const MODEL_CACHE_MS = 30 * 60 * 1000;

// A lista de modelos é pública; guardamos em memória por 30 minutos.
export async function listModels(force = false): Promise<OpenRouterModel[]> {
  if (!force && modelCache && Date.now() - modelCache.at < MODEL_CACHE_MS) return modelCache.models;
  const response = await fetch(`${BASE_URL}/models`, { headers: headers(), signal: AbortSignal.timeout(20_000), cache: "no-store" });
  const body = await response.text();
  if (!response.ok) throw new OpenRouterError(describeError(response.status, body), response.status);
  const parsed = JSON.parse(body) as { data?: RawModel[] };
  const models = (parsed.data ?? []).map(toModel).filter((model): model is OpenRouterModel => model !== null);
  modelCache = { at: Date.now(), models };
  return models;
}

export async function findModel(id: string) {
  const models = await listModels();
  return models.find((model) => model.id === id) ?? null;
}

export type KeyInfo = { label: string | null; usageUsd: number | null; limitUsd: number | null; limitRemainingUsd: number | null; isFreeTier: boolean };

export async function verifyKey(apiKey: string): Promise<KeyInfo> {
  const response = await fetch(`${BASE_URL}/key`, { headers: headers(apiKey), signal: AbortSignal.timeout(15_000), cache: "no-store" });
  const body = await response.text();
  if (!response.ok) throw new OpenRouterError(describeError(response.status, body), response.status);
  const data = (JSON.parse(body) as { data?: Record<string, unknown> }).data ?? {};
  return {
    label: typeof data.label === "string" ? data.label : null,
    usageUsd: price(data.usage),
    limitUsd: price(data.limit),
    limitRemainingUsd: price(data.limit_remaining),
    isFreeTier: data.is_free_tier === true,
  };
}

type ChatRequest = {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  maxTokens?: number;
  cache?: boolean;
  timeoutMs?: number;
};

export async function chatCompletion({ apiKey, model, messages, tools, maxTokens = 4096, cache = false, timeoutMs = 90_000 }: ChatRequest): Promise<ChatResult> {
  const payload: Record<string, unknown> = { model, messages, max_tokens: maxTokens };
  if (tools?.length) {
    payload.tools = tools;
    payload.tool_choice = "auto";
  }
  // Cache automático (modelos Claude): o OpenRouter coloca o ponto de cache no último bloco
  // e o move conforme a conversa cresce. Ferramentas e instruções fixas ficam no prefixo cacheado.
  if (cache) payload.cache_control = { type: "ephemeral" };

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/chat/completions`, { method: "POST", headers: headers(apiKey), body: JSON.stringify(payload), signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    throw new OpenRouterError(timedOut ? "O modelo demorou demais para responder. Tente de novo." : "Não foi possível conectar ao OpenRouter.", timedOut ? 408 : 503);
  }
  const body = await response.text();
  if (!response.ok) throw new OpenRouterError(describeError(response.status, body), response.status);

  const parsed = JSON.parse(body) as {
    model?: string;
    error?: { message?: string; code?: number };
    choices?: { finish_reason?: string | null; message?: { content?: string | null; tool_calls?: ToolCall[] } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number; prompt_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number } };
  };
  // O OpenRouter pode responder 200 com um erro do provedor no corpo.
  if (parsed.error) throw new OpenRouterError(describeError(parsed.error.code ?? 502, JSON.stringify({ error: parsed.error })), parsed.error.code ?? 502);
  const choice = parsed.choices?.[0];
  const usage = parsed.usage ?? {};
  return {
    model: parsed.model ?? model,
    content: typeof choice?.message?.content === "string" ? choice.message.content : "",
    toolCalls: Array.isArray(choice?.message?.tool_calls) ? choice.message.tool_calls.filter((call) => call?.function?.name) : [],
    finishReason: choice?.finish_reason ?? null,
    usage: {
      inputTokens: usage.prompt_tokens ?? 0,
      outputTokens: usage.completion_tokens ?? 0,
      cachedTokens: usage.prompt_tokens_details?.cached_tokens ?? 0,
      cacheWriteTokens: usage.prompt_tokens_details?.cache_write_tokens ?? 0,
      costUsd: typeof usage.cost === "number" ? usage.cost : null,
    },
  };
}
