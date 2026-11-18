const HIX_URL_PATTERNS = [
  'https://hixbypass.com/*',
  'https://*.hixbypass.com/*',
  'https://bypass.hix.ai/*',
  'https://*.hix.ai/*',
];

/** Track which HIX tab currently runs which jobId with timestamp TTL (prevents stale locks on reload) */
const busyTabJobs = new Map();
const jobToTabMap = new Map();
const JOB_TTL_MS = 120000;

function isTabBusy(tabId) {
  const entry = busyTabJobs.get(tabId);
  if (!entry) return false;
  if (Date.now() - entry.startedAt > JOB_TTL_MS) {
    busyTabJobs.delete(tabId);
    return false;
  }
  return true;
}

chrome.tabs.onRemoved.addListener((closedTabId) => {
  busyTabJobs.delete(closedTabId);
  for (const [jId, tId] of jobToTabMap.entries()) {
    if (tId === closedTabId) {
      jobToTabMap.delete(jId);
    }
  }
});

async function queryHixTabsSorted() {
  const tabs = await chrome.tabs.query({ url: HIX_URL_PATTERNS });
  if (!tabs || tabs.length === 0) return [];
  return [...tabs].sort((a, b) => {
    if ((a.windowId || 0) !== (b.windowId || 0)) {
      return (a.windowId || 0) - (b.windowId || 0);
    }
    return (a.index || 0) - (b.index || 0);
  });
}

function releaseTabJob(tabId, jobId) {
  if (typeof tabId === 'number') {
    const cur = busyTabJobs.get(tabId);
    if (!jobId || cur?.jobId === jobId) {
      busyTabJobs.delete(tabId);
    }
  }
  if (jobId) {
    jobToTabMap.delete(jobId);
  }
}

async function pickTargetHixTab(requestedTabId, excludeBusy = false) {
  const tabs = await queryHixTabsSorted();
  if (tabs.length === 0) return null;

  if (typeof requestedTabId === 'number') {
    return tabs.find((t) => t.id === requestedTabId) || null;
  }

  if (excludeBusy) {
    const idleActive = tabs.find(
      (t) => t.active && !t.discarded && typeof t.id === 'number' && !isTabBusy(t.id)
    );
    if (idleActive) return idleActive;
    const idleLoaded = tabs.find(
      (t) => !t.discarded && typeof t.id === 'number' && !isTabBusy(t.id)
    );
    if (idleLoaded) return idleLoaded;
    const idleAny = tabs.find((t) => typeof t.id === 'number' && !isTabBusy(t.id));
    if (idleAny) return idleAny;
  }

  const activeTab = tabs.find((t) => t.active);
  return activeTab || tabs[0];
}

