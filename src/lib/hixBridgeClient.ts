export type HixBypassMode = 'Fast' | 'Balanced' | 'Aggressive';

export const EXPECTED_EXTENSION_VERSION = '1.1.0';

export interface HixBridgeStatus {
  extensionInstalled: boolean;
  extensionVersion: string;
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
  jobId?: string;
  status?: 'running' | 'done' | 'error';
  step?: string;
  outputText?: string;
  errorCode?: string;
  error?: string;
}

export function getExtensionBridgeVersion(): string {
  if (typeof document === 'undefined') return '';
  return document.documentElement.getAttribute('data-assigntrack-hix-bridge') || '';
}

export function isExtensionBridgeFlagPresent(): boolean {
  return Boolean(getExtensionBridgeVersion());
}

function sendBridgeRequest(
  payload: { type: string; text?: string; mode?: HixBypassMode; jobId?: string },
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function checkHixBridgeStatus(): Promise<HixBridgeStatus> {
  const version = getExtensionBridgeVersion();
  try {
    const resp = await sendBridgeRequest({ type: 'CHECK_HIX_TAB' }, 1800);
    return {
      extensionInstalled: Boolean(resp.extensionReady || version),
      extensionVersion: version,
      hixTabOpen: Boolean(resp.hixTabOpen),
      hixTabTitle: resp.hixTabTitle || '',
      hixTabUrl: resp.hixTabUrl || '',
    };
  } catch {
    return {
      extensionInstalled: Boolean(version),
      extensionVersion: version,
      hixTabOpen: false,
      hixTabTitle: '',
      hixTabUrl: '',
    };
  }
}

export async function humanizeChunkViaExtension(
  text: string,
  mode: HixBypassMode,
  options?: {
    signal?: AbortSignal;
    onStepUpdate?: (step: string) => void;
  }
): Promise<HixHumanizeResult> {
  const version = getExtensionBridgeVersion();

  // Backward compatibility if user still has v1.0.0 loaded in Chrome
  if (version === '1.0.0') {
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
    } catch {
      return {
        ok: false,
        errorCode: 'BRIDGE_TIMEOUT',
        error:
          'Extension bản cũ (1.0.0) bị hết giờ chờ. Hãy tải lại Extension bản mới (1.1.0) và bấm Reload trong chrome://extensions.',
      };
    }
  }

  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  try {
    const startResp = await sendBridgeRequest(
      {
        type: 'START_HUMANIZE',
        text,
        mode,
        jobId,
      },
      6000
    );

    if (!startResp.ok) {
      return {
        ok: false,
        errorCode: startResp.errorCode || 'START_FAILED',
        error: startResp.error || 'Không thể bắt đầu thao tác trên tab hixbypass.com.',
      };
    }

    const deadline = Date.now() + 65000;
    while (Date.now() < deadline) {
      if (options?.signal?.aborted) {
        return {
          ok: false,
          errorCode: 'CANCELLED',
          error: 'Đã tạm dừng thao tác.',
        };
      }

      await sleep(650);

      if (options?.signal?.aborted) {
        return {
          ok: false,
          errorCode: 'CANCELLED',
          error: 'Đã tạm dừng thao tác.',
        };
      }

      const pollResp = await sendBridgeRequest(
        {
          type: 'POLL_HUMANIZE',
          jobId,
        },
        5000
      );

      if (pollResp.step && options?.onStepUpdate) {
        options.onStepUpdate(pollResp.step);
      }

      if (pollResp.status === 'done') {
        const out = (pollResp.outputText || '').trim();
        if (!out) {
          return {
            ok: false,
            errorCode: 'EMPTY_OUTPUT',
            error: 'HIX Bypass hoàn tất nhưng không đọc được đoạn văn kết quả.',
          };
        }
        return {
          ok: true,
          outputText: out,
        };
      }

      if (pollResp.status === 'error' || !pollResp.ok) {
        return {
          ok: false,
          errorCode: pollResp.errorCode || 'HIX_ERROR',
          error: pollResp.error || 'HIX Bypass không trả về văn bản hợp lệ.',
        };
      }
    }

    return {
      ok: false,
      errorCode: 'BRIDGE_TIMEOUT',
      error:
        'Quá thời gian chờ phản hồi từ HIX Bypass (65 giây). Hãy kiểm tra tab hixbypass.com xem có bị CAPTCHA hay hết lượt từ không.',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'TIMEOUT') {
      return {
        ok: false,
        errorCode: 'BRIDGE_TIMEOUT',
        error:
          'Mất kết nối ngắn với Chrome Extension. Hãy bấm F5 tải lại tab hixbypass.com và AssignTrack rồi bấm Tiếp tục.',
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
