import type { IncomingMessage, ServerResponse } from 'http';
import { analyzeDocumentIntegrity } from '../../server/integrityAnalyzer';

interface AnalyzeRequestBody {
  text?: string;
  title?: string;
  excludeReferences?: boolean;
  excludeQuotes?: boolean;
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function readJsonBody(
  req: IncomingMessage & { body?: unknown }
): Promise<AnalyzeRequestBody> {
  if (req.body && typeof req.body === 'object') {
    return req.body as AnalyzeRequestBody;
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    return JSON.parse(req.body) as AnalyzeRequestBody;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw) as AnalyzeRequestBody;
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

  let body: AnalyzeRequestBody;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: 'Dữ liệu JSON gửi lên không hợp lệ.' });
    return;
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (text.length < 40) {
    sendJson(res, 400, {
      error: 'Vui lòng nhập hoặc tải lên tối thiểu 40 ký tự để hệ thống phân tích.',
    });
    return;
  }

  if (text.length > 150000) {
    sendJson(res, 413, {
      error: 'Văn bản vượt quá giới hạn tối đa 150.000 ký tự mỗi lượt kiểm tra.',
    });
    return;
  }

  try {
    const report = await analyzeDocumentIntegrity(text, {
      title: typeof body.title === 'string' ? body.title : undefined,
      excludeReferences:
        typeof body.excludeReferences === 'boolean'
          ? body.excludeReferences
          : true,
      excludeQuotes:
        typeof body.excludeQuotes === 'boolean' ? body.excludeQuotes : true,
    });
    sendJson(res, 200, report);
  } catch (err) {
    sendJson(res, 500, {
      error:
        err instanceof Error
          ? `Không thể hoàn tất kiểm tra: ${err.message}`
          : 'Lỗi máy chủ khi kiểm tra Đạo văn & AI.',
    });
  }
}
