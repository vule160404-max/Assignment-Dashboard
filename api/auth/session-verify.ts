import type { IncomingMessage, ServerResponse } from 'http';

const ADMIN_EMAIL = (
  process.env.ADMIN_OWNER_EMAIL || 'vule160404@gmail.com'
)
  .trim()
  .toLowerCase();
const REMOVED_LEGACY_EMAIL = 'cycloneielts@gmail.com';

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function decodeJwtPayload(token: string): {
  sub?: string;
  email?: string;
  email_verified?: boolean;
} | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
    };
  } catch {
    return null;
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

  const authHeader = req.headers?.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    sendJson(res, 200, {
      ok: true,
      authorized: false,
      isAdmin: false,
      isOwner: false,
      isRemovedLegacy: false,
    });
    return;
  }

  const token = authHeader.slice(7).trim();
  const payload = decodeJwtPayload(token);
  const email = (payload?.email || '').trim().toLowerCase();

  if (email === REMOVED_LEGACY_EMAIL) {
    sendJson(res, 200, {
      ok: true,
      authorized: false,
      isAdmin: false,
      isOwner: false,
      isRemovedLegacy: true,
    });
    return;
  }

  const isOwner = Boolean(
    email && payload?.email_verified && email === ADMIN_EMAIL
  );

  sendJson(res, 200, {
    ok: true,
    authorized: isOwner,
    isAdmin: isOwner,
    isOwner,
    isRemovedLegacy: false,
    uid: payload?.sub,
  });
}
