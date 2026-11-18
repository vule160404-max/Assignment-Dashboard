export type HixBypassMode = 'Fast' | 'Balanced' | 'Aggressive';

export const EXPECTED_EXTENSION_VERSION = '1.2.0';

export interface HixTabInfo {
  tabId: number;
  title: string;
  url: string;
  active: boolean;
}

export interface HixBridgeStatus {
  extensionInstalled: boolean;
  extensionVersion: string;
  hixTabOpen: boolean;
  hixTabTitle: string;
  hixTabUrl: string;
  hixTabs: HixTabInfo[];
}

export interface HixHumanizeResult {
  ok: boolean;
  outputText?: string;
  assignedTabId?: number;
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
  hixTabs?: HixTabInfo[];
  tabId?: number;
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
  payload: {
    type: string;
    text?: string;
    mode?: HixBypassMode;
    jobId?: string;
    tabId?: number;
  },
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
    const resp = await sendBridgeRequest({ type: 'CHECK_HIX_TAB' }, 2000);
    const rawTabs = Array.isArray(resp.hixTabs) ? resp.hixTabs : [];
    const hixTabs: HixTabInfo[] =
      rawTabs.length > 0
        ? rawTabs
        : resp.hixTabOpen
          ? [
              {
                tabId: -1,
                title: resp.hixTabTitle || 'HIX Bypass',
                url: resp.hixTabUrl || 'https://hixbypass.com/',
                active: true,
              },
            ]
          : [];

    return {
      extensionInstalled: Boolean(resp.extensionReady || version),
      extensionVersion: version,
      hixTabOpen: Boolean(resp.hixTabOpen || hixTabs.length > 0),
      hixTabTitle: resp.hixTabTitle || hixTabs[0]?.title || '',
      hixTabUrl: resp.hixTabUrl || hixTabs[0]?.url || '',
      hixTabs,
    };
  } catch {
    return {
      extensionInstalled: Boolean(version),
      extensionVersion: version,
      hixTabOpen: false,
      hixTabTitle: '',
      hixTabUrl: '',
      hixTabs: [],
    };
  }
}

export async function humanizeChunkViaExtension(
  text: string,
  mode: HixBypassMode,
  options?: {
    preferredTabId?: number;
    signal?: AbortSignal;
    onStepUpdate?: (step: string) => void;
    onTabAssigned?: (tabId: number) => void;
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
          'Extension bản cũ (1.0.0) bị hết giờ chờ. Hãy tải lại Extension bản mới và bấm Reload trong chrome://extensions.',
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
        tabId: options?.preferredTabId,
      },
      7000
    );

    if (!startResp.ok) {
      return {
        ok: false,
        errorCode: startResp.errorCode || 'START_FAILED',
        error: startResp.error || 'Không thể bắt đầu thao tác trên tab hixbypass.com.',
      };
    }

    const assignedTabId =
      typeof startResp.tabId === 'number' ? startResp.tabId : options?.preferredTabId;

    if (typeof assignedTabId === 'number' && options?.onTabAssigned) {
      options.onTabAssigned(assignedTabId);
    }

    const deadline = Date.now() + 90000;
    let consecutivePollFailures = 0;

    while (Date.now() < deadline) {
      if (options?.signal?.aborted) {
        return {
          ok: false,
          assignedTabId,
          errorCode: 'CANCELLED',
          error: 'Đã tạm dừng thao tác.',
        };
      }

      await sleep(700);

      if (options?.signal?.aborted) {
        return {
          ok: false,
          assignedTabId,
          errorCode: 'CANCELLED',
          error: 'Đã tạm dừng thao tác.',
        };
      }

      let pollResp: ExtensionMessageResponse;
      try {
        pollResp = await sendBridgeRequest(
          {
            type: 'POLL_HUMANIZE',
            jobId,
            tabId: assignedTabId,
          },
          6000
        );
        consecutivePollFailures = 0;
      } catch (pollErr) {
        consecutivePollFailures += 1;
        // Tolerate up to 3 transient SW wakeups / background-tab throttles before failing
        if (consecutivePollFailures <= 3) {
          options?.onStepUpdate?.('Đang giữ kết nối tới tab HIX Bypass...');
          await sleep(450);
          continue;
        }
        throw pollErr;
      }

      if (pollResp.step && options?.onStepUpdate) {
        options.onStepUpdate(pollResp.step);
      }

      if (pollResp.status === 'done') {
        const out = (pollResp.outputText || '').trim();
        if (!out) {
          return {
            ok: false,
            assignedTabId,
            errorCode: 'EMPTY_OUTPUT',
            error: 'HIX Bypass hoàn tất nhưng không đọc được đoạn văn kết quả.',
          };
        }
        return {
          ok: true,
          assignedTabId,
          outputText: out,
        };
      }

      if (pollResp.status === 'error' || !pollResp.ok) {
        return {
          ok: false,
          assignedTabId,
          errorCode: pollResp.errorCode || 'HIX_ERROR',
          error: pollResp.error || 'HIX Bypass không trả về văn bản hợp lệ.',
        };
      }
    }

    return {
      ok: false,
      assignedTabId,
      errorCode: 'BRIDGE_TIMEOUT',
      error:
        'Quá thời gian chờ phản hồi từ HIX Bypass (90 giây). Hãy kiểm tra tab hixbypass.com xem có bị CAPTCHA hay hết lượt từ không.',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'TIMEOUT') {
      return {
        ok: false,
        errorCode: 'BRIDGE_TIMEOUT',
        error:
          'Mất kết nối với Chrome Extension trong lúc chờ tab HIX Bypass. Vui lòng bấm Tiếp tục (hoặc F5 tải lại tab nếu vừa cập nhật Extension).',
      };
    }
    return {
      ok: false,
      errorCode: 'BRIDGE_UNREACHABLE',
      error: 'Không kết nối được với Chrome Extension.',
    };
  }
}

export async function cancelHixExtensionRun(jobId?: string, tabId?: number): Promise<void> {
  try {
    await sendBridgeRequest({ type: 'CANCEL_HUMANIZE', jobId, tabId }, 1500);
  } catch {
    // Ignore if bridge not present
  }
}
