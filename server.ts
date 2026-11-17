import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { createServer as createViteServer } from 'vite';

const PORT = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === 'production';
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const META_FILE = path.join(UPLOADS_DIR, '.file-meta.json');
const ADMIN_EMAIL = 'vule160404@gmail.com';
const REMOVED_LEGACY_EMAIL = 'cycloneielts@gmail.com';
const OWNER_BOOTSTRAP_DIGEST =
  'eae81b8cf18b8aa05663d4a179738cada71f736c89fa1578415c5844f3084628';
const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function loadFirebaseConfig(): { projectId: string; databaseId: string } {
  try {
    const raw = fs.readFileSync(
      path.resolve(process.cwd(), 'firebase-applet-config.json'),
      'utf8'
    );
    const parsed = JSON.parse(raw) as { projectId?: string; firestoreDatabaseId?: string };
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

type FileCategory = 'brief' | 'turnitin' | 'draft' | 'final';

interface StoredFileMeta {
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
}

// --- Serialized Async Metadata Store ---
let metaQueue: Promise<unknown> = Promise.resolve();

function withMetaLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = metaQueue.then(fn, fn);
  metaQueue = next.catch(() => undefined);
  return next;
}

async function readMetaStore(): Promise<Record<string, StoredFileMeta>> {
  try {
    const raw = await fs.promises.readFile(META_FILE, 'utf8');
    return JSON.parse(raw) as Record<string, StoredFileMeta>;
  } catch {
    return {};
  }
}

async function writeMetaStore(store: Record<string, StoredFileMeta>): Promise<void> {
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

async function verifyTeamBearerToken(authHeader?: string): Promise<VerifiedTeamResult> {
  if (!authHeader || !authHeader.startsWith('Bearer ') || !FIREBASE_PROJECT_ID) {
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
    const sigBuf = Buffer.from(sigB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
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

  // Verify active Admin or Staff role directly in Firestore /users/{uid}
  try {
    const docUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      FIREBASE_PROJECT_ID
    )}/databases/${encodeURIComponent(FIRESTORE_DATABASE_ID)}/documents/users/${encodeURIComponent(
      payload.sub
    )}`;
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

async function requireTeamAuth(req: Request, res: Response, next: NextFunction) {
  const result = await verifyTeamBearerToken(req.headers.authorization);
  if (!result.authorized) {
    res.status(401).json({ error: 'Yêu cầu quyền Admin hoặc Nhân sự đang hoạt động để thực hiện thao tác này.' });
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

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path
      .extname(file.originalname)
      .toLowerCase()
      .replace(/[^a-z0-9.]/g, '')
      .slice(0, 12);
    const id = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    cb(null, `${id}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB limit
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext) || mime.includes('svg') || mime.includes('html')) {
      cb(new Error('Định dạng tệp không được hỗ trợ vì lý do bảo mật.'));
      return;
    }
    cb(null, true);
  },
});

function parseCategory(raw: unknown): FileCategory {
  if (raw === 'turnitin' || raw === 'draft' || raw === 'final') return raw;
  return 'brief';
}

