// Cliente da Evolution API v2. Autenticação pelo header "apikey".
// Envio: POST /message/sendText/{instance} { number, text } · Webhook: POST /webhook/set/{instance} { webhook: {...} }
// Conexão: GET /instance/connectionState/{instance} · Digitando: POST /chat/sendPresence/{instance}

export type EvolutionConfig = { baseUrl: string; apiKey: string; instance: string };

export class EvolutionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "EvolutionError";
  }
}

function describe(status: number, raw: string) {
  let detail = raw;
  try {
    const parsed = JSON.parse(raw) as { response?: { message?: unknown }; message?: unknown; error?: unknown };
    const message = parsed.response?.message ?? parsed.message ?? parsed.error;
    detail = Array.isArray(message) ? message.join("; ") : typeof message === "string" ? message : raw;
  } catch { /* corpo não é JSON */ }
  if (status === 401 || status === 403) return "A Evolution recusou a chave da API. Confira a API key.";
  if (status === 404) return "Instância não encontrada na Evolution. Confira o nome da instância.";
  if (status >= 500) return "A Evolution está instável ou fora do ar. Tente de novo em instantes.";
  return detail.slice(0, 240) || `Erro ${status} na Evolution.`;
}

async function call(config: EvolutionConfig, method: "GET" | "POST", path: string, body?: unknown) {
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl.replace(/\/$/, "")}${path}`, {
      method,
      headers: { apikey: config.apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch {
    throw new EvolutionError("Não foi possível conectar à Evolution. Confira a URL.", 503);
  }
  const text = await response.text();
  if (!response.ok) throw new EvolutionError(describe(response.status, text), response.status);
  try { return JSON.parse(text) as Record<string, unknown>; } catch { return {}; }
}

const instancePath = (config: EvolutionConfig) => encodeURIComponent(config.instance);

// "to" é um número com DDI ou um JID completo (grupo, @lid). Devolve o id da mensagem enviada.
export async function sendText(config: EvolutionConfig, to: string, text: string, options: { mentioned?: string[] } = {}) {
  const result = await call(config, "POST", `/message/sendText/${instancePath(config)}`, { number: to, text, ...(options.mentioned?.length ? { mentioned: options.mentioned } : {}) });
  const key = result.key as { id?: unknown } | undefined;
  return typeof key?.id === "string" ? key.id : null;
}

export async function sendPresence(config: EvolutionConfig, to: string, delay = 2500) {
  try {
    await call(config, "POST", `/chat/sendPresence/${instancePath(config)}`, { number: to, presence: "composing", delay });
  } catch { /* "digitando" é só cortesia */ }
}

export async function connectionState(config: EvolutionConfig) {
  const result = await call(config, "GET", `/instance/connectionState/${instancePath(config)}`);
  const instance = result.instance as { state?: unknown } | undefined;
  return typeof instance?.state === "string" ? instance.state : typeof result.state === "string" ? result.state : "desconhecido";
}

export async function setWebhook(config: EvolutionConfig, url: string) {
  await call(config, "POST", `/webhook/set/${instancePath(config)}`, { webhook: { enabled: true, url, events: ["MESSAGES_UPSERT"], byEvents: false, base64: false } });
}
