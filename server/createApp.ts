import express, { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const UPLOADS_DIR = process.env.VERCEL
  ? path.resolve('/tmp', 'assigntrack-uploads')
  : path.resolve(process.cwd(), 'uploads');
const META_FILE = path.join(UPLOADS_DIR, '.file-meta.json');
const ADMIN_EMAIL = 'vule160404@gmail.com';
const REMOVED_LEGACY_EMAIL = 'cycloneielts@gmail.com';
const OWNER_BOOTSTRAP_DIGEST =
  'eae81b8cf18b8aa05663d4a179738cada71f736c89fa1578415c5844f3084628';
const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

// --- Cloudflare R2 Configuration (S3-compatible) ---
interface R2Config {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

function resolveR2Config(): R2Config | null {
  const accountId = (process.env.R2_ACCOUNT_ID || '').trim();
  const explicitEndpoint = (process.env.R2_ENDPOINT || '').trim();
  const endpoint =
    explicitEndpoint ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');
  const bucket = (process.env.R2_BUCKET || '').trim();
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || '').trim();

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return { endpoint, bucket, accessKeyId, secretAccessKey };
}

const r2Config = resolveR2Config();
const r2Client = r2Config
  ? new S3Client({
      region: 'auto',
      endpoint: r2Config.endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: r2Config.accessKeyId,
        secretAccessKey: r2Config.secretAccessKey,
      },
    })
  : null;

function ensureLocalUploadsDir(): void {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function loadFirebaseConfig(): { projectId: string; databaseId: string } {
  try {
    const raw = fs.readFileSync(
      path.resolve(process.cwd(), 'firebase-applet-config.json'),
      'utf8'
    );
    const parsed = JSON.parse(raw) as {
      projectId?: string;
      firestoreDatabaseId?: string;
    };
    return {
      projectId: parsed.projectId || '',
      databaseId: parsed.firestoreDatabaseId || '(default)',
    };
  } catch {
    return {
      projectId: process.env.FIREBASE_PROJECT_ID || '',
      databaseId: process.env.FIREBASE_DATABASE_ID || '(default)',
    };
  }
}

const FIREBASE_CFG = loadFirebaseConfig();
const FIREBASE_PROJECT_ID = FIREBASE_CFG.projectId;
const FIRESTORE_DATABASE_ID = FIREBASE_CFG.databaseId;

export type FileCategory = 'brief' | 'turnitin' | 'draft' | 'final';

export interface StoredFileMeta {
  fileId: string;
  storedName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  isLocked: boolean;
  category: FileCategory;
  previewMaxPages: number;
  turnitinScorePage: number;
  uploadedAt: string;
  storageProvider?: 'cloudflare-r2' | 'local-disk';
}

// --- Serialized Local Metadata Store (used when R2 is not configured) ---
let metaQueue: Promise<unknown> = Promise.resolve();

function withMetaLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = metaQueue.then(fn, fn);
  metaQueue = next.catch(() => undefined);
  return next;
}

async function readLocalMetaStore(): Promise<Record<string, StoredFileMeta>> {
  try {
    const raw = await fs.promises.readFile(META_FILE, 'utf8');
    return JSON.parse(raw) as Record<string, StoredFileMeta>;
  } catch {
    return {};
  }
}

