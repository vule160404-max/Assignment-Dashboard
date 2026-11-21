import { auth } from '../lib/firebase';
import { AttachmentCategory, NotificationSettings } from '../types/domain';

export async function getAdminAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

export async function uploadFileToServer(
  file: File,
  options: {
    isLocked?: boolean;
    category?: AttachmentCategory;
    previewMaxPages?: number;
    turnitinScorePage?: number;
    orderCode?: string;
    versionRole?: 'latest' | 'backup' | 'attachment';
  } = {}
): Promise<{
  fileId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  r2Key?: string;
  storageProvider?: string;
}> {
  const authHeaders = await getAdminAuthHeaders();
  const formData = new FormData();
  formData.append('file', file);
  formData.append('isLocked', String(Boolean(options.isLocked)));
  if (options.category) formData.append('category', options.category);
  if (options.orderCode) formData.append('orderCode', options.orderCode);
  if (options.versionRole) formData.append('versionRole', options.versionRole);
  if (options.previewMaxPages !== undefined) {
    formData.append('previewMaxPages', String(options.previewMaxPages));
  }
  if (options.turnitinScorePage !== undefined) {
    formData.append('turnitinScorePage', String(options.turnitinScorePage));
  }

  const res = await fetch('/api/files/upload', {
    method: 'POST',
    headers: authHeaders,
    body: formData,
  });

  if (res.status === 413 && file.size <= 25 * 1024 * 1024) {
    const presignRes = await fetch('/api/files/presign-upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        isLocked: Boolean(options.isLocked),
        category: options.category || 'brief',
        orderCode: options.orderCode,
        versionRole: options.versionRole,
        previewMaxPages: options.previewMaxPages,
        turnitinScorePage: options.turnitinScorePage,
      }),
    });

    if (presignRes.ok) {
      const presigned = (await presignRes.json()) as {
        uploadUrl: string;
        fileId: string;
        storedName: string;
        fileName: string;
        mimeType: string;
        sizeBytes: number;
        r2Key?: string;
      };

      const putRes = await fetch(presigned.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': presigned.mimeType },
        body: file,
      }).catch(() => null);

      if (!putRes || !putRes.ok) {
        throw new Error(
          'Tệp > 4.5 MB không thể tải trực tiếp lên Cloudflare R2 (kiểm tra lại CORS trên Bucket R2 hoặc nén tệp ≤ 4 MB).'
        );
      }

      const confirmRes = await fetch('/api/files/confirm-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          fileId: presigned.fileId,
          storedName: presigned.storedName,
          fileName: presigned.fileName,
          mimeType: presigned.mimeType,
          sizeBytes: presigned.sizeBytes,
          isLocked: Boolean(options.isLocked),
          category: options.category || 'brief',
          orderCode: options.orderCode,
          versionRole: options.versionRole,
          r2Key: presigned.r2Key,
          previewMaxPages: options.previewMaxPages,
          turnitinScorePage: options.turnitinScorePage,
        }),
      });

      if (!confirmRes.ok) {
        const err = await confirmRes
          .json()
          .catch(() => ({ error: 'Xác nhận tải tệp lên Cloudflare R2 thất bại.' }));
        throw new Error(err.error || 'Xác nhận tải tệp lên Cloudflare R2 thất bại.');
      }

      return confirmRes.json();
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `Tải tệp lên thất bại (HTTP ${res.status}).` }));
    throw new Error(err.error || `Tải tệp lên thất bại (HTTP ${res.status}).`);
  }
  return res.json();
}

export async function moveServerFileToBackup(
  fileIdOrUrl: string,
  orderCode: string
): Promise<{ r2Key?: string }> {
  if (!fileIdOrUrl.startsWith('/api/files/')) return {};
  const fileId = fileIdOrUrl.replace('/api/files/', '').split('?')[0];
  if (!fileId) return {};

  try {
    const authHeaders = await getAdminAuthHeaders();
    const res = await fetch(
      `/api/files/${encodeURIComponent(fileId)}/move-backup`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ orderCode }),
      }
    );
    if (!res.ok) return {};
    const data = (await res.json().catch(() => ({}))) as { r2Key?: string };
    return { r2Key: data.r2Key };
  } catch {
    return {};
  }
}

