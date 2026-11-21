import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

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

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function readJsonBody(
  req: IncomingMessage & { body?: unknown }
): Promise<Record<string, unknown>> {
  if (req.method === 'GET') return {};
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

  let body: Record<string, unknown> = {};
  try {
    body = await readJsonBody(req);
  } catch {
    // ignore
  }

  const rawKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  const apiKey = await resolvePerplexityKey(req, rawKey);
  const serverKeyConfigured = Boolean(apiKey);

  if (!apiKey) {
    sendJson(res, 400, {
      ok: false,
      serverKeyConfigured: false,
      error:
        'Chưa cấu hình Perplexity API Key trên máy chủ. Hãy nhập Perplexity API Key trong Cài đặt AI để lưu vào kho bảo mật Server.',
    });
    return;
  }

  try {
    const resp = await fetch('https://api.perplexity.ai/orchestrator/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
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
      sendJson(res, resp.status, {
        ok: false,
        serverKeyConfigured,
        error:
          errObj?.message ||
          `Không thể tải danh sách model từ Perplexity (HTTP ${resp.status}).`,
      });
      return;
    }

    const rawList = Array.isArray(data.data)
      ? data.data
      : Array.isArray(data.models)
      ? data.models
      : [];
    const models = rawList
      .map((item: unknown) => {
        if (typeof item === 'string') return { id: item };
        if (item && typeof item === 'object' && 'id' in item) {
          const obj = item as { id?: unknown; owned_by?: unknown; name?: unknown };
          if (typeof obj.id === 'string' && obj.id.trim()) {
            return {
              id: obj.id.trim(),
              owned_by: typeof obj.owned_by === 'string' ? obj.owned_by : undefined,
              name: typeof obj.name === 'string' ? obj.name : undefined,
            };
          }
        }
        return null;
      })
      .filter(
        (m): m is { id: string; owned_by?: string; name?: string } => Boolean(m)
      );

    sendJson(res, 200, {
      ok: true,
      serverKeyConfigured,
      count: models.length,
      models,
    });
  } catch (err) {
    sendJson(res, 502, {
      ok: false,
      serverKeyConfigured,
      error:
        err instanceof Error
          ? `Lỗi kết nối tới Perplexity: ${err.message}`
          : 'Không thể kết nối tới Perplexity.',
    });
  }
}
