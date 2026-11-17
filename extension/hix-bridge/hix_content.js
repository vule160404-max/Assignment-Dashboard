(() => {
  if (window.__ASSIGNTRACK_HIX_CONTENT_LOADED__) return;
  window.__ASSIGNTRACK_HIX_CONTENT_LOADED__ = true;

  let activeRunToken = 0;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 40 && rect.height > 30;
  }

  function setNativeTextValue(el, text) {
    el.focus();
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      const proto =
        el.tagName === 'TEXTAREA'
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
      if (descriptor && typeof descriptor.set === 'function') {
        descriptor.set.call(el, text);
      } else {
        el.value = text;
      }
      el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    // contenteditable fallback
    el.textContent = text;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function findInputElement() {
    const textareas = Array.from(document.querySelectorAll('textarea')).filter(
      (ta) => isVisible(ta) && !ta.readOnly && !ta.disabled
    );
    if (textareas.length > 0) {
      // Pick the leftmost or largest visible editable textarea
      textareas.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
      return textareas[0];
    }

    const editables = Array.from(
      document.querySelectorAll('[contenteditable="true"], [role="textbox"]')
    ).filter((el) => isVisible(el));
    if (editables.length > 0) {
      editables.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
      return editables[0];
    }
    return null;
  }

  function findHumanizeButton() {
    const buttons = Array.from(document.querySelectorAll('button, [role="button"]')).filter((btn) =>
      isVisible(btn)
    );
    const exactMatch = buttons.find((btn) => {
      const txt = (btn.textContent || '').trim().toLowerCase();
      return txt === 'humanize' || txt === 'humanize now' || txt === 'humanize text';
    });
    if (exactMatch) return exactMatch;

    return (
      buttons.find((btn) => {
        const txt = (btn.textContent || '').trim().toLowerCase();
        return txt.includes('humanize') && !txt.includes('detector') && !txt.includes('history');
      }) || null
    );
  }

  function selectModeIfAvailable(modeName) {
    if (!modeName) return;
    const normalized = modeName.trim().toLowerCase();
    const candidates = Array.from(
      document.querySelectorAll('button, [role="tab"], [role="radio"], label')
    ).filter((el) => isVisible(el));
    const match = candidates.find((el) => {
      const txt = (el.textContent || '').trim().toLowerCase();
      return txt === normalized || (normalized === 'aggressive' && txt.includes('aggressive'));
    });
    if (match) {
      match.click();
    }
  }

  function readOutputText(inputEl) {
    // Strategy 1: A second textarea / readonly textarea on the right side
    const textareas = Array.from(document.querySelectorAll('textarea')).filter((ta) => isVisible(ta));
    const otherTextarea = textareas.find((ta) => ta !== inputEl);
    if (otherTextarea && (otherTextarea.value || '').trim().length > 0) {
      return otherTextarea.value.trim();
    }

    // Strategy 2: Known output / result containers positioned to the right or below input
    const inputRect = inputEl.getBoundingClientRect();
    const candidateSelectors = [
      '[data-testid*="output"]',
      '[data-testid*="result"]',
      '[class*="output"]',
      '[class*="result"]',
      '.prose',
      '[role="textbox"][aria-readonly="true"]',
    ];

    let bestText = '';
    for (const sel of candidateSelectors) {
      const nodes = Array.from(document.querySelectorAll(sel));
      for (const node of nodes) {
        if (node === inputEl || node.contains(inputEl) || inputEl.contains(node)) continue;
        if (!isVisible(node)) continue;
        const rect = node.getBoundingClientRect();
        // Prefer containers to the right or below input box, with reasonable area
        const isRightOrBelow = rect.left >= inputRect.left + 150 || rect.top >= inputRect.bottom - 20;
        if (!isRightOrBelow || rect.height < 60) continue;

        const clone = node.cloneNode(true);
        // Strip interactive buttons/icons from candidate read
        clone.querySelectorAll('button, svg, [role="button"]').forEach((n) => n.remove());
        const txt = (clone.innerText || clone.textContent || '').trim();
        if (txt.length > bestText.length) {
          bestText = txt;
        }
      }
    }
    return bestText;
  }

  function detectBlockerBanner() {
    const bodyText = (document.body?.innerText || '').toLowerCase();
    const captchaPatterns = [
      'verify you are human',
      'cf-turnstile',
      'complete the captcha',
    ];
    if (
      document.querySelector('iframe[src*="turnstile"], iframe[src*="recaptcha"], iframe[src*="hcaptcha"]') ||
      captchaPatterns.some((p) => bodyText.includes(p))
    ) {
      return 'CAPTCHA_REQUIRED';
    }

    const limitSignals = [
      'reached your word limit',
      'exceeded the word limit',
      'upgrade your plan to continue',
      'out of words',
      'insufficient words',
    ];
    if (limitSignals.some((p) => bodyText.includes(p))) {
      return 'WORD_LIMIT_REACHED';
    }
    return null;
  }

  async function executeHumanize(text, mode) {
    const runToken = ++activeRunToken;
    const inputEl = findInputElement();
    if (!inputEl) {
      return {
        ok: false,
        errorCode: 'INPUT_NOT_FOUND',
        error:
          'Không tìm thấy ô nhập văn bản trên tab hixbypass.com. Hãy đảm bảo bạn đang ở giao diện chính của HIX Bypass.',
      };
    }

    selectModeIfAvailable(mode);
    await sleep(120);

    const prevOutput = readOutputText(inputEl);
    setNativeTextValue(inputEl, text);
    await sleep(300);

    const humanizeBtn = findHumanizeButton();
    if (!humanizeBtn) {
      return {
        ok: false,
        errorCode: 'BUTTON_NOT_FOUND',
        error: 'Không tìm thấy nút Humanize trên trang hixbypass.com.',
      };
    }

    humanizeBtn.click();

    const deadline = Date.now() + 45000;
    let lastSeenOutput = '';
    let stableChecks = 0;

    while (Date.now() < deadline) {
      if (runToken !== activeRunToken) {
        return {
          ok: false,
          errorCode: 'CANCELLED',
          error: 'Đã tạm dừng thao tác trên tab HIX Bypass.',
        };
      }

      const blocker = detectBlockerBanner();
      if (blocker === 'CAPTCHA_REQUIRED') {
        return {
          ok: false,
          errorCode: 'CAPTCHA_REQUIRED',
          error:
            'HIX Bypass đang yêu cầu xác minh CAPTCHA. Vui lòng hoàn tất xác minh trên tab hixbypass.com rồi bấm Tiếp tục.',
        };
      }
      if (blocker === 'WORD_LIMIT_REACHED') {
        return {
          ok: false,
          errorCode: 'WORD_LIMIT_REACHED',
          error:
            'Tài khoản hixbypass.com báo hết lượt từ (Word limit). Vui lòng kiểm tra gói trên tab HIX Bypass.',
        };
      }

      const currentOutput = readOutputText(inputEl);
      const isDifferentFromPrev = currentOutput && currentOutput !== prevOutput;
      const isDifferentFromInput =
        currentOutput && currentOutput.trim().toLowerCase() !== text.trim().toLowerCase();

      if (isDifferentFromPrev && isDifferentFromInput) {
        if (currentOutput === lastSeenOutput) {
          stableChecks += 1;
        } else {
          lastSeenOutput = currentOutput;
          stableChecks = 0;
        }

        const btnDisabled = Boolean(humanizeBtn.disabled || humanizeBtn.getAttribute('aria-disabled') === 'true');
        if (stableChecks >= 3 && !btnDisabled) {
          return {
            ok: true,
            outputText: currentOutput,
          };
        }
      }

      await sleep(350);
    }

    if (lastSeenOutput) {
      return {
        ok: true,
        outputText: lastSeenOutput,
      };
    }

    return {
      ok: false,
      errorCode: 'TIMEOUT',
      error:
        'Quá thời gian chờ phản hồi từ HIX Bypass (45s). Hãy kiểm tra kết nối hoặc xác minh CAPTCHA trên tab hixbypass.com.',
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || !message.type) return false;

    if (message.type === 'ABORT_CURRENT') {
      activeRunToken += 1;
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === 'EXECUTE_HUMANIZE') {
      executeHumanize(String(message.text || ''), String(message.mode || 'Balanced'))
        .then((res) => sendResponse(res))
        .catch((err) =>
          sendResponse({
            ok: false,
            errorCode: 'CONTENT_EXEC_ERROR',
            error: err instanceof Error ? err.message : 'Lỗi thực thi trên tab hixbypass.com.',
          })
        );
      return true;
    }

    return false;
  });
})();