export async function syncServerFileLock(
  fileIdOrUrl: string,
  params: {
    isLocked: boolean;
    category?: AttachmentCategory;
    previewMaxPages?: number;
    turnitinScorePage?: number;
  }
): Promise<void> {
  if (!fileIdOrUrl.startsWith('/api/files/')) return;
  const fileId = fileIdOrUrl.replace('/api/files/', '').split('?')[0];
  if (!fileId) return;

  const authHeaders = await getAdminAuthHeaders();
  const res = await fetch(`/api/files/${encodeURIComponent(fileId)}/lock`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify(params),
  });

  if (!res.ok && res.status !== 404 && res.status !== 403) {
    const err = await res.json().catch(() => ({ error: 'Không thể đồng bộ khóa tệp.' }));
    throw new Error(err.error || 'Không thể đồng bộ khóa tệp.');
  }
}

export async function deleteServerFile(fileIdOrUrl: string): Promise<void> {
  if (!fileIdOrUrl.startsWith('/api/files/')) return;
  const fileId = fileIdOrUrl.replace('/api/files/', '').split('?')[0];
  if (!fileId) return;

  const authHeaders = await getAdminAuthHeaders();
  const res = await fetch(`/api/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: authHeaders,
  });

  if (!res.ok && res.status !== 404) {
    const err = await res.json().catch(() => ({ error: 'Không thể xóa tệp trên máy chủ.' }));
    throw new Error(err.error || 'Không thể xóa tệp trên máy chủ.');
  }
}

export interface TelegramServerStatus {
  configured: boolean;
  hasToken?: boolean;
  hasChatId?: boolean;
  botReachable?: boolean;
  botUsername?: string;
  error?: string;
}

export async function fetchTelegramServerStatus(): Promise<TelegramServerStatus> {
  const headers = await getAdminAuthHeaders();
  const res = await fetch('/api/notifications/telegram/status', { headers });
  const ctype = (res.headers.get('content-type') || '').toLowerCase();
  if (!ctype.includes('application/json')) {
    return {
      configured: false,
      error: `Máy chủ API (/api/notifications/telegram/status) trả về HTTP ${res.status} không phải JSON. Hãy kiểm tra lại deploy Serverless Function trên Vercel.`,
    };
  }
  const body = (await res.json().catch(() => null)) as
    | (Partial<TelegramServerStatus> & { error?: string })
    | null;
  if (!res.ok) {
    return {
      configured: false,
      error:
        body?.error ||
        `Không thể xác thực kiểm tra Telegram với máy chủ (HTTP ${res.status}).`,
    };
  }
  return {
    configured: Boolean(body?.configured),
    hasToken: body?.hasToken,
    hasChatId: body?.hasChatId,
    botReachable: body?.botReachable,
    botUsername: body?.botUsername,
    error: body?.error,
  };
}

export async function syncTelegramPreferencesToServer(
  settings: Omit<NotificationSettings, 'updatedAt'>
): Promise<void> {
  const headers = await getAdminAuthHeaders();
  const res = await fetch('/api/notifications/telegram/preferences', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(settings),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || 'Không thể đồng bộ tùy chọn Telegram lên máy chủ.');
  }
}

export async function sendTelegramTestAlert(): Promise<void> {
  const headers = await getAdminAuthHeaders();
  const res = await fetch('/api/notifications/telegram/test', {
    method: 'POST',
    headers,
  });
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok || !body.ok) {
    throw new Error(body.error || 'Không thể gửi tin thử nghiệm Telegram.');
  }
}

export async function sendTelegramAdminAlert(params: {
  title: string;
  lines: string[];
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  try {
    const headers = await getAdminAuthHeaders();
    const res = await fetch('/api/notifications/telegram/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(params),
    });
    return (await res.json().catch(() => ({ ok: false }))) as {
      ok: boolean;
      skipped?: boolean;
      error?: string;
    };
  } catch {
    return { ok: false };
  }
}

export function triggerClientTelegramNotification(params: {
  orderCode: string;
  eventType: 'message' | 'revision';
  recordId: string;
}): void {
  void (async () => {
    const token = await auth.currentUser?.getIdToken().catch(() => '');
    if (!token) return;
    await fetch('/api/notifications/telegram/client-event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });
  })().catch(() => undefined);
}
