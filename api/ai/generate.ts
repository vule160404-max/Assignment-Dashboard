import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const maxDuration = 60;

type AiProviderKeyName =
  | 'perplexity'
  | 'gemini'
  | 'openai'
  | 'anthropic'
  | 'custom_openai';

type StoredAiProviderSecrets = Partial<Record<AiProviderKeyName, string>>;

interface AiInputImage {
  dataUrl: string;
  mimeType?: string;
  label?: string;
}

interface AiRequestBody {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  schema?: string;
  systemPrompt?: string;
  userPrompt?: string;
  images?: AiInputImage[];
  temperature?: number;
  previous_response_id?: string;
  enableWebSearch?: boolean;
  maxOutputTokens?: number;
  reasoningEffort?: 'low' | 'medium' | 'high';
  isResearchStep?: boolean;
  searchFallbackQuery?: string;
  tools?: Array<{ type: 'web_search' | 'fetch_url' }>;
  response_format?: Record<string, unknown>;
}

function normalizeInputImages(raw: unknown): Array<{
  dataUrl: string;
  mimeType: string;
  base64Data: string;
}> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ dataUrl: string; mimeType: string; base64Data: string }> =
    [];
  for (const item of raw.slice(0, 8)) {
    if (!item || typeof item !== 'object') continue;
    const rawUrl = (item as AiInputImage).dataUrl;
    if (typeof rawUrl !== 'string') continue;
    const trimmed = rawUrl.trim();
    const m = trimmed.match(
      /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/i
    );
    if (!m) continue;
    const mimeType =
      m[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : m[1].toLowerCase();
    const base64Data = m[2].replace(/\s+/g, '');
    if (!base64Data || base64Data.length > 4_000_000) continue;
    out.push({
      dataUrl: `data:${mimeType};base64,${base64Data}`,
      mimeType,
      base64Data,
    });
  }
  return out;
}

const AI_VAULT_COOKIE_NAME = 'assigntrack_ai_vault';
const AI_VAULT_CIPHER_KEY = crypto.scryptSync(
  process.env.VAULT_SECRET ||
    'assigntrack-server-vault-v1-gen-lang-client-0888688386',
  'assigntrack-vault-salt-2026',
  32
);

const UPLOADS_DIR = process.env.VERCEL
  ? path.resolve('/tmp', 'assigntrack-uploads')
  : path.resolve(process.cwd(), 'uploads');
const AI_KEYS_FILE = path.join(UPLOADS_DIR, '.ai-provider-keys.json');

const PERPLEXITY_AGENT_PRESETS = new Set([
  'fast-search',
  'pro-search',
  'deep-research',
  'advanced-deep-research',
  'low',
  'medium',
  'high',
]);

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function readJsonBody(
  req: IncomingMessage & { body?: unknown }
): Promise<AiRequestBody> {
  if (req.body && typeof req.body === 'object') {
    return req.body as AiRequestBody;
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    return JSON.parse(req.body) as AiRequestBody;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw) as AiRequestBody;
}

