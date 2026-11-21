import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import Perplexity from '@perplexity-ai/perplexity_ai';

type AiProviderKeyName =
  | 'perplexity'
  | 'gemini'
  | 'openai'
  | 'anthropic'
  | 'custom_openai';

type StoredAiProviderSecrets = Partial<Record<AiProviderKeyName, string>>;

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
): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object') {
    return req.body as Record<string, unknown>;
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    return JSON.parse(req.body) as Record<string, unknown>;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
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

async function resolvePerplexityKey(
  req: IncomingMessage,
  rawKey?: string
): Promise<string> {
  if (rawKey && rawKey.trim()) return rawKey.trim();
  const fromHeaders = readVaultFromReq(req);
  if (fromHeaders.perplexity?.trim()) return fromHeaders.perplexity.trim();
  try {
    const raw = await fs.promises.readFile(AI_KEYS_FILE, 'utf8');
    const parsed = JSON.parse(raw) as StoredAiProviderSecrets;
    if (parsed?.perplexity?.trim()) return parsed.perplexity.trim();
  } catch {
    // ignore
  }
  return (process.env.PERPLEXITY_API_KEY || '').trim();
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
    sendJson(res, 405, { ok: false, error: 'Method Not Allowed. Use POST.' });
    return;
  }

  let body: Record<string, unknown>;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { ok: false, error: 'Dữ liệu JSON không hợp lệ.' });
    return;
  }

  const rawKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  const apiKey = await resolvePerplexityKey(req, rawKey);
  if (!apiKey) {
    sendJson(res, 400, {
      ok: false,
      error:
        'Chưa cấu hình PERPLEXITY_API_KEY trên Server Vault. Hãy nhập Perplexity API Key trong Cài đặt AI.',
    });
    return;
  }

  const input =
    typeof body.input === 'string'
      ? body.input.trim()
      : typeof body.userPrompt === 'string'
      ? body.userPrompt.trim()
      : '';
  if (!input) {
    sendJson(res, 400, {
      ok: false,
      error: 'Trường input không được để trống.',
    });
    return;
  }

  const trimmedTarget = (
    (typeof body.preset === 'string' && body.preset.trim()
      ? body.preset.trim()
      : typeof body.model === 'string' && body.model.trim()
      ? body.model.trim()
      : 'pro-search') || 'pro-search'
  ).replace(/^preset:/i, '');
  const isPreset = PERPLEXITY_AGENT_PRESETS.has(trimmedTarget.toLowerCase());

  const reqPayload: Record<string, unknown> = { input };
  const instructions =
    typeof body.instructions === 'string'
      ? body.instructions.trim()
      : typeof body.systemPrompt === 'string'
      ? body.systemPrompt.trim()
      : '';
  if (instructions) {
    reqPayload.instructions = instructions;
  }
  if (typeof body.temperature === 'number') {
    reqPayload.temperature = body.temperature;
  }
  if (
    typeof body.previous_response_id === 'string' &&
    body.previous_response_id.trim()
  ) {
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
    const client = new Perplexity({ apiKey, maxRetries: 2 });
    const response = await client.responses.create({
      ...reqPayload,
      stream: false,
    } as Perplexity.ResponseCreateParamsNonStreaming);

    const outputItems = Array.isArray(response.output) ? response.output : [];
    const searchResults: unknown[] = [];
    const annotations: unknown[] = [];

    for (const item of outputItems) {
      if (!item || typeof item !== 'object') continue;
      const typed = item as {
        type?: string;
        results?: unknown[];
        content?: Array<{ type?: string; text?: string; annotations?: unknown[] }>;
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
      ok: true,
      id: response.id,
      model: response.model || trimmedTarget,
      output_text: outputText,
      output: outputItems,
      search_results: searchResults,
      annotations,
      usage: response.usage,
    });
  } catch (err) {
    const status =
      typeof (err as { status?: number })?.status === 'number'
        ? (err as { status: number }).status
        : 502;
    sendJson(res, status, {
      ok: false,
      error:
        err instanceof Error
          ? `Perplexity Agent API lỗi: ${err.message}`
          : 'Không thể gọi Perplexity Agent API.',
    });
  }
}