async function writeLocalMetaStore(
  store: Record<string, StoredFileMeta>
): Promise<void> {
  ensureLocalUploadsDir();
  const tmpPath = `${META_FILE}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  await fs.promises.writeFile(tmpPath, JSON.stringify(store, null, 2), 'utf8');
  await fs.promises.rename(tmpPath, META_FILE);
}

function resolveSafeUploadPath(storedName: string): string | null {
  if (!storedName || path.basename(storedName) !== storedName) return null;
  const resolved = path.resolve(UPLOADS_DIR, storedName);
  if (!resolved.startsWith(UPLOADS_DIR + path.sep)) return null;
  return resolved;
}

// --- Unified Storage Helpers (Cloudflare R2 primary, local-disk fallback) ---
function r2FileKey(storedName: string): string {
  return `files/${storedName}`;
}

function r2MetaKey(fileId: string): string {
  return `meta/${fileId}.json`;
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (
    typeof body === 'object' &&
    body !== null &&
    'transformToByteArray' in body &&
    typeof (body as { transformToByteArray: unknown }).transformToByteArray ===
      'function'
  ) {
    const bytes = await (
      body as { transformToByteArray: () => Promise<Uint8Array> }
    ).transformToByteArray();
    return Buffer.from(bytes);
  }
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array | string>) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function saveFileMeta(meta: StoredFileMeta): Promise<void> {
  if (r2Client && r2Config) {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: r2Config.bucket,
        Key: r2MetaKey(meta.fileId),
        Body: JSON.stringify(meta),
        ContentType: 'application/json',
      })
    );
    return;
  }

  await withMetaLock(async () => {
    const store = await readLocalMetaStore();
    store[meta.fileId] = meta;
    await writeLocalMetaStore(store);
  });
}

async function getFileMeta(fileId: string): Promise<StoredFileMeta | null> {
  if (r2Client && r2Config) {
    try {
      const resp = await r2Client.send(
        new GetObjectCommand({
          Bucket: r2Config.bucket,
          Key: r2MetaKey(fileId),
        })
      );
      const buf = await streamToBuffer(resp.Body);
      return JSON.parse(buf.toString('utf8')) as StoredFileMeta;
    } catch {
      return null;
    }
  }

  const store = await readLocalMetaStore();
  return store[fileId] || null;
}

async function saveFileBinary(
  storedName: string,
  buffer: Buffer,
  mimeType: string
): Promise<void> {
  if (r2Client && r2Config) {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: r2Config.bucket,
        Key: r2FileKey(storedName),
        Body: buffer,
        ContentType: mimeType || 'application/octet-stream',
      })
    );
    return;
  }

  ensureLocalUploadsDir();
  const destPath = resolveSafeUploadPath(storedName);
  if (!destPath) {
    throw new Error('Invalid destination path');
  }
  await fs.promises.writeFile(destPath, buffer);
}

async function getFileBinary(meta: StoredFileMeta): Promise<Buffer | null> {
  if (r2Client && r2Config && meta.storageProvider !== 'local-disk') {
    try {
      const resp = await r2Client.send(
        new GetObjectCommand({
          Bucket: r2Config.bucket,
          Key: r2FileKey(meta.storedName),
        })
      );
      return await streamToBuffer(resp.Body);
    } catch {
      return null;
    }
  }

  const filePath = resolveSafeUploadPath(meta.storedName);
  if (!filePath) return null;
  try {
    return await fs.promises.readFile(filePath);
  } catch {
    return null;
  }
}

async function deleteFileAndMeta(fileId: string): Promise<void> {
  const existing = await getFileMeta(fileId);

  if (r2Client && r2Config) {
    const tasks: Promise<unknown>[] = [
      r2Client
        .send(
          new DeleteObjectCommand({
            Bucket: r2Config.bucket,
            Key: r2MetaKey(fileId),
          })
        )
        .catch(() => undefined),
    ];
    if (existing?.storedName) {
      tasks.push(
        r2Client
          .send(
            new DeleteObjectCommand({
              Bucket: r2Config.bucket,
              Key: r2FileKey(existing.storedName),
            })
          )
          .catch(() => undefined)
      );
    }
    await Promise.all(tasks);
    return;
  }

  const removedMeta = await withMetaLock(async () => {
    const store = await readLocalMetaStore();
    const meta = store[fileId];
    if (!meta) return null;
    delete store[fileId];
    await writeLocalMetaStore(store);
    return meta;
  });

  if (removedMeta) {
    const filePath = resolveSafeUploadPath(removedMeta.storedName);
    if (filePath) {
      await fs.promises.unlink(filePath).catch(() => undefined);
    }
  }
}

// --- Firebase ID Token Verification (RS256 against Google Secure Token Certs) ---
let cachedCerts: { certs: Record<string, string>; expiresAt: number } = {
  certs: {},
  expiresAt: 0,
};

async function getGoogleSecureTokenCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (now < cachedCerts.expiresAt && Object.keys(cachedCerts.certs).length > 0) {
    return cachedCerts.certs;
  }
  const resp = await fetch(GOOGLE_CERTS_URL);
  if (!resp.ok) {
    throw new Error(`Failed to fetch Google certs: ${resp.status}`);
  }
  const certs = (await resp.json()) as Record<string, string>;
  const cacheControl = resp.headers.get('cache-control') || '';
  const maxAgeMatch = /max-age=(\d+)/i.exec(cacheControl);
  const ttlMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 3600 * 1000;
  cachedCerts = { certs, expiresAt: now + ttlMs };
  return certs;
}

function decodeBase64UrlJson<T>(segment: string): T | null {
  try {
    const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

interface FirebaseJwtHeader {
  alg?: string;
  kid?: string;
}

interface FirebaseJwtPayload {
  aud?: string;
  iss?: string;
  sub?: string;
  exp?: number;
  iat?: number;
  email?: string;
  email_verified?: boolean;
}

interface VerifiedTeamResult {
  authorized: boolean;
  isAdmin: boolean;
  uid?: string;
}

interface FirestoreUserDocRest {
  fields?: {
    role?: { stringValue?: string };
    status?: { stringValue?: string };
  };
}

async function verifyTeamBearerToken(
  authHeader?: string
): Promise<VerifiedTeamResult> {
  if (
    !authHeader ||
    !authHeader.startsWith('Bearer ') ||
    !FIREBASE_PROJECT_ID
  ) {
    return { authorized: false, isAdmin: false };
  }
  const token = authHeader.slice(7).trim();
  const parts = token.split('.');
  if (parts.length !== 3) return { authorized: false, isAdmin: false };

  const [headerB64, payloadB64, sigB64] = parts;
  const header = decodeBase64UrlJson<FirebaseJwtHeader>(headerB64);
  const payload = decodeBase64UrlJson<FirebaseJwtPayload>(payloadB64);
  if (!header || !payload || header.alg !== 'RS256' || !header.kid) {
    return { authorized: false, isAdmin: false };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const expectedIssuer = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
  if (
    payload.aud !== FIREBASE_PROJECT_ID ||
    payload.iss !== expectedIssuer ||
    !payload.sub ||
    typeof payload.exp !== 'number' ||
    payload.exp <= nowSec ||
    typeof payload.iat !== 'number' ||
    payload.iat > nowSec + 300 ||
    typeof payload.email !== 'string' ||
    !payload.email
  ) {
    return { authorized: false, isAdmin: false };
  }

  try {
    const certs = await getGoogleSecureTokenCerts();
    const pem = certs[header.kid];
    if (!pem) return { authorized: false, isAdmin: false };

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    verifier.end();
    const sigBuf = Buffer.from(
      sigB64.replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    );
    if (!verifier.verify(pem, sigBuf)) {
      return { authorized: false, isAdmin: false };
    }
  } catch {
    return { authorized: false, isAdmin: false };
  }

  const normalizedTokenEmail = payload.email.trim().toLowerCase();
  if (normalizedTokenEmail === REMOVED_LEGACY_EMAIL) {
    return { authorized: false, isAdmin: false };
  }

  if (normalizedTokenEmail === ADMIN_EMAIL) {
    return { authorized: true, isAdmin: true, uid: payload.sub };
  }

  try {
    const docUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      FIREBASE_PROJECT_ID
    )}/databases/${encodeURIComponent(
      FIRESTORE_DATABASE_ID
    )}/documents/users/${encodeURIComponent(payload.sub)}`;
    const userResp = await fetch(docUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!userResp.ok) {
      return { authorized: false, isAdmin: false };
    }
    const userDoc = (await userResp.json()) as FirestoreUserDocRest;
    const role = userDoc.fields?.role?.stringValue;
    const status = userDoc.fields?.status?.stringValue;
    if (status !== 'active') {
      return { authorized: false, isAdmin: false };
    }
    if (role === 'owner' || role === 'admin') {
      return { authorized: true, isAdmin: true, uid: payload.sub };
    }
    if (role === 'staff') {
      return { authorized: true, isAdmin: false, uid: payload.sub };
    }
    return { authorized: false, isAdmin: false };
  } catch {
    return { authorized: false, isAdmin: false };
  }
}

