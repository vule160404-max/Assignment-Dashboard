export type HixBypassMode = 'Fast' | 'Balanced' | 'Aggressive';

export interface HixBridgeStatus {
  extensionInstalled: boolean;
  hixTabOpen: boolean;
  hixTabTitle: string;
  hixTabUrl: string;
}

export interface HixHumanizeResult {
  ok: boolean;
  outputText?: string;
  errorCode?: string;
  error?: string;
}

interface ExtensionMessageResponse {
  source?: string;
  requestId?: string;
  ok?: boolean;
  extensionReady?: boolean;
  hixTabOpen?: boolean;
  hixTabTitle?: string;
  hixTabUrl?: string;
  outputText?: string;
  errorCode?: string;
  error?: string;
}

export function isExtensionBridgeFlagPresent(): boolean {
  if (typeof document === 'undefined') return false;
  return Boolean(document.documentElement.getAttribute('data-assigntrack-hix-bridge'));
}

function sendBridgeRequest(
  payload: { type: string; text?: string; mode?: HixBypassMode },
  timeoutMs: number
): Promise<ExtensionMessageResponse> {
  return new Promise((resolve, reject) => {
    const requestId = `hix_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const cleanup = () => {
      window.clearTimeout(timer);
      window.removeEventListener('message', onMessage);
    };

    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('TIMEOUT'));
    }, timeoutMs);

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data as ExtensionMessageResponse | undefined;
      if (!data || data.source !== 'assigntrack-extension' || data.requestId !== requestId) {
        return;
      }
      cleanup();
      resolve(data);
    };

    window.addEventListener('message', onMessage);
    window.postMessage(
      {
        source: 'assigntrack-app',
        requestId,
        ...payload,
      },
      window.location.origin
    );
  });
}

export async function checkHixBridgeStatus(): Promise<HixBridgeStatus> {
  try {
    const resp = await sendBridgeRequest({ type: 'CHECK_HIX_TAB' }, 1800);
    return {
      extensionInstalled: Boolean(resp.extensionReady || isExtensionBridgeFlagPresent()),
      hixTabOpen: Boolean(resp.hixTabOpen),
      hixTabTitle: resp.hixTabTitle || '',
      hixTabUrl: resp.hixTabUrl || '',
    };
  } catch {
    return {
      extensionInstalled: isExtensionBridgeFlagPresent(),
      hixTabOpen: false,
      hixTabTitle: '',
      hixTabUrl: '',
    };
  }
}

export async function humanizeChunkViaExtension(
  text: string,
  mode: HixBypassMode
): Promise<HixHumanizeResult> {
  try {
    const resp = await sendBridgeRequest(
      {
        type: 'HUMANIZE_CHUNK',
        text,
        mode,
      },
      52000
    );

    if (!resp.ok) {
      return {
        ok: false,
        errorCode: resp.errorCode || 'EXTENSION_ERROR',
        error: resp.error || 'HIX Bypass không trả về kết quả hợp lệ.',
      };
    }

    return {
      ok: true,
      outputText: (resp.outputText || '').trim(),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'TIMEOUT') {
      return {
        ok: false,
        errorCode: 'BRIDGE_TIMEOUT',
        error:
          'Không nhận được phản hồi từ Chrome Extension trong 50 giây. Hãy kiểm tra Extension và tab hixbypass.com.',
      };
    }
    return {
      ok: false,
      errorCode: 'BRIDGE_UNREACHABLE',
      error: 'Không kết nối được với Chrome Extension.',
    };
  }
}

export async function cancelHixExtensionRun(): Promise<void> {
  try {
    await sendBridgeRequest({ type: 'CANCEL_HUMANIZE' }, 1200);
  } catch {
    // Ignore if bridge not present
  }
}
