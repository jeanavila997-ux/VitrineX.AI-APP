/**
 * Provedor de texto local: API nativa do Ollama + fallback 9Router (OpenAI-compat).
 *
 * Analogia: Ollama é o fogão da cozinha (POST /api/chat na porta 11434).
 * 9Router é o delivery — se o fogão estiver sem panela (modelo), pedimos fora.
 *
 * Docs oficiais Ollama: https://github.com/ollama/ollama/blob/main/docs/api.md
 *   POST /api/chat  ·  POST /api/tags  ·  format: "json" | schema
 */

export type LocalAiProviderId = 'ollama' | '9router' | 'gemini';

export interface LocalProviderConfig {
  provider: LocalAiProviderId;
  /** Raiz do Ollama, sem /v1 — ex.: http://127.0.0.1:11434 */
  ollamaBaseUrl: string;
  ollamaModel: string;
  routerBaseUrl: string;
  routerApiKey: string;
  routerModel: string;
  /** Quando provider=ollama, tenta 9Router se Ollama falhar */
  fallbackToRouter: boolean;
}

const STORAGE_KEY = 'vitrinex_ai_provider';
const STORAGE_MODEL_KEY = 'vitrinex_ai_model';
const STORAGE_FALLBACK_KEY = 'vitrinex_ai_fallback_router';

const envStr = (key: string, fallback: string): string => {
  const v = (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env[key];
  return (v && String(v).trim()) || fallback;
};

const envBool = (key: string, fallback: boolean): boolean => {
  const v = (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env[key];
  if (v === undefined || v === '') return fallback;
  return !['0', 'false', 'no', 'off'].includes(String(v).trim().toLowerCase());
};

/** Aceita URL antiga com /v1 e normaliza para a raiz da API nativa. */
export const normalizeOllamaRoot = (url: string): string => {
  return url.replace(/\/$/, '').replace(/\/v1$/i, '');
};

export const getLocalProviderConfig = (): LocalProviderConfig => {
  const stored = (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY)) || '';
  const provider = (stored || envStr('VITE_AI_PROVIDER', 'ollama')) as LocalAiProviderId;
  const storedModel = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_MODEL_KEY) : null;
  const storedFallback =
    typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_FALLBACK_KEY) : null;

  return {
    provider: ['ollama', '9router', 'gemini'].includes(provider) ? provider : 'ollama',
    ollamaBaseUrl: normalizeOllamaRoot(envStr('VITE_OLLAMA_BASE_URL', 'http://127.0.0.1:11434')),
    ollamaModel:
      storedModel && provider === 'ollama'
        ? storedModel
        : envStr('VITE_OLLAMA_MODEL', 'jev:latest'),
    routerBaseUrl: envStr('VITE_9ROUTER_BASE_URL', 'http://127.0.0.1:20128/v1'),
    routerApiKey: envStr('VITE_9ROUTER_API_KEY', ''),
    routerModel:
      storedModel && provider === '9router'
        ? storedModel
        : envStr('VITE_9ROUTER_MODEL', 'cx/gpt-5.6-sol'),
    fallbackToRouter:
      storedFallback === null
        ? envBool('VITE_OLLAMA_FALLBACK_9ROUTER', true)
        : storedFallback === '1' || storedFallback === 'true',
  };
};

export const setLocalProvider = (provider: LocalAiProviderId, model?: string): void => {
  localStorage.setItem(STORAGE_KEY, provider);
  if (model) localStorage.setItem(STORAGE_MODEL_KEY, model);
  else localStorage.removeItem(STORAGE_MODEL_KEY);
};

export const setFallbackToRouter = (enabled: boolean): void => {
  localStorage.setItem(STORAGE_FALLBACK_KEY, enabled ? 'true' : 'false');
};

export const isLocalTextProvider = (provider?: LocalAiProviderId): boolean => {
  const p = provider ?? getLocalProviderConfig().provider;
  return p === 'ollama' || p === '9router';
};

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LocalGenerateOptions {
  model?: string;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** "json" ou schema JSON Schema — API nativa Ollama (`format`) */
  format?: 'json' | Record<string, unknown>;
  /** Se false, não tenta 9Router mesmo com fallback ligado */
  allowFallback?: boolean;
  signal?: AbortSignal;
}

export interface LocalGenerateResult {
  text: string;
  usedProvider: 'ollama' | '9router';
  model: string;
}

const buildMessages = (prompt: string, systemInstruction?: string): ChatMessage[] => {
  const messages: ChatMessage[] = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  messages.push({ role: 'user', content: prompt });
  return messages;
};

const extractOpenAiText = (data: {
  choices?: Array<{ message?: { content?: string | null; reasoning?: string | null } }>;
  error?: { message?: string };
}): string => {
  const message = data.choices?.[0]?.message;
  return (message?.content || message?.reasoning || '').trim();
};

