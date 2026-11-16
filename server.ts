import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';

const PORT = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === 'production';
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const META_FILE = path.join(UPLOADS_DIR, '.file-meta.json');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

interface StoredFileMeta {
  fileId: string;
  storedName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  isLocked: boolean;
  uploadedAt: string;
}

function readMetaStore(): Record<string, StoredFileMeta> {
  try {
    if (!fs.existsSync(META_FILE)) return {};
    return JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeMetaStore(store: Record<string, StoredFileMeta>) {
  fs.writeFileSync(META_FILE, JSON.stringify(store, null, 2), 'utf8');
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).replace(/[^a-zA-Z0-9.]/g, '').slice(0, 16);
    const id = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    cb(null, `${id}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB limit
});

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      storageProvider: process.env.R2_BUCKET ? 'cloudflare-r2-configured' : 'local-disk',
    });
  });

  // Upload assignment files or bank QR images
  app.post('/api/files/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'No file provided.' });
      return;
    }

    const fileId = path.parse(req.file.filename).name;
    const isLocked = req.body?.isLocked === 'true';
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

    const meta: StoredFileMeta = {
      fileId,
      storedName: req.file.filename,
      originalName,
      mimeType: req.file.mimetype || 'application/octet-stream',
      sizeBytes: req.file.size,
      isLocked,
      uploadedAt: new Date().toISOString(),
    };

    const store = readMetaStore();
    store[fileId] = meta;
    writeMetaStore(store);

    res.json({
      fileId,
      fileName: originalName,
      mimeType: meta.mimeType,
      sizeBytes: meta.sizeBytes,
      url: `/api/files/${fileId}`,
    });
  });

  // Sync payment-lock state from Admin UI
  app.post('/api/files/:fileId/lock', (req, res) => {
    const { fileId } = req.params;
    if (!/^[a-zA-Z0-9_]+$/.test(fileId)) {
      res.status(400).json({ error: 'Invalid fileId' });
      return;
    }
    const store = readMetaStore();
    if (!store[fileId]) {
      res.status(404).json({ error: 'File metadata not found' });
      return;
    }
    store[fileId].isLocked = Boolean(req.body?.isLocked);
    writeMetaStore(store);
    res.json({ ok: true, fileId, isLocked: store[fileId].isLocked });
  });

  // Serve file for inline PDF.js preview or unlocked attachment download
  app.get('/api/files/:fileId', (req, res) => {
    const { fileId } = req.params;
    if (!/^[a-zA-Z0-9_]+$/.test(fileId)) {
      res.status(400).json({ error: 'Invalid fileId' });
      return;
    }
    const store = readMetaStore();
    const meta = store[fileId];
    if (!meta) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const wantDownload = req.query.download === '1';
    if (wantDownload && meta.isLocked) {
      res.status(403).json({
        error: 'Tài liệu đang được khóa tải xuống cho đến khi hoàn tất thanh toán.',
      });
      return;
    }

    const filePath = path.join(UPLOADS_DIR, meta.storedName);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File missing on storage' });
      return;
    }

    res.setHeader('Content-Type', meta.mimeType);
    const safeName = encodeURIComponent(meta.originalName);
    if (wantDownload) {
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safeName}`);
    } else {
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${safeName}`);
    }
    res.sendFile(filePath);
  });

  // Delete stored file
  app.delete('/api/files/:fileId', (req, res) => {
    const { fileId } = req.params;
    if (!/^[a-zA-Z0-9_]+$/.test(fileId)) {
      res.status(400).json({ error: 'Invalid fileId' });
      return;
    }
    const store = readMetaStore();
    const meta = store[fileId];
    if (meta) {
      const filePath = path.join(UPLOADS_DIR, meta.storedName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      delete store[fileId];
      writeMetaStore(store);
    }
    res.json({ ok: true });
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