async function buildTrimmedPdfBuffer(
  filePath: string,
  maxPages: number
): Promise<{ bytes: Uint8Array; originalPages: number; servedPages: number }> {
  const rawBytes = await fs.promises.readFile(filePath);
  const srcDoc = await PDFDocument.load(rawBytes);
  const originalPages = srcDoc.getPageCount();
  const servedPages = Math.min(originalPages, Math.max(1, maxPages));

  if (servedPages >= originalPages) {
    return { bytes: rawBytes, originalPages, servedPages: originalPages };
  }

  const outDoc = await PDFDocument.create();
  const pageIndices = Array.from({ length: servedPages }, (_, idx) => idx);
  const copied = await outDoc.copyPages(srcDoc, pageIndices);
  copied.forEach((p) => outDoc.addPage(p));
  const trimmedBytes = await outDoc.save();
  return { bytes: trimmedBytes, originalPages, servedPages };
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  // Baseline HTTP Security Headers (preserving iframe preview compatibility)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  // In-memory rate limiter for auth bootstrap endpoint (max 5 failed attempts per 15 min per IP)
  const bootstrapAttempts = new Map<string, { count: number; resetAt: number }>();

  app.post('/api/auth/verify-owner-bootstrap', (req, res) => {
    const ip = String(req.ip || req.socket.remoteAddress || 'unknown');
    const now = Date.now();
    const record = bootstrapAttempts.get(ip);
    if (record && now < record.resetAt && record.count >= 5) {
      res.status(429).json({ allowed: false, error: 'Too many attempts. Try again later.' });
      return;
    }

    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
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
      bootstrapAttempts.set(ip, { count: nextCount, resetAt: now + 15 * 60 * 1000 });
      res.status(401).json({ allowed: false });
      return;
    }

    bootstrapAttempts.delete(ip);
    res.json({ allowed: true });
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      storageProvider: 'local-disk',
    });
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
      const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
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
  app.post('/api/files/upload', requireTeamAuth, upload.single('file'), async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'Không có tệp nào được gửi lên.' });
      return;
    }

    const fileId = path.parse(req.file.filename).name;
    const isLocked = req.body?.isLocked === 'true';
    const category = parseCategory(req.body?.category);
    const previewMaxPages = Math.max(1, Math.min(20, Number(req.body?.previewMaxPages) || 2));
    const turnitinScorePage = Math.max(1, Number(req.body?.turnitinScorePage) || 1);
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

    const meta: StoredFileMeta = {
      fileId,
      storedName: req.file.filename,
      originalName,
      mimeType: req.file.mimetype || 'application/octet-stream',
      sizeBytes: req.file.size,
      isLocked,
      category,
      previewMaxPages,
      turnitinScorePage,
      uploadedAt: new Date().toISOString(),
    };

    await withMetaLock(async () => {
      const store = await readMetaStore();
      store[fileId] = meta;
      await writeMetaStore(store);
    });

    res.json({
      fileId,
      fileName: originalName,
      mimeType: meta.mimeType,
      sizeBytes: meta.sizeBytes,
      url: `/api/files/${fileId}`,
    });
  });

  // Sync payment-lock and preview window metadata from Team UI
  app.post('/api/files/:fileId/lock', requireTeamAuth, async (req, res) => {
    const { fileId } = req.params;
    if (!/^[a-zA-Z0-9_]+$/.test(fileId)) {
      res.status(400).json({ error: 'Invalid fileId' });
      return;
    }

    const updated = await withMetaLock(async () => {
      const store = await readMetaStore();
      if (!store[fileId]) return null;
      store[fileId].isLocked = Boolean(req.body?.isLocked);
      if (req.body?.category) {
        store[fileId].category = parseCategory(req.body.category);
      }
      if (typeof req.body?.previewMaxPages === 'number') {
        store[fileId].previewMaxPages = Math.max(1, Math.min(20, req.body.previewMaxPages));
      }
      if (typeof req.body?.turnitinScorePage === 'number') {
        store[fileId].turnitinScorePage = Math.max(1, req.body.turnitinScorePage);
      }
      await writeMetaStore(store);
      return store[fileId];
    });

    if (!updated) {
      res.status(404).json({ error: 'File metadata not found' });
      return;
    }
    res.json({ ok: true, fileId, isLocked: updated.isLocked });
  });

  // Serve file with server-enforced payment lock & Turnitin page-window trimming
  app.get('/api/files/:fileId', async (req, res) => {
    const { fileId } = req.params;
    if (!/^[a-zA-Z0-9_]+$/.test(fileId)) {
      res.status(400).json({ error: 'Invalid fileId' });
      return;
    }

    const store = await readMetaStore();
    const meta = store[fileId];
    if (!meta) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const filePath = resolveSafeUploadPath(meta.storedName);
    if (!filePath) {
      res.status(400).json({ error: 'Invalid file path' });
      return;
    }

    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
    } catch {
      res.status(404).json({ error: 'File missing on storage' });
      return;
    }

    const teamAuth = await verifyTeamBearerToken(req.headers.authorization);
    const isTeamAuthorized = teamAuth.authorized;
    const wantDownload = req.query.download === '1';
    const isPdf =
      meta.mimeType.includes('pdf') || meta.originalName.toLowerCase().endsWith('.pdf');

    res.setHeader('X-Content-Type-Options', 'nosniff');
    const safeName = encodeURIComponent(meta.originalName);

    if (!isTeamAuthorized) {
      if (wantDownload && meta.isLocked) {
        res.status(403).json({
          error: 'Tài liệu đang được khóa tải xuống cho đến khi hoàn tất thanh toán.',
        });
        return;
      }

      if (meta.isLocked && !isPdf) {
        res.status(403).json({
          error: 'Tài liệu đang khóa tải xuống; chỉ hỗ trợ xem trước PDF giới hạn trang.',
        });
        return;
      }

      if (isPdf && (meta.isLocked || meta.category === 'turnitin')) {
        let pageCap = Number.MAX_SAFE_INTEGER;
        if (meta.category === 'turnitin') {
          pageCap = Math.min(pageCap, Math.max(1, meta.turnitinScorePage || 1) + 2);
        }
        if (meta.isLocked) {
          pageCap = Math.min(pageCap, Math.max(1, meta.previewMaxPages || 2));
        }

        try {
          const trimmed = await buildTrimmedPdfBuffer(filePath, pageCap);
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('X-Original-Pages', String(trimmed.originalPages));
          res.setHeader('X-Preview-Limit', String(trimmed.servedPages));
          res.setHeader('Access-Control-Expose-Headers', 'X-Original-Pages, X-Preview-Limit');
          const disposition = wantDownload ? 'attachment' : 'inline';
          res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${safeName}`);
          res.send(Buffer.from(trimmed.bytes));
          return;
        } catch {
          res.status(500).json({ error: 'Không thể xử lý bản xem trước PDF.' });
          return;
        }
      }
    }

    const canInline = !wantDownload && INLINE_SAFE_MIMES.has(meta.mimeType.toLowerCase());
    res.setHeader('Content-Type', meta.mimeType);
    res.setHeader(
      'Content-Disposition',
      `${canInline ? 'inline' : 'attachment'}; filename*=UTF-8''${safeName}`
    );
    res.sendFile(filePath);
  });

  // Delete stored file (Admin or Active Staff)
  app.delete('/api/files/:fileId', requireTeamAuth, async (req, res) => {
    const { fileId } = req.params;
    if (!/^[a-zA-Z0-9_]+$/.test(fileId)) {
      res.status(400).json({ error: 'Invalid fileId' });
      return;
    }

    const removedMeta = await withMetaLock(async () => {
      const store = await readMetaStore();
      const meta = store[fileId];
      if (!meta) return null;
      delete store[fileId];
      await writeMetaStore(store);
      return meta;
    });

    if (removedMeta) {
      const filePath = resolveSafeUploadPath(removedMeta.storedName);
      if (filePath) {
        await fs.promises.unlink(filePath).catch(() => undefined);
      }
    }
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
        res.status(413).json({ error: 'Kích thước tệp vượt quá giới hạn 25 MB.' });
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

  // Unknown API endpoints return JSON 404 instead of SPA HTML
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AssignTrack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