async function sendToHixTabWithAutoInject(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (_err) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['hix_content.js'],
    });
    return await chrome.tabs.sendMessage(tabId, message);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !message.type) {
    return false;
  }

  if (message.type === 'PING' || message.type === 'CHECK_HIX_TAB') {
    queryHixTabsSorted()
      .then((tabs) => {
        const primary = tabs.find((t) => t.active) || tabs[0] || null;
        sendResponse({
          ok: true,
          extensionReady: true,
          hixTabOpen: tabs.length > 0,
          hixTabTitle: primary?.title || '',
          hixTabUrl: primary?.url || '',
          hixTabs: tabs
            .filter((t) => typeof t.id === 'number')
            .map((t) => ({
              tabId: t.id,
              title: t.title || 'HIX Bypass',
              url: t.url || '',
              active: Boolean(t.active),
            })),
        });
      })
      .catch((err) => {
        sendResponse({
          ok: false,
          extensionReady: true,
          hixTabOpen: false,
          hixTabs: [],
          error: err instanceof Error ? err.message : 'Lỗi kiểm tra tab HIX Bypass.',
        });
      });
    return true;
  }

  if (message.type === 'START_HUMANIZE' || message.type === 'HUMANIZE_CHUNK') {
    (async () => {
      const requestedTabId = typeof message.tabId === 'number' ? message.tabId : undefined;
      const tab = await pickTargetHixTab(requestedTabId, true);

      if (!tab || typeof tab.id !== 'number') {
        sendResponse({
          ok: false,
          errorCode: 'NO_HIX_TAB',
          error:
            requestedTabId !== undefined
              ? 'Tab HIX Bypass được chọn cho bài này đã bị đóng. Vui lòng chọn tab HIX Bypass khác hoặc mở thêm tab.'
              : 'Chưa tìm thấy tab hixbypass.com đang mở. Vui lòng mở và đăng nhập hixbypass.com trong Chrome rồi thử lại.',
        });
        return;
      }

      const jobId = String(message.jobId || message.requestId || `job_${Date.now()}`);
      busyTabJobs.set(tab.id, { jobId, startedAt: Date.now() });
      jobToTabMap.set(jobId, tab.id);
      chrome.tabs.update(tab.id, { autoDiscardable: false }).catch(() => undefined);

      const targetMsgType =
        message.type === 'START_HUMANIZE' ? 'START_HUMANIZE' : 'EXECUTE_HUMANIZE';

      const resp = await sendToHixTabWithAutoInject(tab.id, {
        type: targetMsgType,
        text: String(message.text || ''),
        mode: String(message.mode || 'Balanced'),
        jobId,
        requestId: message.requestId || '',
      });

      if (!resp || !resp.ok) {
        releaseTabJob(tab.id, jobId);
      }

      sendResponse(
        resp
          ? { ...resp, tabId: tab.id }
          : { ok: false, tabId: tab.id, error: 'Tab HIX Bypass không phản hồi.' }
      );
    })().catch((err) => {
      sendResponse({
        ok: false,
        errorCode: 'TAB_COMMUNICATION_FAILED',
        error:
          err instanceof Error
            ? err.message
            : 'Không thể giao tiếp với tab hixbypass.com. Hãy F5 lại tab HIX Bypass.',
      });
    });
    return true;
  }

  if (message.type === 'POLL_HUMANIZE') {
    (async () => {
      const jobId = String(message.jobId || message.requestId || '');
      const boundTabId =
        typeof message.tabId === 'number' ? message.tabId : jobToTabMap.get(jobId);

      const tab = await pickTargetHixTab(boundTabId, false);
      if (!tab || typeof tab.id !== 'number') {
        releaseTabJob(boundTabId, jobId);
        sendResponse({
          ok: false,
          status: 'error',
          errorCode: 'NO_HIX_TAB',
          error: 'Tab hixbypass.com đang chạy bài này đã bị đóng.',
        });
        return;
      }
      if (tab.discarded) {
        releaseTabJob(tab.id, jobId);
        sendResponse({
          ok: false,
          status: 'error',
          errorCode: 'TAB_DISCARDED',
          error: 'Tab hixbypass.com đã bị trình duyệt cho ngủ đông (Memory Saver). Hãy mở lại tab đó rồi bấm Tiếp tục.',
        });
        return;
      }

      const resp = await sendToHixTabWithAutoInject(tab.id, {
        type: 'POLL_HUMANIZE',
        jobId,
      });

      if (resp && (resp.status === 'done' || resp.status === 'error')) {
        releaseTabJob(tab.id, jobId);
      }

      sendResponse(
        resp
          ? { ...resp, tabId: tab.id }
          : {
              ok: false,
              status: 'error',
              tabId: tab.id,
              error: 'Tab HIX Bypass không phản hồi trạng thái.',
            }
      );
    })().catch((err) => {
      sendResponse({
        ok: false,
        status: 'error',
        errorCode: 'TAB_COMMUNICATION_FAILED',
        error:
          err instanceof Error
            ? err.message
            : 'Mất kết nối tới tab hixbypass.com.',
      });
    });
    return true;
  }

  if (message.type === 'CANCEL_HUMANIZE') {
    const jobId = message.jobId ? String(message.jobId) : '';
    const requestedTabId =
      typeof message.tabId === 'number'
        ? message.tabId
        : jobId
          ? jobToTabMap.get(jobId)
          : undefined;

    (async () => {
      if (typeof requestedTabId === 'number') {
        releaseTabJob(requestedTabId, jobId);
        await chrome.tabs
          .sendMessage(requestedTabId, { type: 'ABORT_CURRENT', jobId: jobId || undefined })
          .catch(() => undefined);
      } else {
        const tabs = await queryHixTabsSorted();
        await Promise.all(
          tabs
            .filter((t) => typeof t.id === 'number')
            .map((t) => {
              releaseTabJob(t.id, jobId);
              return chrome.tabs
                .sendMessage(t.id, { type: 'ABORT_CURRENT', jobId: jobId || undefined })
                .catch(() => undefined);
            })
        );
      }
    })().finally(() => {
      sendResponse({ ok: true });
    });
    return true;
  }

  return false;
});