async function requireTeamAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const result = await verifyTeamBearerToken(req.headers.authorization);
  if (!result.authorized) {
    res.status(401).json({
      error:
        'Yêu cầu quyền Admin hoặc Nhân sự đang hoạt động để thực hiện thao tác này.',
    });
    return;
  }
  next();
}

// --- Safe Upload Filtering ---
const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.txt',
  '.rtf',
  '.csv',
  '.zip',
  '.rar',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
]);

const INLINE_SAFE_MIMES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB limit
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    if (
      !ALLOWED_EXTENSIONS.has(ext) ||
      mime.includes('svg') ||
      mime.includes('html')
    ) {
      cb(new Error('Định dạng tệp không được hỗ trợ vì lý do bảo mật.'));
      return;
    }
    cb(null, true);
  },
});

function sanitizeExt(filename: string): string {
  return path
    .extname(filename)
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, '')
    .slice(0, 12);
}

function isAllowedUpload(filename: string, mimeType: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  const mime = (mimeType || '').toLowerCase();
  return (
    ALLOWED_EXTENSIONS.has(ext) &&
    !mime.includes('svg') &&
    !mime.includes('html')
  );
}

function parseCategory(raw: unknown): FileCategory {
  if (raw === 'turnitin' || raw === 'draft' || raw === 'final') return raw;
  return 'brief';
}