function decryptVaultSeal(seal?: string | null): StoredAiProviderSecrets {
  if (!seal || typeof seal !== 'string') return {};
  const parts = seal.trim().split('.');
  if (parts.length !== 3) return {};
  try {
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = Buffer.from(parts[2], 'hex');
    if (iv.length !== 12 || tag.length !== 16) return {};
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      AI_VAULT_CIPHER_KEY,
      iv
    );
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');
    const parsed = JSON.parse(decrypted) as StoredAiProviderSecrets;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function readVaultFromReq(req: IncomingMessage): StoredAiProviderSecrets {
  let merged: StoredAiProviderSecrets = {};
  const cookieHeader = req.headers?.cookie || '';
  if (cookieHeader) {
    for (const pair of cookieHeader.split(';')) {
      const idx = pair.indexOf('=');
      if (idx === -1) continue;
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim();
      if (k === AI_VAULT_COOKIE_NAME && v) {
        merged = { ...merged, ...decryptVaultSeal(decodeURIComponent(v)) };
      }
    }
  }
  const sealHeader = req.headers?.['x-vault-seal'];
  if (typeof sealHeader === 'string' && sealHeader.trim()) {
    merged = { ...merged, ...decryptVaultSeal(sealHeader.trim()) };
  }
  return merged;
}

function getEnvKey(provider: string): string {
  switch (provider) {
    case 'perplexity':
      return (process.env.PERPLEXITY_API_KEY || '').trim();
    case 'gemini':
      return (process.env.GEMINI_API_KEY || '').trim();
    case 'openai':
      return (process.env.OPENAI_API_KEY || '').trim();
    case 'anthropic':
      return (process.env.ANTHROPIC_API_KEY || '').trim();
    case 'custom_openai':
      return (
        process.env.CUSTOM_OPENAI_API_KEY ||
        process.env.NVIDIA_API_KEY ||
        ''
      ).trim();
    default:
      return '';
  }
}

async function resolveProviderKey(
  req: IncomingMessage,
  provider: string,
  rawApiKey?: string
): Promise<string> {
  if (rawApiKey && rawApiKey.trim()) return rawApiKey.trim();
  const fromHeaders = readVaultFromReq(req);
  const headerKey = (fromHeaders[provider as AiProviderKeyName] || '').trim();
  if (headerKey) return headerKey;
  try {
    const raw = await fs.promises.readFile(AI_KEYS_FILE, 'utf8');
    const parsed = JSON.parse(raw) as StoredAiProviderSecrets;
    const diskKey = (parsed[provider as AiProviderKeyName] || '').trim();
    if (diskKey) return diskKey;
  } catch {
    // ignore
  }
  return getEnvKey(provider);
}

function resolveNvidiaModel(model: string): string {
  if (model.includes('/')) return model;
  if (/^deepseek/i.test(model)) return `deepseek-ai/${model}`;
  if (/^llama/i.test(model)) return `meta/${model}`;
  if (/^qwen/i.test(model)) return `qwen/${model}`;
  if (/^mistral/i.test(model)) return `mistralai/${model}`;
  if (/^gemma/i.test(model)) return `google/${model}`;
  if (/^glm/i.test(model)) return `z-ai/${model}`;
  if (/^kimi/i.test(model)) return `moonshotai/${model}`;
  if (/^minimax/i.test(model)) return `minimaxai/${model}`;
  if (/^nemotron/i.test(model)) return `nvidia/${model}`;
  return model;
}

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed. Use POST.' });
    return;
  }

  let body: AiRequestBody;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: 'Dữ liệu JSON gửi lên không hợp lệ.' });
    return;
  }

  const provider =
    typeof body.provider === 'string' ? body.provider.trim() : 'perplexity';
  const rawApiKey =
    typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  const apiKey = await resolveProviderKey(req, provider, rawApiKey);
  const model =
    typeof body.model === 'string' && body.model.trim()
      ? body.model.trim()
      : provider === 'perplexity'
      ? 'pro-search'
      : provider === 'openai'
      ? 'gpt-4.1'
      : provider === 'anthropic'
      ? 'claude-3-7-sonnet-latest'
      : 'gemini-2.5-flash';
  const baseUrl = typeof body.baseUrl === 'string' ? body.baseUrl.trim() : '';
  const schema = typeof body.schema === 'string' ? body.schema.trim() : '';
  const systemPrompt =
    typeof body.systemPrompt === 'string' ? body.systemPrompt : '';
  const userPrompt = typeof body.userPrompt === 'string' ? body.userPrompt : '';
  const inputImages = normalizeInputImages(body.images);
  const temperature =
    typeof body.temperature === 'number'
      ? Math.max(0, Math.min(1.5, body.temperature))
      : 0.4;

  if (!apiKey) {
    sendJson(res, 400, {
      error:
        'Vui lòng nhập API Key của Chatbot trong phần Cài đặt AI trước khi chạy.',
    });
    return;
  }

  if (!userPrompt.trim()) {
    sendJson(res, 400, {
      error: 'Nội dung yêu cầu (prompt) không được để trống.',
    });
    return;
  }

  try {
    if (provider === 'gemini') {
      const cleanBase = (
        baseUrl || 'https://generativelanguage.googleapis.com/v1beta'
      ).replace(/\/+$/, '');
      const url = `${cleanBase}/models/${encodeURIComponent(
        model
      )}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const geminiParts: Array<Record<string, unknown>> = [
        { text: userPrompt },
        ...inputImages.map((img) => ({
          inlineData: {
            mimeType: img.mimeType,
            data: img.base64Data,
          },
        })),
      ];
      const payload: Record<string, unknown> = {
        contents: [{ role: 'user', parts: geminiParts }],
        generationConfig: { temperature },
      };
      if (systemPrompt.trim()) {
        payload.systemInstruction = { parts: [{ text: systemPrompt }] };
      }

      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await resp.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (!resp.ok) {
        const errObj = data.error as { message?: string } | undefined;
        sendJson(res, resp.status, {
          error:
            errObj?.message ||
            `Gemini API trả về lỗi HTTP ${resp.status}. Vui lòng kiểm tra API Key hoặc tên Model.`,
        });
        return;
      }
      const candidates = Array.isArray(data.candidates) ? data.candidates : [];
      const firstCandidate = candidates[0] as
        | { content?: { parts?: { text?: string }[] } }
        | undefined;
      const text = (firstCandidate?.content?.parts || [])
        .map((p) => p.text || '')
        .join('')
        .trim();

      sendJson(res, 200, { text, model, provider });
      return;
    }

    // Helper: Perplexity Search API (POST https://api.perplexity.ai/search — ~1-2s, 0 LLM tokens)
    const runPerplexitySearchApi = async (rawQueryInput: string) => {
      const queries = rawQueryInput
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((q) => q.slice(0, 380))
        .slice(0, 4);
      const searchPayload = {
        query:
          queries.length > 1
            ? queries
            : queries[0] || rawQueryInput.trim().slice(0, 380),
        max_results: 12,
      };
      const httpResp = await fetch('https://api.perplexity.ai/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(searchPayload),
        signal: AbortSignal.timeout(15_000),
      });
      const rawJson = (await httpResp.json().catch(() => ({}))) as {
        id?: string;
        results?: Array<{
          title?: string;
          url?: string;
          snippet?: string;
          date?: string;
          last_updated?: string;
        }>;
        error?: { message?: string };
        detail?: string;
      };
      if (!httpResp.ok) {
        const err = new Error(
          rawJson?.error?.message ||
            rawJson?.detail ||
            `Perplexity Search API lỗi HTTP ${httpResp.status}.`
        ) as Error & { status?: number };
        err.status = httpResp.status;
        throw err;
      }
      const results = Array.isArray(rawJson.results) ? rawJson.results : [];
      const formattedText =
        results.length > 0
          ? results
              .map((r, idx) => {
                const dateLabel = r.date || r.last_updated || 'n.d.';
                return `[${idx + 1}] ${r.title || 'Untitled Source'} (${dateLabel})\nURL: ${r.url || ''}\nExcerpt: ${(r.snippet || '').trim()}`;
              })
              .join('\n\n')
          : 'No web search results returned.';
      return {
        text: formattedText,
        id: rawJson.id,
        results,
      };
    };

    // Perplexity Search API (explicitly chosen)
    const isPerplexitySearchApi =
      provider === 'perplexity' &&
      (schema === 'search' || model === 'perplexity-search');

    if (isPerplexitySearchApi) {
      try {
        const searchRes = await runPerplexitySearchApi(userPrompt);
        sendJson(res, 200, {
          text: searchRes.text,
          id: searchRes.id,
          model: 'perplexity-search',
          provider: 'perplexity',
          schema: 'search',
          search_results: searchRes.results,
        });
      } catch (err) {
        const errObj = err as { status?: number; message?: string };
        sendJson(res, errObj?.status || 502, {
          error:
            errObj?.message || 'Perplexity Search API không phản hồi kịp thời.',
        });
      }
      return;
    }

    // Perplexity Agent API (POST https://api.perplexity.ai/v1/agent)
    // Uses SSE streaming + bounded max_steps + hard safety deadline so it NEVER hits Vercel's 60s HTTP 504!
    const isPerplexityAgentSchema =
      provider === 'perplexity' &&
      schema !== 'sonar' &&
      !/^sonar/i.test(model);

    if (isPerplexityAgentSchema) {
      const trimmedTarget = model.replace(/^preset:/i, '').trim();
      const isPreset = PERPLEXITY_AGENT_PRESETS.has(trimmedTarget.toLowerCase());
      const isDeepPreset = /deep-research/i.test(trimmedTarget);
      const isResearchStep = Boolean(body.isResearchStep);
      const agentInput: unknown =
        inputImages.length > 0
          ? [
              {
                type: 'message',
                role: 'user',
                content: [
                  { type: 'input_text', text: userPrompt },
                  ...inputImages.map((img) => ({
                    type: 'input_image',
                    image_url: img.dataUrl,
                  })),
                ],
              },
            ]
          : userPrompt;

      const reqPayload: Record<string, unknown> = {
        input: agentInput,
        max_output_tokens:
          typeof body.maxOutputTokens === 'number' && body.maxOutputTokens > 0
            ? Math.min(8192, Math.round(body.maxOutputTokens))
            : isResearchStep
            ? 1800
            : 4096,
      };
      if (systemPrompt.trim()) {
        reqPayload.instructions = systemPrompt.trim();
      }
      if (typeof temperature === 'number') {
        reqPayload.temperature = temperature;
      }
      if (body.previous_response_id?.trim()) {
        reqPayload.previous_response_id = body.previous_response_id.trim();
      }
      if (body.response_format && typeof body.response_format === 'object') {
        reqPayload.response_format = body.response_format;
      }

      if (isPreset) {
        reqPayload.preset = trimmedTarget.toLowerCase();
        if (!isDeepPreset) {
          reqPayload.max_steps = 3;
        }
        if (Array.isArray(body.tools) && body.tools.length > 0) {
          reqPayload.tools = body.tools;
        }
      } else {
        reqPayload.model = trimmedTarget;
        if (Array.isArray(body.tools) && body.tools.length > 0) {
          reqPayload.tools = body.tools;
          reqPayload.max_steps = 3;
        } else if (body.enableWebSearch !== false) {
          reqPayload.tools = [{ type: 'web_search' }];
          // Cap tool loop to 3 steps so Agent web_search NEVER loops 60+ seconds!
          reqPayload.max_steps = 3;
        } else {
          // Pure writing step (no web search): single-step fast generation
          reqPayload.max_steps = 1;
        }
        // Keep native reasoning models (like perplexity/glm-5.3-flash) fast & responsive
        const desiredEffort =
          body.reasoningEffort ||
          (/glm-5\.3/i.test(trimmedTarget) ? 'low' : undefined);
        if (desiredEffort) {
          reqPayload.reasoning = { effort: desiredEffort };
        }
      }

      // Hard internal deadline safely below Vercel's 60s maxDuration:
      // 25s for Step 1 research (leaves plenty of time for instant /search fallback), 50s for writing
      const deadlineMs = isResearchStep ? 25_000 : 50_000;
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), deadlineMs);

      let streamedText = '';
      let completedResponse: {
        id?: string;
        model?: string;
        output_text?: string;
        output?: unknown[];
        usage?: unknown;
      } | null = null;

      try {
        let httpResp = await fetch('https://api.perplexity.ai/v1/agent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ ...reqPayload, stream: true }),
          signal: controller.signal,
        });

        // If a model does not accept `reasoning`, immediately retry cleanly without it
        if (httpResp.status === 400 && reqPayload.reasoning) {
          const retryPayload = { ...reqPayload };
          delete retryPayload.reasoning;
          httpResp = await fetch('https://api.perplexity.ai/v1/agent', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'text/event-stream',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ ...retryPayload, stream: true }),
            signal: controller.signal,
          });
        }

        // If a non-vision model rejects multimodal `input_image` with HTTP 400, gracefully fall back to text-only
        if (httpResp.status === 400 && inputImages.length > 0) {
          const textOnlyPayload: Record<string, unknown> = {
            ...reqPayload,
            input: userPrompt,
          };
          delete textOnlyPayload.reasoning;
          httpResp = await fetch('https://api.perplexity.ai/v1/agent', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'text/event-stream',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ ...textOnlyPayload, stream: true }),
            signal: controller.signal,
          });
        }

        if (!httpResp.ok) {
          const rawJson = (await httpResp.json().catch(() => ({}))) as Record<
            string,
            unknown
          >;
          const errObj = rawJson.error as { message?: string } | undefined;
          const err = new Error(
            errObj?.message ||
              (typeof rawJson.detail === 'string' ? rawJson.detail : '') ||
              `Perplexity Agent API HTTP ${httpResp.status}`
          ) as Error & { status?: number };
          err.status = httpResp.status;
          throw err;
        }

        const contentType = httpResp.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          completedResponse = (await httpResp.json().catch(() => null)) as typeof completedResponse;
        } else if (httpResp.body) {
          const reader = httpResp.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let buffer = '';

          try {
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split(/\r?\n/);
              buffer = lines.pop() || '';

              for (const rawLine of lines) {
                const line = rawLine.trim();
                if (!line.startsWith('data:')) continue;
                const payloadStr = line.slice(5).trim();
                if (!payloadStr || payloadStr === '[DONE]') continue;
                try {
                  const evt = JSON.parse(payloadStr) as {
                    type?: string;
                    delta?: string;
                    text?: string;
                    error?: { message?: string };
                    response?: {
                      id?: string;
                      model?: string;
                      output_text?: string;
                      output?: unknown[];
                      usage?: unknown;
                    };
                  };
                  if (
                    evt.type === 'response.output_text.delta' &&
                    typeof evt.delta === 'string'
                  ) {
                    streamedText += evt.delta;
                  } else if (
                    evt.type === 'response.output_text.done' &&
                    typeof evt.text === 'string' &&
                    !streamedText
                  ) {
                    streamedText = evt.text;
                  } else if (
                    evt.type === 'response.completed' &&
                    evt.response
                  ) {
                    completedResponse = evt.response;
                  } else if (evt.type === 'response.failed' || evt.type === 'error') {
                    throw new Error(
                      evt.error?.message || 'Perplexity Agent stream báo lỗi.'
                    );
                  }
                } catch (parseOrEvtErr) {
                  if (
                    parseOrEvtErr instanceof Error &&
                    parseOrEvtErr.message.includes('Perplexity Agent')
                  ) {
                    throw parseOrEvtErr;
                  }
                }
              }
            }
          } catch (readErr) {
            // If deadline hit AFTER we already streamed substantial text, keep what we have instead of crashing!
            if (streamedText.trim().length < 120) {
              throw readErr;
            }
          } finally {
            try {
              reader.releaseLock();
            } catch {
              // ignore
            }
          }
        }

        clearTimeout(timeoutHandle);

        const outputItems = Array.isArray(completedResponse?.output)
          ? completedResponse.output
          : [];
        const searchResults: unknown[] = [];
        const annotations: unknown[] = [];

        for (const item of outputItems) {
          if (!item || typeof item !== 'object') continue;
          const typed = item as {
            type?: string;
            results?: unknown[];
            content?: Array<{
              type?: string;
              text?: string;
              annotations?: unknown[];
            }>;
          };
          if (typed.type === 'search_results' && Array.isArray(typed.results)) {
            searchResults.push(...typed.results);
          }
          if (Array.isArray(typed.content)) {
            for (const part of typed.content) {
              if (Array.isArray(part?.annotations)) {
                annotations.push(...part.annotations);
              }
            }
          }
        }

        const finalRawText =
          completedResponse?.output_text || streamedText || '';
        const outputText = finalRawText
          .replace(/<think>[\s\S]*?<\/think>/gi, '')
          .trim();

        if (!outputText) {
          throw new Error(
            `Perplexity Agent (${trimmedTarget}) trả về nội dung rỗng.`
          );
        }

        sendJson(res, 200, {
          text: outputText,
          output_text: outputText,
          id: completedResponse?.id,
          model: completedResponse?.model || trimmedTarget,
          provider: 'perplexity',
          schema: 'agent',
          search_results: searchResults,
          annotations,
          usage: completedResponse?.usage,
        });
        return;
      } catch (err) {
        clearTimeout(timeoutHandle);
        const errObj = err as { status?: number; name?: string; message?: string };
        const isTimeout =
          errObj?.name === 'AbortError' ||
          errObj?.name === 'TimeoutError' ||
          String(errObj?.message || '')
            .toLowerCase()
            .includes('aborted');

        // Seamless automatic fallback to Perplexity Search API (/search) if Step 1 Agent timed out!
        if (isResearchStep && (isTimeout || (errObj?.status || 0) >= 500)) {
          try {
            const fallbackQuery =
              typeof body.searchFallbackQuery === 'string' &&
              body.searchFallbackQuery.trim()
                ? body.searchFallbackQuery.trim()
                : userPrompt.slice(0, 360);
            const fallbackRes = await runPerplexitySearchApi(fallbackQuery);
            sendJson(res, 200, {
              text: fallbackRes.text,
              id: fallbackRes.id,
              model: 'perplexity-search (fallback)',
              provider: 'perplexity',
              schema: 'search',
              search_results: fallbackRes.results,
            });
            return;
          } catch {
            // Fall through to clean error below
          }
        }

        if (isTimeout) {
          sendJson(res, 504, {
            error: isResearchStep
              ? 'Perplexity Agent tra cứu quá lâu (>25s). Hãy chọn "Search API (/search) · Rẻ nhất" ở Bước 1 để tra cứu chỉ trong 1-2 giây.'
              : `Model "${trimmedTarget}" phản hồi quá lâu (>50s). Hãy thử bấm Viết lại mục này.`,
          });
          return;
        }

        const status =
          typeof errObj?.status === 'number' &&
          errObj.status >= 400 &&
          errObj.status < 600
            ? errObj.status
            : 500;
        sendJson(res, status, {
          error:
            errObj?.message ||
            `Perplexity Agent API lỗi HTTP ${status}. Vui lòng kiểm tra Preset, Model hoặc API Key.`,
        });
        return;
      }
    }

    const isPerplexityMessagesSchema =
      provider === 'perplexity' &&
      (schema === 'messages' ||
        /\/orchestrator\/?$/i.test(baseUrl) ||
        /\/messages\/?$/i.test(baseUrl));

    if (provider === 'anthropic' || isPerplexityMessagesSchema) {
      const defaultMessagesBase =
        provider === 'perplexity'
          ? 'https://api.perplexity.ai/orchestrator'
          : 'https://api.anthropic.com/v1';
      const cleanBase = (baseUrl || defaultMessagesBase).replace(/\/+$/, '');
      const url = cleanBase.endsWith('/messages')
        ? cleanBase
        : cleanBase.endsWith('/v1')
        ? `${cleanBase}/messages`
        : `${cleanBase}/v1/messages`;

      const anthropicContent: unknown =
        inputImages.length > 0
          ? [
              ...inputImages.map((img) => ({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: img.mimeType,
                  data: img.base64Data,
                },
              })),
              { type: 'text', text: userPrompt },
            ]
          : userPrompt;

      const payload: Record<string, unknown> = {
        model,
        max_tokens: 8192,
        temperature,
        messages: [{ role: 'user', content: anthropicContent }],
      };
      if (systemPrompt.trim()) {
        payload.system = systemPrompt;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      };
      if (provider === 'perplexity') {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      const resp = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const data = (await resp.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (!resp.ok) {
        const errObj = data.error as { message?: string } | undefined;
        sendJson(res, resp.status, {
          error:
            errObj?.message ||
            `Messages API (${provider}) lỗi HTTP ${resp.status}. Vui lòng kiểm tra API Key hoặc Model.`,
        });
        return;
      }
      const contentArr = Array.isArray(data.content) ? data.content : [];
      const text = contentArr
        .map((block: { type?: string; text?: string }) =>
          block?.type === 'text' ? block.text || '' : ''
        )
        .join('')
        .trim();

      sendJson(res, 200, { text, model, provider, schema: 'messages' });
      return;
    }

    // Perplexity Sonar (/chat/completions), OpenAI, NVIDIA NIM, or Custom OpenAI-Compatible
    const defaultBaseByProvider =
      provider === 'perplexity'
        ? 'https://api.perplexity.ai'
        : 'https://api.openai.com/v1';
    const cleanBase = (baseUrl || defaultBaseByProvider)
      .replace(/\/+$/, '')
      .replace(/\/chat\/completions$/i, '');

    let url = '';
    if (provider === 'perplexity') {
      url = 'https://api.perplexity.ai/chat/completions';
    } else {
      url = cleanBase.endsWith('/v1')
        ? `${cleanBase}/chat/completions`
        : `${cleanBase}/v1/chat/completions`;
    }

    const isNvidiaNim = /integrate\.api\.nvidia\.com/i.test(cleanBase);
    const resolvedModel = isNvidiaNim ? resolveNvidiaModel(model) : model;

    const messages: { role: string; content: unknown }[] = [];
    if (systemPrompt.trim()) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    if (inputImages.length > 0) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: userPrompt },
          ...inputImages.map((img) => ({
            type: 'image_url',
            image_url: { url: img.dataUrl },
          })),
        ],
      });
    } else {
      messages.push({ role: 'user', content: userPrompt });
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: resolvedModel,
        messages,
        temperature,
      }),
    });

    const rawText = await resp.text().catch(() => '');
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      // non-json
    }

    if (!resp.ok) {
      const errObj = data.error as { message?: string } | undefined;
      const detailMsg =
        errObj?.message ||
        (typeof data.detail === 'string' ? data.detail : '') ||
        (typeof data.title === 'string' ? data.title : '') ||
        rawText.trim().slice(0, 180);

      if (isNvidiaNim && (resp.status === 401 || resp.status === 403)) {
        sendJson(res, resp.status, {
          error: `NVIDIA NIM từ chối xác thực API Key (HTTP ${resp.status}: ${detailMsg}). Key hiện tại dài ${apiKey.length} ký tự (chuẩn NVIDIA NIM là 70 ký tự).`,
        });
        return;
      }

      if (isNvidiaNim && (resp.status === 404 || resp.status === 410)) {
        sendJson(res, resp.status, {
          error: `NVIDIA NIM báo Model "${resolvedModel}" không tồn tại hoặc đã ngừng hỗ trợ (HTTP ${resp.status}: ${detailMsg}). Hãy chọn nvidia/nemotron-3-ultra-550b-a55b.`,
        });
        return;
      }

      sendJson(res, resp.status, {
        error:
          detailMsg ||
          `API Chatbot (${provider}) trả về lỗi HTTP ${resp.status}.`,
      });
      return;
    }

    const choices = Array.isArray(data.choices) ? data.choices : [];
    const firstChoice = choices[0] as
      | {
          message?: {
            content?: string | Array<{ text?: string }>;
            reasoning_content?: string;
          };
          text?: string;
          finish_reason?: string;
        }
      | undefined;

    const rawContent = firstChoice?.message?.content;
    let text = (
      typeof rawContent === 'string'
        ? rawContent
        : Array.isArray(rawContent)
        ? rawContent.map((p) => p?.text || '').join('')
        : firstChoice?.text || ''
    ).trim();

    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    if (!text) {
      sendJson(res, 502, {
        error: `Model "${resolvedModel}" trả về nội dung rỗng (finish_reason: ${
          firstChoice?.finish_reason || 'không rõ'
        }).`,
      });
      return;
    }

    sendJson(res, 200, {
      text,
      model: resolvedModel,
      provider,
      citations: Array.isArray(data.citations) ? data.citations : undefined,
      search_results: Array.isArray(data.search_results)
        ? data.search_results
        : undefined,
    });
  } catch (err) {
    sendJson(res, 502, {
      error:
        err instanceof Error
          ? `Lỗi kết nối tới API Chatbot: ${err.message}`
          : 'Không thể kết nối tới máy chủ AI Chatbot.',
    });
  }
}
