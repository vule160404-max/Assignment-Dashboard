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

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
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

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  let fromDisk: StoredAiProviderSecrets = {};
  try {
    const raw = await fs.promises.readFile(AI_KEYS_FILE, 'utf8');
    const parsed = JSON.parse(raw) as StoredAiProviderSecrets;
    if (parsed && typeof parsed === 'object') {
      fromDisk = parsed;
    }
  } catch {
    // ignore
  }

  const vault: StoredAiProviderSecrets = {
    ...fromDisk,
    ...readVaultFromReq(req),
  };

  const configured = {} as Record<AiProviderKeyName, boolean>;
  for (const p of ALLOWED_PROVIDERS) {
    configured[p] = Boolean((vault[p] || '').trim() || getEnvKey(p));
  }

  sendJson(res, 200, { ok: true, configured });
}
