import { SessionContextImage } from '../components/admin/writer/types';

export const FIGURE_MARKER_REGEX = /^\[(?:FIGURE|IMAGE|IMG):\s*(IMG_\d+)\s*\]$/i;

export function parseFigureMarkerTag(line: string): string | null {
  const m = (line || '').trim().match(FIGURE_MARKER_REGEX);
  return m ? m[1].toUpperCase() : null;
}

export function findSessionImageByTag(
  images: SessionContextImage[] | undefined,
  tag: string
): SessionContextImage | undefined {
  if (!images || images.length === 0) return undefined;
  const norm = tag.trim().toUpperCase();
  return images.find((img) => img.tag.toUpperCase() === norm);
}

export function getNextImageTag(existing: SessionContextImage[] | undefined): string {
  const used = new Set((existing || []).map((i) => i.tag.toUpperCase()));
  let n = 1;
  while (used.has(`IMG_${n}`)) {
    n += 1;
  }
  return `IMG_${n}`;
}

export function decodeBase64DataUrl(dataUrl: string): {
  mimeType: string;
  ext: 'png' | 'jpeg';
  bytes: Uint8Array;
} | null {
  const m = dataUrl
    .trim()
    .match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!m) return null;
  const rawMime = m[1].toLowerCase();
  const mimeType = rawMime === 'image/jpg' ? 'image/jpeg' : rawMime;
  const ext: 'png' | 'jpeg' = mimeType === 'image/png' ? 'png' : 'jpeg';
  const binary = atob(m[2].replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return { mimeType, ext, bytes };
}

/**
 * Compresses & normalizes an uploaded or pasted image to a crisp, readable
 * JPEG/PNG data URL (max 1400px longest side) so Perplexity Vision reads
 * survey numbers & chart labels accurately while keeping Firestore & Vercel
 * payloads lightweight.
 */
export async function compressImageToContextItem(
  file: File,
  tag: string
): Promise<SessionContextImage> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Không đọc được ảnh "${file.name}".`));
    reader.readAsDataURL(file);
  });

  const imgEl = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error(`Định dạng ảnh "${file.name}" không hợp lệ.`));
    el.src = rawDataUrl;
  });

  const maxSide = 1400;
  let targetW = imgEl.naturalWidth || 800;
  let targetH = imgEl.naturalHeight || 600;
  if (Math.max(targetW, targetH) > maxSide) {
    const ratio = maxSide / Math.max(targetW, targetH);
    targetW = Math.max(1, Math.round(targetW * ratio));
    targetH = Math.max(1, Math.round(targetH * ratio));
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Trình duyệt không hỗ trợ Canvas để xử lý ảnh.');
  }
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.drawImage(imgEl, 0, 0, targetW, targetH);

  // Use JPEG 0.84 for compact, crisp text/chart readability (PNG if tiny < 120 KB)
  let outMime = 'image/jpeg';
  let outDataUrl = canvas.toDataURL('image/jpeg', 0.84);
  if (outDataUrl.length > 350_000) {
    outDataUrl = canvas.toDataURL('image/jpeg', 0.72);
  }
  if (file.type === 'image/png' && rawDataUrl.length < 160_000 && Math.max(imgEl.naturalWidth, imgEl.naturalHeight) <= maxSide) {
    outMime = 'image/png';
    outDataUrl = rawDataUrl;
  }

  const approxBytes = Math.round((outDataUrl.length * 3) / 4);
  const cleanName = (file.name || `${tag}.jpg`).replace(/\.[^.]+$/, '');

  return {
    id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    tag,
    name: file.name || `${tag}.jpg`,
    caption: cleanName,
    mimeType: outMime,
    dataUrl: outDataUrl,
    width: targetW,
    height: targetH,
    sizeBytes: approxBytes,
    insertIntoPaper: true,
    uploadedAt: new Date().toISOString(),
  };
}