/** POST /api/chat — API nativa Ollama (não-streaming). */
async function callOllamaChat(
  cfg: LocalProviderConfig,
  messages: ChatMessage[],
  options?: LocalGenerateOptions
): Promise<LocalGenerateResult> {
  const model = options?.model || cfg.ollamaModel;
  const url = `${cfg.ollamaBaseUrl}/api/chat`;

  const body: Record<string, unknown> = {
    model,
    messages,
    stream: false,
    options: {
      temperature: options?.temperature ?? 0.7,
      num_predict: options?.maxOutputTokens ?? 2048,
    },
  };
  if (options?.format) {
    body.format = options.format;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: options?.signal,
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(
      `Ollama ${response.status} em ${url}: ${errBody.slice(0, 300) || response.statusText}`
    );
  }

  const data = (await response.json()) as {
    message?: { content?: string; thinking?: string };
    error?: string;
  };

  const text = (data.message?.content || data.message?.thinking || '').trim();
  if (!text) {
    throw new Error(data.error || `Resposta vazia do Ollama (modelo ${model}).`);
  }

  return { text, usedProvider: 'ollama', model };
}

/** POST …/v1/chat/completions — 9Router (OpenAI-compat). */
async function callRouterChat(
  cfg: LocalProviderConfig,
  messages: ChatMessage[],
  options?: LocalGenerateOptions
): Promise<LocalGenerateResult> {
  const model = options?.model || cfg.routerModel;
  const url = `${cfg.routerBaseUrl.replace(/\/$/, '')}/chat/completions`;

  const openAiMessages = [...messages];
  if (options?.format) {
    const hint =
      options.format === 'json'
        ? 'Responda APENAS com JSON válido, sem markdown.'
        : 'Responda APENAS com JSON válido que obedeça o schema pedido, sem markdown.';
    openAiMessages.unshift({ role: 'system', content: hint });
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.routerApiKey || 'local'}`,
    },
    body: JSON.stringify({
      model,
      messages: openAiMessages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxOutputTokens ?? 2048,
      stream: false,
      ...(options?.format === 'json' ? { response_format: { type: 'json_object' } } : {}),
    }),
    signal: options?.signal,
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(
      `9Router ${response.status} em ${url}: ${errBody.slice(0, 300) || response.statusText}`
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null; reasoning?: string | null } }>;
    error?: { message?: string };
  };

  const text = extractOpenAiText(data);
  if (!text) {
    throw new Error(data.error?.message || `Resposta vazia do 9Router (modelo ${model}).`);
  }

  return { text, usedProvider: '9router', model };
}

/**
 * Gera texto: Ollama primeiro (se selecionado); se falhar e fallback estiver ligado, 9Router.
 * Se o provedor for 9router, vai direto ao gateway.
 */
export async function generateTextLocalDetailed(
  prompt: string,
  options?: LocalGenerateOptions
): Promise<LocalGenerateResult> {
  const cfg = getLocalProviderConfig();
  if (!isLocalTextProvider(cfg.provider)) {
    throw new Error('Provedor ativo não é local (ollama/9router).');
  }

  const messages = buildMessages(prompt, options?.systemInstruction);
  const allowFallback = options?.allowFallback !== false && cfg.fallbackToRouter;

  if (cfg.provider === '9router') {
    return callRouterChat(cfg, messages, options);
  }

  try {
    return await callOllamaChat(cfg, messages, options);
  } catch (ollamaError) {
    if (!allowFallback) throw ollamaError;
    console.warn('[VitrineX] Ollama falhou — tentando 9Router:', ollamaError);
    try {
      return await callRouterChat(cfg, messages, {
        ...options,
        // No fallback, usa o modelo do router (não o nome Ollama)
        model: undefined,
      });
    } catch (routerError) {
      const oMsg = ollamaError instanceof Error ? ollamaError.message : String(ollamaError);
      const rMsg = routerError instanceof Error ? routerError.message : String(routerError);
      throw new Error(`Ollama e 9Router falharam.\n• Ollama: ${oMsg}\n• 9Router: ${rMsg}`);
    }
  }
}

export async function generateTextLocal(
  prompt: string,
  options?: LocalGenerateOptions
): Promise<string> {
  const result = await generateTextLocalDetailed(prompt, options);
  return result.text;
}

/** Streaming via API nativa Ollama (NDJSON). Fallback 9Router SSE se Ollama falhar. */
export async function streamTextLocal(
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  options?: LocalGenerateOptions
): Promise<string> {
  const cfg = getLocalProviderConfig();
  if (!isLocalTextProvider(cfg.provider)) {
    throw new Error('Provedor ativo não é local (ollama/9router).');
  }

  const allowFallback = options?.allowFallback !== false && cfg.fallbackToRouter;

  if (cfg.provider === 'ollama') {
    try {
      return await streamOllamaChat(cfg, messages, onChunk, options);
    } catch (ollamaError) {
      if (!allowFallback) throw ollamaError;
      console.warn('[VitrineX] Stream Ollama falhou — 9Router:', ollamaError);
      return streamRouterChat(cfg, messages, onChunk, { ...options, model: undefined });
    }
  }

  return streamRouterChat(cfg, messages, onChunk, options);
}

async function streamOllamaChat(
  cfg: LocalProviderConfig,
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  options?: LocalGenerateOptions
): Promise<string> {
  const model = options?.model || cfg.ollamaModel;
  const url = `${cfg.ollamaBaseUrl}/api/chat`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      options: {
        temperature: options?.temperature ?? 0.7,
        num_predict: options?.maxOutputTokens ?? 2048,
      },
      ...(options?.format ? { format: options.format } : {}),
    }),
    signal: options?.signal,
  });

  if (!response.ok || !response.body) {
    const errBody = await response.text().catch(() => '');
    throw new Error(
      `Ollama stream ${response.status}: ${errBody.slice(0, 300) || response.statusText}`
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const obj = JSON.parse(trimmed) as {
          message?: { content?: string };
          done?: boolean;
          error?: string;
        };
        if (obj.error) throw new Error(obj.error);
        const piece = obj.message?.content || '';
        if (piece) {
          full += piece;
          onChunk(piece);
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }

  if (!full.trim()) {
    throw new Error(`Stream Ollama vazio (modelo ${model}).`);
  }
  return full;
}

async function streamRouterChat(
  cfg: LocalProviderConfig,
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  options?: LocalGenerateOptions
): Promise<string> {
  const model = options?.model || cfg.routerModel;
  const url = `${cfg.routerBaseUrl.replace(/\/$/, '')}/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.routerApiKey || 'local'}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxOutputTokens ?? 2048,
      stream: true,
    }),
    signal: options?.signal,
  });

  if (!response.ok || !response.body) {
    const errBody = await response.text().catch(() => '');
    throw new Error(
      `9Router stream ${response.status}: ${errBody.slice(0, 300) || response.statusText}`
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      const payload = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
      if (!payload || payload === '[DONE]') continue;
      try {
        const obj = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
        };
        const piece = obj.choices?.[0]?.delta?.content || obj.choices?.[0]?.message?.content || '';
        if (piece) {
          full += piece;
          onChunk(piece);
        }
      } catch {
        // ignora linhas SSE malformadas
      }
    }
  }

  if (!full.trim()) {
    throw new Error(`Stream 9Router vazio (modelo ${model}).`);
  }
  return full;
}