async function buildTrimmedPdfBuffer(
  rawBytes: Buffer,
  maxPages: number
): Promise<{ bytes: Uint8Array; originalPages: number; servedPages: number }> {
  const srcDoc = await PDFDocument.load(rawBytes);
  const originalPages = srcDoc.getPageCount();
  const servedPages = Math.min(originalPages, Math.max(1, maxPages));

  if (servedPages >= originalPages) {
    return {
      bytes: rawBytes,
      originalPages,
      servedPages: originalPages,
    };
  }

  const outDoc = await PDFDocument.create();
  const pageIndices = Array.from({ length: servedPages }, (_, idx) => idx);
  const copied = await outDoc.copyPages(srcDoc, pageIndices);
  copied.forEach((p) => outDoc.addPage(p));
  const trimmedBytes = await outDoc.save();
  return { bytes: trimmedBytes, originalPages, servedPages };
}

export function createApiApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()'
    );
    next();
  });

  // In-memory rate limiter for auth bootstrap endpoint (max 5 failed attempts per 15 min per IP)
  const bootstrapAttempts = new Map<
    string,
    { count: number; resetAt: number }
  >();

  app.post('/api/auth/verify-owner-bootstrap', (req, res) => {
    const ip = String(req.ip || req.socket.remoteAddress || 'unknown');
    const now = Date.now();
    const record = bootstrapAttempts.get(ip);
    if (record && now < record.resetAt && record.count >= 5) {
      res
        .status(429)
        .json({ allowed: false, error: 'Too many attempts. Try again later.' });
      return;
    }

    const email =
      typeof req.body?.email === 'string'
        ? req.body.email.trim().toLowerCase()
        : '';
    const password =
      typeof req.body?.password === 'string' ? req.body.password : '';
    if (!email || !password) {
      res.status(400).json({ allowed: false });
      return;
    }

    const candidateDigest = crypto
      .createHash('sha256')
      .update(`${email}:${password}`)
      .digest('hex');

    const expectedBuf = Buffer.from(OWNER_BOOTSTRAP_DIGEST, 'hex');
    const candidateBuf = Buffer.from(candidateDigest, 'hex');
    const matched =
      expectedBuf.length === candidateBuf.length &&
      crypto.timingSafeEqual(expectedBuf, candidateBuf);

    if (!matched) {
      const nextCount = record && now < record.resetAt ? record.count + 1 : 1;
      bootstrapAttempts.set(ip, {
        count: nextCount,
        resetAt: now + 15 * 60 * 1000,
      });
      res.status(401).json({ allowed: false });
      return;
    }

    bootstrapAttempts.delete(ip);
    res.json({ allowed: true });
  });

  app.get('/api/health', async (_req, res) => {
    let r2Connected = false;
    if (r2Client && r2Config) {
      try {
        await r2Client.send(new HeadBucketCommand({ Bucket: r2Config.bucket }));
        r2Connected = true;
      } catch {
        r2Connected = false;
      }
    }

    res.json({
      ok: true,
      storageProvider: r2Config ? 'cloudflare-r2' : 'local-disk',
      r2Configured: Boolean(r2Config),
      r2Connected,
      telegramConfigured: Boolean(
        (process.env.TELEGRAM_BOT_TOKEN || '').trim() &&
          (process.env.TELEGRAM_CHAT_ID || '').trim()
      ),
    });
  });

  // --- Telegram Bot Notification Proxy Routes ---
  function resolveTelegramConfig(): { botToken: string; chatId: string } | null {
    const botToken = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
    const chatId = (process.env.TELEGRAM_CHAT_ID || '').trim();
    if (!botToken || !chatId) return null;
    return { botToken, chatId };
  }

  function escapeTelegramHtml(raw: string): string {
    return raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  async function dispatchTelegramHtml(
    htmlText: string
  ): Promise<{ ok: boolean; error?: string }> {
    const cfg = resolveTelegramConfig();
    if (!cfg) {
      return {
        ok: false,
        error:
          'Chưa cấu hình TELEGRAM_BOT_TOKEN và TELEGRAM_CHAT_ID trong biến môi trường máy chủ.',
      };
    }

    try {
      const resp = await fetch(
        `https://api.telegram.org/bot${encodeURIComponent(cfg.botToken)}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: cfg.chatId,
            text: htmlText.slice(0, 3800),
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          }),
        }
      );
      if (!resp.ok) {
        const errBody = (await resp.json().catch(() => null)) as {
          description?: string;
        } | null;
        return {
          ok: false,
          error:
            errBody?.description ||
            `Telegram Bot API trả về lỗi HTTP ${resp.status}.`,
        };
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : 'Không thể kết nối tới Telegram API.',
      };
    }
  }

  const clientTelegramCooldowns = new Map<string, number>();

  app.get('/api/notifications/telegram/status', requireTeamAuth, (_req, res) => {
    const cfg = resolveTelegramConfig();
    res.json({ configured: Boolean(cfg) });
  });

  app.post('/api/notifications/telegram/test', requireTeamAuth, async (_req, res) => {
    const result = await dispatchTelegramHtml(
      [
        '<b>AssignTrack · Kiểm tra kết nối Telegram Bot</b>',
        `Thời gian: ${new Date().toLocaleString('vi-VN')}`,
        'Hệ thống thông báo Deadline, Yêu cầu chỉnh sửa và Tin nhắn khách hàng đã sẵn sàng.',
      ].join('\n')
    );
    if (!result.ok) {
      res.status(400).json({ ok: false, error: result.error });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/notifications/telegram/notify', requireTeamAuth, async (req, res) => {
    const cfg = resolveTelegramConfig();
    if (!cfg) {
      res.json({ ok: false, skipped: true });
      return;
    }
    const title =
      typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 180) : '';
    const lines = Array.isArray(req.body?.lines)
      ? req.body.lines
          .filter((l: unknown): l is string => typeof l === 'string')
          .slice(0, 20)
          .map((l: string) => escapeTelegramHtml(l.trim().slice(0, 300)))
      : [];

    if (!title && lines.length === 0) {
      res.status(400).json({ ok: false, error: 'Thiếu nội dung thông báo.' });
      return;
    }

    const html = [`<b>${escapeTelegramHtml(title || 'AssignTrack Thông báo')}</b>`, ...lines].join('\n');
    const result = await dispatchTelegramHtml(html);
    if (!result.ok) {
      res.status(502).json({ ok: false, error: result.error });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/notifications/telegram/client-event', async (req, res) => {
    const cfg = resolveTelegramConfig();
    if (!cfg) {
      res.json({ ok: false, skipped: true });
      return;
    }

    const orderCode =
      typeof req.body?.orderCode === 'string'
        ? req.body.orderCode.trim().toUpperCase()
        : '';
    const eventType =
      req.body?.eventType === 'revision' || req.body?.eventType === 'message'
        ? req.body.eventType
        : '';
    const senderName =
      typeof req.body?.senderName === 'string'
        ? req.body.senderName.trim().slice(0, 60)
        : 'Khách hàng';
    const summary =
      typeof req.body?.summary === 'string'
        ? req.body.summary.trim().slice(0, 600)
        : '';

    if (
      !orderCode ||
      !/^[A-Z0-9-]{4,32}$/.test(orderCode) ||
      !eventType ||
      !summary
    ) {
      res.status(400).json({ ok: false, error: 'Dữ liệu sự kiện không hợp lệ.' });
      return;
    }

    const cooldownKey = `${orderCode}:${eventType}`;
    const now = Date.now();
    const lastSent = clientTelegramCooldowns.get(cooldownKey) || 0;
    if (now - lastSent < 8000) {
      res.json({ ok: true, throttled: true });
      return;
    }

    // Verify tracking portal exists in Firestore before relaying alert
    if (FIREBASE_PROJECT_ID) {
      try {
        const portalUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
          FIREBASE_PROJECT_ID
        )}/databases/${encodeURIComponent(
          FIRESTORE_DATABASE_ID
        )}/documents/trackingPortals/${encodeURIComponent(orderCode)}`;
        const portalResp = await fetch(portalUrl);
        if (!portalResp.ok) {
          res.status(404).json({ ok: false, error: 'Không tìm thấy đơn hàng.' });
          return;
        }
      } catch {
        // Proceed best-effort if REST lookup encounters transient network hiccup
      }
    }

    clientTelegramCooldowns.set(cooldownKey, now);
    const header =
      eventType === 'revision'
        ? `Yêu cầu chỉnh sửa mới · Đơn #${orderCode}`
        : `Tin nhắn mới từ khách · Đơn #${orderCode}`;
    const html = [
      `<b>${escapeTelegramHtml(header)}</b>`,
      `Người gửi: ${escapeTelegramHtml(senderName || 'Khách hàng')}`,
      `Nội dung: ${escapeTelegramHtml(summary)}`,
    ].join('\n');

    const result = await dispatchTelegramHtml(html);
    res.json({ ok: result.ok });
  });

  app.get('/api/extension/hix-bridge.zip', async (_req, res) => {
    const extDir = path.resolve(process.cwd(), 'extension', 'hix-bridge');
    try {
      const files = await fs.promises.readdir(extDir);
      const zip = new JSZip();
      for (const fileName of files) {
        const fullPath = path.join(extDir, fileName);
        const stat = await fs.promises.stat(fullPath);
        if (stat.isFile()) {
          const content = await fs.promises.readFile(fullPath);
          zip.file(fileName, content);
        }
      }
      const buffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="assigntrack-hix-bridge.zip"'
      );
      res.send(buffer);
    } catch {
      res.status(500).json({ error: 'Không thể đóng gói Chrome Extension.' });
    }
  });

  // Upload assignment files or bank QR images (Admin or Active Staff)
  app.post(
    '/api/files/upload',
    requireTeamAuth,
    upload.single('file'),
    async (req, res) => {
      if (!req.file) {
        res.status(400).json({ error: 'Không có tệp nào được gửi lên.' });
        return;
      }

      const fileId = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
      const ext = sanitizeExt(req.file.originalname);
      const storedName = `${fileId}${ext}`;
      const isLocked = req.body?.isLocked === 'true';
      const category = parseCategory(req.body?.category);
      const previewMaxPages = Math.max(
        1,
        Math.min(20, Number(req.body?.previewMaxPages) || 2)
      );
      const turnitinScorePage = Math.max(
        1,
        Number(req.body?.turnitinScorePage) || 1
      );
      const originalName = Buffer.from(
        req.file.originalname,
        'latin1'
      ).toString('utf8');
      const mimeType = req.file.mimetype || 'application/octet-stream';

      const meta: StoredFileMeta = {
        fileId,
        storedName,
        originalName,
        mimeType,
        sizeBytes: req.file.size,
        isLocked,
        category,
        previewMaxPages,
        turnitinScorePage,
        uploadedAt: new Date().toISOString(),
        storageProvider: r2Config ? 'cloudflare-r2' : 'local-disk',
      };

      try {
        await saveFileBinary(storedName, req.file.buffer, mimeType);
        await saveFileMeta(meta);
      } catch (err) {
        console.error('File upload storage error:', err);
        res.status(500).json({
          error: r2Config
            ? 'Không thể lưu tệp lên Cloudflare R2. Vui lòng kiểm tra cấu hình Bucket/Key.'
            : 'Không thể lưu tệp lên máy chủ.',
        });
        return;
      }

      res.json({
        fileId,
        fileName: originalName,
        mimeType: meta.mimeType,
        sizeBytes: meta.sizeBytes,
        url: `/api/files/${fileId}`,
        storageProvider: meta.storageProvider,
      });
    }
  );

  // Direct-to-R2 presigned upload URL for files > 4 MB on serverless hosts (Admin or Active Staff)
  app.post('/api/files/presign-upload', requireTeamAuth, async (req, res) => {
    if (!r2Client || !r2Config) {
      res.status(501).json({
        error: 'Cloudflare R2 chưa được cấu hình cho tải lên trực tiếp.',
      });
      return;
    }

    const fileName =
      typeof req.body?.fileName === 'string' ? req.body.fileName.trim() : '';
    const mimeType =
      typeof req.body?.mimeType === 'string' && req.body.mimeType.trim()
        ? req.body.mimeType.trim()
        : 'application/octet-stream';
    const sizeBytes = Number(req.body?.sizeBytes) || 0;

    if (!fileName || !isAllowedUpload(fileName, mimeType)) {
      res.status(400).json({
        error: 'Định dạng tệp không được hỗ trợ vì lý do bảo mật.',
      });
      return;
    }
    if (sizeBytes <= 0 || sizeBytes > 25 * 1024 * 1024) {
      res.status(413).json({
        error: 'Kích thước tệp vượt quá giới hạn 25 MB.',
      });
      return;
    }

    const fileId = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const ext = sanitizeExt(fileName);
    const storedName = `${fileId}${ext}`;

    try {
      const command = new PutObjectCommand({
        Bucket: r2Config.bucket,
        Key: r2FileKey(storedName),
        ContentType: mimeType,
      });
      const uploadUrl = await getSignedUrl(r2Client, command, {
        expiresIn: 300,
      });

      res.json({
        uploadUrl,
        fileId,
        storedName,
        fileName,
        mimeType,
        sizeBytes,
        url: `/api/files/${fileId}`,
      });
    } catch (err) {
      console.error('Presign R2 error:', err);
      res.status(500).json({
        error: 'Không thể tạo liên kết tải lên Cloudflare R2.',
      });
    }
  });

  // Finalize metadata after direct-to-R2 presigned upload succeeds
  app.post('/api/files/confirm-upload', requireTeamAuth, async (req, res) => {
    if (!r2Client || !r2Config) {
      res.status(501).json({ error: 'Cloudflare R2 chưa được cấu hình.' });
      return;
    }

    const fileId =
      typeof req.body?.fileId === 'string' ? req.body.fileId.trim() : '';
    const storedName =
      typeof req.body?.storedName === 'string'
        ? req.body.storedName.trim()
        : '';
    const fileName =
      typeof req.body?.fileName === 'string' ? req.body.fileName.trim() : '';
    const mimeType =
      typeof req.body?.mimeType === 'string' && req.body.mimeType.trim()
        ? req.body.mimeType.trim()
        : 'application/octet-stream';
    const sizeBytes = Number(req.body?.sizeBytes) || 0;

    if (
      !/^[a-zA-Z0-9_]+$/.test(fileId) ||
      !storedName ||
      path.basename(storedName) !== storedName ||
      !fileName
    ) {
      res.status(400).json({ error: 'Thông tin tệp xác nhận không hợp lệ.' });
      return;
    }

    try {
      await r2Client.send(
        new HeadObjectCommand({
          Bucket: r2Config.bucket,
          Key: r2FileKey(storedName),
        })
      );

      const meta: StoredFileMeta = {
        fileId,
        storedName,
        originalName: fileName,
        mimeType,
        sizeBytes,
        isLocked: Boolean(req.body?.isLocked),
        category: parseCategory(req.body?.category),
        previewMaxPages: Math.max(
          1,
          Math.min(20, Number(req.body?.previewMaxPages) || 2)
        ),
        turnitinScorePage: Math.max(
          1,
          Number(req.body?.turnitinScorePage) || 1
        ),
        uploadedAt: new Date().toISOString(),
        storageProvider: 'cloudflare-r2',
      };

      await saveFileMeta(meta);
      res.json({
        fileId,
        fileName,
        mimeType,
        sizeBytes,
        url: `/api/files/${fileId}`,
        storageProvider: 'cloudflare-r2',
      });
    } catch (err) {
      console.error('Confirm R2 upload error:', err);
      res.status(404).json({
        error: 'Không tìm thấy tệp trên Cloudflare R2 để xác nhận.',
      });
    }
  });

  // Sync payment-lock and preview window metadata from Team UI
  app.post('/api/files/:fileId/lock', requireTeamAuth, async (req, res) => {
    const { fileId } = req.params;
    if (!/^[a-zA-Z0-9_]+$/.test(fileId)) {
      res.status(400).json({ error: 'Invalid fileId' });
      return;
    }

    const meta = await getFileMeta(fileId);
    if (!meta) {
      res.status(404).json({ error: 'File metadata not found' });
      return;
    }

    const updated: StoredFileMeta = {
      ...meta,
      isLocked: Boolean(req.body?.isLocked),
      category: req.body?.category
        ? parseCategory(req.body.category)
        : meta.category,
      previewMaxPages:
        typeof req.body?.previewMaxPages === 'number'
          ? Math.max(1, Math.min(20, req.body.previewMaxPages))
          : meta.previewMaxPages,
      turnitinScorePage:
        typeof req.body?.turnitinScorePage === 'number'
          ? Math.max(1, req.body.turnitinScorePage)
          : meta.turnitinScorePage,
    };

    await saveFileMeta(updated);
    res.json({ ok: true, fileId, isLocked: updated.isLocked });
  });

  // Serve file with server-enforced payment lock & Turnitin page-window trimming
  app.get('/api/files/:fileId', async (req, res) => {
    const { fileId } = req.params;
    if (!/^[a-zA-Z0-9_]+$/.test(fileId)) {
      res.status(400).json({ error: 'Invalid fileId' });
      return;
    }

    const meta = await getFileMeta(fileId);
    if (!meta) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const fileBuffer = await getFileBinary(meta);
    if (!fileBuffer) {
      res.status(404).json({ error: 'File missing on storage' });
      return;
    }

    const teamAuth = await verifyTeamBearerToken(req.headers.authorization);
    const isTeamAuthorized = teamAuth.authorized;
    const wantDownload = req.query.download === '1';
    const isPdf =
      meta.mimeType.includes('pdf') ||
      meta.originalName.toLowerCase().endsWith('.pdf');

    res.setHeader('X-Content-Type-Options', 'nosniff');
    const safeName = encodeURIComponent(meta.originalName);

    if (!isTeamAuthorized) {
      if (wantDownload && meta.isLocked) {
        res.status(403).json({
          error:
            'Tài liệu đang được khóa tải xuống cho đến khi hoàn tất thanh toán.',
        });
        return;
      }

      if (meta.isLocked && !isPdf) {
        res.status(403).json({
          error:
            'Tài liệu đang khóa tải xuống; chỉ hỗ trợ xem trước PDF giới hạn trang.',
        });
        return;
      }

      if (isPdf && (meta.isLocked || meta.category === 'turnitin')) {
        let pageCap = Number.MAX_SAFE_INTEGER;
        if (meta.category === 'turnitin') {
          pageCap = Math.min(
            pageCap,
            Math.max(1, meta.turnitinScorePage || 1) + 2
          );
        }
        if (meta.isLocked) {
          pageCap = Math.min(pageCap, Math.max(1, meta.previewMaxPages || 2));
        }

        try {
          const trimmed = await buildTrimmedPdfBuffer(fileBuffer, pageCap);
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('X-Original-Pages', String(trimmed.originalPages));
          res.setHeader('X-Preview-Limit', String(trimmed.servedPages));
          res.setHeader(
            'Access-Control-Expose-Headers',
            'X-Original-Pages, X-Preview-Limit'
          );
          const disposition = wantDownload ? 'attachment' : 'inline';
          res.setHeader(
            'Content-Disposition',
            `${disposition}; filename*=UTF-8''${safeName}`
          );
          res.send(Buffer.from(trimmed.bytes));
          return;
        } catch {
          res.status(500).json({ error: 'Không thể xử lý bản xem trước PDF.' });
          return;
        }
      }
    }

    const canInline =
      !wantDownload && INLINE_SAFE_MIMES.has(meta.mimeType.toLowerCase());
    res.setHeader('Content-Type', meta.mimeType);
    res.setHeader(
      'Content-Disposition',
      `${canInline ? 'inline' : 'attachment'}; filename*=UTF-8''${safeName}`
    );
    res.send(fileBuffer);
  });

  // Delete stored file (Admin or Active Staff)
  app.delete('/api/files/:fileId', requireTeamAuth, async (req, res) => {
    const { fileId } = req.params;
    if (!/^[a-zA-Z0-9_]+$/.test(fileId)) {
      res.status(400).json({ error: 'Invalid fileId' });
      return;
    }

    await deleteFileAndMeta(fileId);
    res.json({ ok: true });
  });

  // Multer & upload validation error handler
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith('/api/')) {
      next(err);
      return;
    }
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res
          .status(413)
          .json({ error: 'Kích thước tệp vượt quá giới hạn 25 MB.' });
        return;
      }
      res.status(400).json({ error: err.message });
      return;
    }
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Lỗi máy chủ nội bộ.' });
  });

  return app;
}
