import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';

const UPLOADS_DIR = process.env.VERCEL
  ? path.resolve('/tmp', 'assigntrack-uploads')
  : path.resolve(process.cwd(), 'uploads');
const PREFS_FILE = path.join(UPLOADS_DIR, '.telegram-prefs.json');

interface StoredNotificationPrefs {
  telegramNotifyRevision: boolean;
  telegramNotifyMessage: boolean;
  telegramNotifyDeadline: boolean;
  updatedAt: string;
}

const DEFAULT_PREFS: StoredNotificationPrefs = {
  telegramNotifyRevision: true,
  telegramNotifyMessage: true,
  telegramNotifyDeadline: true,
  updatedAt: '',
};

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function readJsonBody(
  req: IncomingMessage & { body?: unknown }
): Promise<Record<string, unknown>> {
  if (req.method === 'GET' || req.method === 'HEAD') return {};
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

function stripOuterQuotes(val: string): string {
  const trimmed = val.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function inspectTelegramEnv(): {
  hasToken: boolean;
  hasChatId: boolean;
  botToken: string;
  chatId: string;
} {
  const rawToken = stripOuterQuotes(
    process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_TOKEN || ''
  );
  const botToken = /^bot\d+:/i.test(rawToken) ? rawToken.slice(3) : rawToken;
  const chatId = stripOuterQuotes(
    process.env.TELEGRAM_CHAT_ID || process.env.TG_CHAT_ID || ''
  );
  return {
    hasToken: Boolean(botToken),
    hasChatId: Boolean(chatId),
    botToken,
    chatId,
  };
}

function escapeTelegramHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatTelegramApiError(status: number, description?: string): string {
  const desc = (description || '').trim();
  const lower = desc.toLowerCase();
  if (status === 401 || lower.includes('unauthorized')) {
    return 'TELEGRAM_BOT_TOKEN không hợp lệ hoặc đã bị thu hồi từ BotFather.';
  }
  if (lower.includes('chat not found')) {
    return 'Không tìm thấy TELEGRAM_CHAT_ID. Hãy kiểm tra lại ID và đảm bảo bạn đã mở Bot bấm /start (hoặc đã thêm Bot vào nhóm).';
  }
  if (lower.includes('bot was blocked')) {
    return 'Bot đang bị người nhận chặn trên Telegram. Hãy mở lại cuộc trò chuyện và bỏ chặn Bot.';
  }
  if (
    lower.includes('need administrator rights') ||
    lower.includes('not enough rights')
  ) {
    return 'Bot chưa có quyền gửi tin nhắn trong Channel/Group này.';
  }
  return desc || `Telegram Bot API trả về lỗi HTTP ${status}.`;
}

async function getNotificationPrefs(): Promise<StoredNotificationPrefs> {
  try {
    const raw = await fs.promises.readFile(PREFS_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoredNotificationPrefs>;
    return {
      telegramNotifyRevision: parsed.telegramNotifyRevision !== false,
      telegramNotifyMessage: parsed.telegramNotifyMessage !== false,
      telegramNotifyDeadline: parsed.telegramNotifyDeadline !== false,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

async function saveNotificationPrefs(
  prefs: StoredNotificationPrefs
): Promise<void> {
  await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
  await fs.promises.writeFile(PREFS_FILE, JSON.stringify(prefs), 'utf8');
}

async function dispatchTelegramHtml(
  htmlText: string
): Promise<{ ok: boolean; error?: string }> {
  const env = inspectTelegramEnv();
  if (!env.hasToken || !env.hasChatId) {
    return {
      ok: false,
      error:
        'Chưa cấu hình TELEGRAM_BOT_TOKEN và TELEGRAM_CHAT_ID trong biến môi trường máy chủ.',
    };
  }

  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(env.botToken)}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: env.chatId,
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
        error: formatTelegramApiError(resp.status, errBody?.description),
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

function resolveAction(req: IncomingMessage & { query?: Record<string, string | string[]> }): string {
  const qAction = req.query?.action;
  if (typeof qAction === 'string' && qAction.trim()) {
    return qAction.trim().toLowerCase();
  }
  if (Array.isArray(qAction) && qAction[0]) {
    return qAction[0].trim().toLowerCase();
  }
  const urlPath = (req.url || '').split('?')[0];
  const segments = urlPath.split('/').filter(Boolean);
  return (segments[segments.length - 1] || '').toLowerCase();
}

export default async function handler(
  req: IncomingMessage & { body?: unknown; query?: Record<string, string | string[]> },
  res: ServerResponse
): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const action = resolveAction(req);
  const authHeader =
    typeof req.headers.authorization === 'string' &&
    req.headers.authorization.startsWith('Bearer ')
      ? req.headers.authorization.trim()
      : '';

  const isPublicClientAction =
    action === 'new-inquiry' || action === 'client-event';

  if (!authHeader && !isPublicClientAction) {
    sendJson(res, 401, {
      ok: false,
      error: 'Yêu cầu đăng nhập hợp lệ để thao tác với Telegram Bot.',
    });
    return;
  }

  // 1. GET /api/notifications/telegram/status
  if (action === 'status') {
    const env = inspectTelegramEnv();
    const configured = env.hasToken && env.hasChatId;
    if (!configured) {
      const missing: string[] = [];
      if (!env.hasToken) missing.push('TELEGRAM_BOT_TOKEN');
      if (!env.hasChatId) missing.push('TELEGRAM_CHAT_ID');
      sendJson(res, 200, {
        configured: false,
        hasToken: env.hasToken,
        hasChatId: env.hasChatId,
        botReachable: false,
        error: `Máy chủ hiện tại chưa nhận được biến môi trường: ${missing.join(', ')}.`,
      });
      return;
    }

    try {
      const meResp = await fetch(
        `https://api.telegram.org/bot${encodeURIComponent(env.botToken)}/getMe`,
        { signal: AbortSignal.timeout(5000) }
      );
      const meJson = (await meResp.json().catch(() => null)) as {
        ok?: boolean;
        description?: string;
        result?: { username?: string };
      } | null;
      if (!meResp.ok || !meJson?.ok) {
        sendJson(res, 200, {
          configured: true,
          hasToken: true,
          hasChatId: true,
          botReachable: false,
          error: formatTelegramApiError(meResp.status, meJson?.description),
        });
        return;
      }
      sendJson(res, 200, {
        configured: true,
        hasToken: true,
        hasChatId: true,
        botReachable: true,
        botUsername: meJson.result?.username || '',
      });
    } catch (err) {
      sendJson(res, 200, {
        configured: true,
        hasToken: true,
        hasChatId: true,
        botReachable: false,
        error:
          err instanceof Error
            ? `Không thể gọi Telegram getMe: ${err.message}`
            : 'Không thể kết nối kiểm tra Bot với Telegram API.',
      });
    }
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'Method Not Allowed. Use POST.' });
    return;
  }

  let body: Record<string, unknown> = {};
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { ok: false, error: 'Dữ liệu JSON không hợp lệ.' });
    return;
  }

  // 2. POST /api/notifications/telegram/preferences
  if (action === 'preferences') {
    const prefs: StoredNotificationPrefs = {
      telegramNotifyRevision: body.telegramNotifyRevision !== false,
      telegramNotifyMessage: body.telegramNotifyMessage !== false,
      telegramNotifyDeadline: body.telegramNotifyDeadline !== false,
      updatedAt: new Date().toISOString(),
    };
    try {
      await saveNotificationPrefs(prefs);
      sendJson(res, 200, { ok: true });
    } catch {
      sendJson(res, 500, {
        ok: false,
        error: 'Không thể lưu tùy chọn Telegram phía máy chủ.',
      });
    }
    return;
  }

  // 3. POST /api/notifications/telegram/test
  if (action === 'test') {
    const result = await dispatchTelegramHtml(
      [
        '<b>AssignTrack · Kiểm tra kết nối Telegram Bot</b>',
        `Thời gian: ${new Date().toLocaleString('vi-VN')}`,
        'Hệ thống thông báo Deadline, Yêu cầu chỉnh sửa và Tin nhắn khách hàng đã sẵn sàng.',
      ].join('\n')
    );
    if (!result.ok) {
      sendJson(res, 400, { ok: false, error: result.error });
      return;
    }
    sendJson(res, 200, { ok: true });
    return;
  }

  // 4. POST /api/notifications/telegram/notify
  if (action === 'notify') {
    const env = inspectTelegramEnv();
    if (!env.hasToken || !env.hasChatId) {
      sendJson(res, 200, { ok: false, skipped: true });
      return;
    }
    const title =
      typeof body.title === 'string' ? body.title.trim().slice(0, 180) : '';
    const lines = Array.isArray(body.lines)
      ? body.lines
          .filter((l: unknown): l is string => typeof l === 'string')
          .slice(0, 20)
          .map((l: string) => escapeTelegramHtml(l.trim().slice(0, 300)))
      : [];

    if (!title && lines.length === 0) {
      sendJson(res, 400, { ok: false, error: 'Thiếu nội dung thông báo.' });
      return;
    }

    const html = [
      `<b>${escapeTelegramHtml(title || 'AssignTrack Thông báo')}</b>`,
      ...lines,
    ].join('\n');
    const result = await dispatchTelegramHtml(html);
    if (!result.ok) {
      sendJson(res, 502, { ok: false, error: result.error });
      return;
    }
    sendJson(res, 200, { ok: true });
    return;
  }

  // 5. POST /api/notifications/telegram/client-event
  if (action === 'client-event') {
    const env = inspectTelegramEnv();
    if (!env.hasToken || !env.hasChatId) {
      sendJson(res, 200, { ok: false, skipped: true });
      return;
    }

    const orderCode =
      typeof body.orderCode === 'string'
        ? body.orderCode.trim().toUpperCase()
        : '';
    const eventType =
      body.eventType === 'revision' || body.eventType === 'message'
        ? body.eventType
        : '';
    const recordId =
      typeof body.recordId === 'string' ? body.recordId.trim() : '';

    if (
      !orderCode ||
      !/^[A-Z0-9-]{4,32}$/.test(orderCode) ||
      !eventType ||
      !/^[a-zA-Z0-9_-]{4,64}$/.test(recordId)
    ) {
      sendJson(res, 400, { ok: false, error: 'Dữ liệu sự kiện không hợp lệ.' });
      return;
    }

    const prefs = await getNotificationPrefs();
    if (eventType === 'revision' && !prefs.telegramNotifyRevision) {
      sendJson(res, 200, { ok: true, skipped: true });
      return;
    }
    if (eventType === 'message' && !prefs.telegramNotifyMessage) {
      sendJson(res, 200, { ok: true, skipped: true });
      return;
    }

    const header =
      eventType === 'revision'
        ? `<b>AssignTrack · Yêu cầu chỉnh sửa mới (#${escapeTelegramHtml(orderCode)})</b>`
        : `<b>AssignTrack · Tin nhắn mới từ khách hàng (#${escapeTelegramHtml(orderCode)})</b>`;
    const html = [
      header,
      `Mã sự kiện: <code>${escapeTelegramHtml(recordId)}</code>`,
      `Thời gian: ${new Date().toLocaleString('vi-VN')}`,
      'Vui lòng mở Cổng Admin để xem chi tiết và phản hồi khách hàng.',
    ].join('\n');

    const result = await dispatchTelegramHtml(html);
    if (!result.ok) {
      sendJson(res, 502, { ok: false, error: result.error });
      return;
    }
    sendJson(res, 200, { ok: true });
    return;
  }

  // 6. POST /api/notifications/telegram/new-inquiry (public guest order form submission)
  if (action === 'new-inquiry') {
    const env = inspectTelegramEnv();
    if (!env.hasToken || !env.hasChatId) {
      sendJson(res, 200, { ok: false, skipped: true });
      return;
    }

    const inquiryCode =
      typeof body.inquiryCode === 'string'
        ? body.inquiryCode.trim().toUpperCase().slice(0, 32)
        : '';
    const customerName =
      typeof body.customerName === 'string'
        ? body.customerName.trim().slice(0, 120)
        : '';
    const contactInfo =
      typeof body.contactInfo === 'string'
        ? body.contactInfo.trim().slice(0, 160)
        : '';
    const serviceType =
      typeof body.serviceType === 'string'
        ? body.serviceType.trim().slice(0, 100)
        : '';
    const subject =
      typeof body.subject === 'string' ? body.subject.trim().slice(0, 120) : '';
    const topic =
      typeof body.topic === 'string' ? body.topic.trim().slice(0, 240) : '';
    const wordCount =
      typeof body.wordCount === 'number' && Number.isFinite(body.wordCount)
        ? Math.max(0, Math.round(body.wordCount))
        : 0;
    const citationStyle =
      typeof body.citationStyle === 'string'
        ? body.citationStyle.trim().slice(0, 30)
        : 'APA';
    const deadlineAt =
      typeof body.deadlineAt === 'number' && Number.isFinite(body.deadlineAt)
        ? body.deadlineAt
        : 0;
    const notes =
      typeof body.notes === 'string' ? body.notes.trim().slice(0, 600) : '';

    if (
      !inquiryCode ||
      !/^[A-Z0-9-]{4,32}$/.test(inquiryCode) ||
      !customerName ||
      !contactInfo ||
      !subject ||
      !topic
    ) {
      sendJson(res, 400, {
        ok: false,
        error: 'Thiếu thông tin bắt buộc của phiếu đăng ký.',
      });
      return;
    }

    const deadlineStr =
      deadlineAt > 0
        ? new Date(deadlineAt).toLocaleString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'Chưa xác định';

    const lines = [
      `🆕 <b>AssignTrack · ĐƠN ĐĂNG KÝ MỚI (#${escapeTelegramHtml(inquiryCode)})</b>`,
      `👤 <b>Khách hàng:</b> ${escapeTelegramHtml(customerName)}`,
      `📱 <b>Liên hệ (Zalo/FB):</b> <code>${escapeTelegramHtml(contactInfo)}</code>`,
      `📌 <b>Dịch vụ:</b> ${escapeTelegramHtml(serviceType || 'Hỗ trợ học thuật')}`,
      `📚 <b>Môn học:</b> ${escapeTelegramHtml(subject)}`,
      `📝 <b>Đề tài:</b> ${escapeTelegramHtml(topic)}`,
      `📏 <b>Độ dài & Chuẩn:</b> ${wordCount > 0 ? `${wordCount.toLocaleString('vi-VN')} từ` : 'Chưa rõ'} · ${escapeTelegramHtml(citationStyle)}`,
      `⏰ <b>Deadline:</b> ${escapeTelegramHtml(deadlineStr)}`,
    ];
    if (notes) {
      lines.push(`💬 <b>Ghi chú:</b> ${escapeTelegramHtml(notes)}`);
    }
    lines.push(
      '',
      '👉 Mở <b>Cổng Admin → Tab Đơn hàng → Đơn đăng ký mới</b> để duyệt và tạo đơn trực tiếp.'
    );

    const result = await dispatchTelegramHtml(lines.join('\n'));
    if (!result.ok) {
      sendJson(res, 502, { ok: false, error: result.error });
      return;
    }
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 404, { ok: false, error: `Unknown Telegram action: ${action}` });
}
