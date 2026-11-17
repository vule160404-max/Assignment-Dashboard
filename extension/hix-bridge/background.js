const HIX_URL_PATTERNS = [
  'https://hixbypass.com/*',
  'https://*.hixbypass.com/*',
  'https://bypass.hix.ai/*',
  'https://*.hix.ai/*',
];

async function findHixTab() {
  const tabs = await chrome.tabs.query({ url: HIX_URL_PATTERNS });
  if (!tabs || tabs.length === 0) return null;
  const activeTab = tabs.find((t) => t.active);
  return activeTab || tabs[0];
}

async function sendToHixTabWithAutoInject(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (_err) {
    // Tab may have been open before extension was loaded — inject hix_content.js dynamically
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
    findHixTab()
      .then((tab) => {
        sendResponse({
          ok: true,
          extensionReady: true,
          hixTabOpen: Boolean(tab),
          hixTabTitle: tab?.title || '',
          hixTabUrl: tab?.url || '',
        });
      })
      .catch((err) => {
        sendResponse({
          ok: false,
          extensionReady: true,
          hixTabOpen: false,
          error: err instanceof Error ? err.message : 'Lỗi kiểm tra tab HIX Bypass.',
        });
      });
    return true;
  }

  if (message.type === 'START_HUMANIZE' || message.type === 'HUMANIZE_CHUNK') {
    (async () => {
      const tab = await findHixTab();
      if (!tab || typeof tab.id !== 'number') {
        sendResponse({
          ok: false,
          errorCode: 'NO_HIX_TAB',
          error:
            'Chưa tìm thấy tab hixbypass.com đang mở. Vui lòng mở và đăng nhập hixbypass.com trong Chrome rồi thử lại.',
        });
        return;
      }

      const targetMsgType =
        message.type === 'START_HUMANIZE' ? 'START_HUMANIZE' : 'EXECUTE_HUMANIZE';

      const resp = await sendToHixTabWithAutoInject(tab.id, {
        type: targetMsgType,
        text: String(message.text || ''),
        mode: String(message.mode || 'Balanced'),
        jobId: message.jobId || message.requestId || '',
        requestId: message.requestId || '',
      });
      sendResponse(resp || { ok: false, error: 'Tab HIX Bypass không phản hồi.' });
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
      const tab = await findHixTab();
      if (!tab || typeof tab.id !== 'number') {
        sendResponse({
          ok: false,
          status: 'error',
          errorCode: 'NO_HIX_TAB',
          error: 'Tab hixbypass.com đã bị đóng trong quá trình xử lý.',
        });
        return;
      }

      const resp = await sendToHixTabWithAutoInject(tab.id, {
        type: 'POLL_HUMANIZE',
        jobId: message.jobId || message.requestId || '',
      });
      sendResponse(
        resp || {
          ok: false,
          status: 'error',
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
    findHixTab()
      .then((tab) => {
        if (tab && typeof tab.id === 'number') {
          return chrome.tabs.sendMessage(tab.id, { type: 'ABORT_CURRENT' }).catch(() => undefined);
        }
        return undefined;
      })
      .finally(() => {
        sendResponse({ ok: true });
      });
    return true;
  }

  return false;
});
