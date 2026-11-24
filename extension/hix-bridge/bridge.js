(() => {
  const FLAG_ATTR = 'data-assigntrack-hix-bridge';
  document.documentElement.setAttribute(FLAG_ATTR, '1.3.1');

  if (window.__assigntrackHixBridgeInitialized) {
    return;
  }
  window.__assigntrackHixBridgeInitialized = true;

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const payload = event.data;
    if (!payload || payload.source !== 'assigntrack-app' || !payload.type) {
      return;
    }

    const requestId = payload.requestId || '';

    try {
      chrome.runtime.sendMessage(
        {
          type: payload.type,
          text: payload.text,
          mode: payload.mode,
          jobId: payload.jobId || requestId,
          tabId: typeof payload.tabId === 'number' ? payload.tabId : undefined,
          requestId,
        },
        (response) => {
          const runtimeErr = chrome.runtime.lastError;
          if (runtimeErr) {
            window.postMessage(
              {
                source: 'assigntrack-extension',
                requestId,
                ok: false,
                errorCode: 'EXTENSION_RUNTIME_ERROR',
                error: runtimeErr.message || 'Không thể liên lạc với Extension background.',
              },
              window.location.origin
            );
            return;
          }

          window.postMessage(
            {
              source: 'assigntrack-extension',
              requestId,
              ...(response || { ok: false, error: 'Không có phản hồi từ Extension.' }),
            },
            window.location.origin
          );
        }
      );
    } catch (err) {
      window.postMessage(
        {
          source: 'assigntrack-extension',
          requestId,
          ok: false,
          errorCode: 'EXTENSION_CONTEXT_INVALIDATED',
          error:
            err instanceof Error
              ? err.message
              : 'Extension vừa được cập nhật. Vui lòng tải lại trang AssignTrack (F5).',
        },
        window.location.origin
      );
    }
  });
})();