export async function listOllamaModels(): Promise<string[]> {
  const base = normalizeOllamaRoot(getLocalProviderConfig().ollamaBaseUrl);
  const res = await fetch(`${base}/api/tags`);
  if (!res.ok) throw new Error(`Ollama indisponível em ${base}`);
  const data = (await res.json()) as { models?: Array<{ name: string }> };
  return (data.models || []).map((m) => m.name);
}

export async function listRouterModels(): Promise<string[]> {
  const cfg = getLocalProviderConfig();
  const base = cfg.routerBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/models`, {
    headers: { Authorization: `Bearer ${cfg.routerApiKey || 'local'}` },
  });
  if (!res.ok) throw new Error(`9Router indisponível em ${base} (${res.status})`);
  const data = (await res.json()) as { data?: Array<{ id: string }> };
  return (data.data || []).map((m) => m.id);
}

export async function probeLocalProviders(): Promise<{
  ollama: { ok: boolean; detail: string };
  router: { ok: boolean; detail: string };
}> {
  const cfg = getLocalProviderConfig();
  const result = {
    ollama: { ok: false, detail: '' },
    router: { ok: false, detail: '' },
  };

  try {
    const models = await listOllamaModels();
    result.ollama = {
      ok: true,
      detail:
        models.length > 0
          ? `${models.length} modelos · default ${cfg.ollamaModel}`
          : `API ok em ${cfg.ollamaBaseUrl}, mas 0 modelos — faça ollama pull ou use fallback 9Router`,
    };
  } catch (e) {
    result.ollama = { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }

  try {
    const models = await listRouterModels();
    result.router = { ok: true, detail: `${models.length} ids · default ${cfg.routerModel}` };
  } catch (e) {
    result.router = { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }

  return result;
}

export async function testLocalConnection(): Promise<string> {
  const result = await generateTextLocalDetailed(
    "Responda exatamente: 'VitrineX local: Ollama/9Router operacionais.'",
    { maxOutputTokens: 64, temperature: 0 }
  );
  return `[via ${result.usedProvider}/${result.model}] ${result.text}`;
}
