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

interface AiRequestBody {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  schema?: string;
  systemPrompt?: string;
  userPrompt?: string;
  temperature?: number;
  previous_response_id?: string;
  enableWebSearch?: boolean;
  tools?: Array<{ type: 'web_search' | 'fetch_url' }>;
  response_format?: Record<string, unknown>;
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

      const payload: Record<string, unknown> = {
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
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

    // Perplexity Search API (POST https://api.perplexity.ai/search — raw ranked web results, 0 LLM output tokens)
    const isPerplexitySearchApi =
      provider === 'perplexity' &&
      (schema === 'search' || model === 'perplexity-search');

    if (isPerplexitySearchApi) {
      const queries = userPrompt
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 5);
      const searchPayload = {
        query: queries.length > 1 ? queries : queries[0] || userPrompt.trim(),
        max_results: 12,
      };
      const httpResp = await fetch('https://api.perplexity.ai/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(searchPayload),
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
        sendJson(res, httpResp.status, {
          error:
            rawJson?.error?.message ||
            rawJson?.detail ||
            `Perplexity Search API lỗi HTTP ${httpResp.status}.`,
        });
        return;
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

      sendJson(res, 200, {
        text: formattedText,
        id: rawJson.id,
        model: 'perplexity-search',
        provider: 'perplexity',
        schema: 'search',
        search_results: results,
      });
      return;
    }

    // Perplexity Agent API (POST https://api.perplexity.ai/v1/agent via official @perplexity-ai/perplexity_ai SDK)
    // Sonar models (sonar, sonar-pro, sonar-reasoning-pro, sonar-deep-research) route to /chat/completions.
    const isPerplexityAgentSchema =
      provider === 'perplexity' &&
      schema !== 'sonar' &&
      !/^sonar/i.test(model);

    if (isPerplexityAgentSchema) {
      const trimmedTarget = model.replace(/^preset:/i, '').trim();
      const isPreset = PERPLEXITY_AGENT_PRESETS.has(trimmedTarget.toLowerCase());
      const reqPayload: Record<string, unknown> = {
        input: userPrompt,
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
        if (Array.isArray(body.tools) && body.tools.length > 0) {
          reqPayload.tools = body.tools;
        }
      } else {
        reqPayload.model = trimmedTarget;
        if (Array.isArray(body.tools) && body.tools.length > 0) {
          reqPayload.tools = body.tools;
        } else if (body.enableWebSearch !== false) {
          reqPayload.tools = [{ type: 'web_search' }];
        }
      }

      try {
        let response: {
          id?: string;
          model?: string;
          output_text?: string;
          output?: unknown[];
          usage?: unknown;
        };
        try {
          const mod = await import('@perplexity-ai/perplexity_ai');
          const PerplexityCtor = mod.default;
          const client = new PerplexityCtor({ apiKey, maxRetries: 0 });
          response = (await client.responses.create({
            ...reqPayload,
            stream: false,
          } as Parameters<typeof client.responses.create>[0])) as typeof response;
        } catch (sdkErr) {
          if (
            typeof (sdkErr as { status?: number })?.status === 'number' &&
            (sdkErr as { status: number }).status >= 400
          ) {
            throw sdkErr;
          }
          const httpResp = await fetch('https://api.perplexity.ai/v1/agent', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ ...reqPayload, stream: false }),
          });
          const rawJson = (await httpResp.json().catch(() => ({}))) as Record<
            string,
            unknown
          >;
          if (!httpResp.ok) {
            const errObj = rawJson.error as { message?: string } | undefined;
            const err = new Error(
              errObj?.message || `Perplexity Agent API HTTP ${httpResp.status}`
            ) as Error & { status?: number };
            err.status = httpResp.status;
            throw err;
          }
          response = rawJson as typeof response;
        }

        const outputItems = Array.isArray(response.output) ? response.output : [];
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

        const outputText = (response.output_text || '')
          .replace(/<think>[\s\S]*?<\/think>/gi, '')
          .trim();

        sendJson(res, 200, {
          text: outputText,
          output_text: outputText,
          id: response.id,
          model: response.model || trimmedTarget,
          provider: 'perplexity',
          schema: 'agent',
          search_results: searchResults,
          annotations,
          usage: response.usage,
        });
        return;
      } catch (err) {
        const errObj = err as { status?: number; message?: string };
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

      const payload: Record<string, unknown> = {
        model,
        max_tokens: 8192,
        temperature,
        messages: [{ role: 'user', content: userPrompt }],
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

    const messages: { role: string; content: string }[] = [];
    if (systemPrompt.trim()) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: userPrompt });

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
