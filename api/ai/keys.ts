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

const ALLOWED_PROVIDERS: AiProviderKeyName[] = [
  'perplexity',
  'gemini',
  'openai',
  'anthropic',
  'custom_openai',
];

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

let memoryVault: StoredAiProviderSecrets = {};

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

function encryptVaultSeal(secrets: StoredAiProviderSecrets): string {
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', AI_VAULT_CIPHER_KEY, iv);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(secrets), 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}.${tag.toString('hex')}.${encrypted.toString('hex')}`;
  } catch {
    return '';
  }
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

async function loadCurrentVault(req: IncomingMessage): Promise<StoredAiProviderSecrets> {
  const fromHeaders = readVaultFromReq(req);
  let fromDisk: StoredAiProviderSecrets = {};
  try {
    const raw = await fs.promises.readFile(AI_KEYS_FILE, 'utf8');
    const parsed = JSON.parse(raw) as StoredAiProviderSecrets;
    if (parsed && typeof parsed === 'object') {
      fromDisk = parsed;
    }
  } catch {
    // ignore missing /tmp file
  }
  const combined: StoredAiProviderSecrets = {
    ...fromDisk,
    ...memoryVault,
    ...fromHeaders,
  };
  memoryVault = combined;
  return combined;
}

async function persistVault(
  next: StoredAiProviderSecrets,
  res: ServerResponse
): Promise<string> {
  memoryVault = { ...next };
  const seal = encryptVaultSeal(next);
  if (seal) {
    const isSecure = Boolean(
      process.env.VERCEL || process.env.NODE_ENV === 'production'
    );
    res.setHeader(
      'Set-Cookie',
      `${AI_VAULT_COOKIE_NAME}=${encodeURIComponent(
        seal
      )}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=31536000${
        isSecure ? '; Secure' : ''
      }`
    );
  }
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    const tmpPath = `${AI_KEYS_FILE}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    await fs.promises.writeFile(tmpPath, JSON.stringify(next, null, 2), {
      encoding: 'utf8',
      mode: 0o600,
    });
    await fs.promises.rename(tmpPath, AI_KEYS_FILE);
  } catch {
    // ignore disk errors on read-only containers
  }
  return seal;
}

function getEnvKey(provider: AiProviderKeyName): string {
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

function buildConfiguredMap(
  vault: StoredAiProviderSecrets
): Record<AiProviderKeyName, boolean> {
  const configured = {} as Record<AiProviderKeyName, boolean>;
  for (const p of ALLOWED_PROVIDERS) {
    configured[p] = Boolean((vault[p] || '').trim() || getEnvKey(p));
  }
  return configured;
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

  try {
    const current = await loadCurrentVault(req);

    if (req.method === 'GET') {
      sendJson(res, 200, {
        ok: true,
        configured: buildConfiguredMap(current),
      });
      return;
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method Not Allowed.' });
      return;
    }

    const body = await readJsonBody(req);
    const next: StoredAiProviderSecrets = { ...current };

    if (
      typeof body.provider === 'string' &&
      ALLOWED_PROVIDERS.includes(body.provider as AiProviderKeyName)
    ) {
      const p = body.provider as AiProviderKeyName;
      const val = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
      if (body.clear === true) {
        delete next[p];
      } else if (val) {
        next[p] = val;
      }
    }

    if (body.keys && typeof body.keys === 'object') {
      for (const p of ALLOWED_PROVIDERS) {
        const val = (body.keys as Record<string, unknown>)[p];
        if (typeof val === 'string' && val.trim()) {
          next[p] = val.trim();
        }
      }
    }

    const vaultSeal = await persistVault(next, res);
    sendJson(res, 200, {
      ok: true,
      configured: buildConfiguredMap(next),
      vaultSeal,
    });
  } catch (err) {
    sendJson(res, 500, {
      ok: false,
      error:
        err instanceof Error
          ? `Lỗi lưu API Key vào Server Vault: ${err.message}`
          : 'Không thể lưu API Key vào kho bảo mật Server.',
    });
  }
}
