(() => {
  // Always allow upgrading listener on dynamic re-inject
  if (window.__ASSIGNTRACK_HIX_CONTENT_VERSION__ === '1.1.0') return;
  window.__ASSIGNTRACK_HIX_CONTENT_VERSION__ = '1.1.0';
  window.__ASSIGNTRACK_HIX_CONTENT_LOADED__ = true;

  let activeRunToken = 0;
  let currentJob = null;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function normText(str) {
    return String(str || '')
      .normalize('NFC')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function stripDiacritics(str) {
    return String(str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase();
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 30 && rect.height > 20;
  }

  function setNativeTextValue(el, text) {
    el.focus();

    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      const proto =
        el.tagName === 'TEXTAREA'
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');

      // Clear first so React controlled inputs register a true value change even on retry
      if (descriptor && typeof descriptor.set === 'function') {
        descriptor.set.call(el, '');
      } else {
        el.value = '';
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));

      if (descriptor && typeof descriptor.set === 'function') {
        descriptor.set.call(el, text);
      } else {
        el.value = text;
      }

      try {
        el.dispatchEvent(
          new InputEvent('beforeinput', {
            bubbles: true,
            cancelable: true,
            data: text,
            inputType: 'insertFromPaste',
          })
        );
      } catch {
        // Ignore if browser rejects InputEvent constructor fields
      }

      el.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          data: text,
          inputType: 'insertText',
        })
      );
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ' }));
      return;
    }

    // contenteditable / TipTap / Lexical / ProseMirror editor support
    try {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      selection.removeAllRanges();
      selection.addRange(range);
      const inserted = document.execCommand('insertText', false, text);
      if (inserted && normText(el.innerText || el.textContent).length > 0) {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }
    } catch {
      // Fall through to manual DOM update
    }

    el.textContent = text;
    try {
      el.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          data: text,
          inputType: 'insertText',
        })
      );
    } catch {
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function findInputElement() {
    const textareas = Array.from(document.querySelectorAll('textarea')).filter(
      (ta) => isVisible(ta) && !ta.readOnly && !ta.disabled
    );
    if (textareas.length > 0) {
      // Pick the leftmost visible editable textarea
      textareas.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
      return textareas[0];
    }

    const editables = Array.from(
      document.querySelectorAll('[contenteditable="true"], [role="textbox"]')
    ).filter((el) => {
      if (!isVisible(el)) return false;
      if (el.getAttribute('aria-readonly') === 'true') return false;
      if (el.getAttribute('contenteditable') === 'false') return false;
      return true;
    });
    if (editables.length > 0) {
      editables.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
      return editables[0];
    }
    return null;
  }

  function isButtonDisabled(btn) {
    if (!btn) return true;
    if (btn.disabled) return true;
    if (btn.getAttribute('aria-disabled') === 'true') return true;
    const cls = String(btn.className || '').toLowerCase();
    if (cls.includes('cursor-not-allowed') && cls.includes('opacity-50')) return true;
    return false;
  }

  function triggerHumanClick(el) {
    if (!el) return;
    try {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    } catch {
      // Ignore
    }
    const rect = el.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;
    const eventOpts = { bubbles: true, cancelable: true, view: window, clientX, clientY };

    try {
      el.dispatchEvent(new PointerEvent('pointerdown', eventOpts));
    } catch {
      // Ignore
    }
    el.dispatchEvent(new MouseEvent('mousedown', eventOpts));
    try {
      el.dispatchEvent(new PointerEvent('pointerup', eventOpts));
    } catch {
      // Ignore
    }
    el.dispatchEvent(new MouseEvent('mouseup', eventOpts));
    el.click();
  }

  function findHumanizeButton() {
    const buttons = Array.from(document.querySelectorAll('button, [role="button"]')).filter((btn) =>
      isVisible(btn)
    );

    const exactLabels = new Set([
      'humanize',
      'humanize now',
      'humanize text',
      'humanize ai',
      'nhân hóa',
      'nhân hoá',
      'nhan hoa',
      'nhân hóa ngay',
      'nhân hóa văn bản',
      'nhân hoá văn bản',
      'bypass ai',
      'rewrite',
      'viết lại',
    ]);

    const exactMatch = buttons.find((btn) => {
      const txt = normText(btn.textContent);
      const ascii = stripDiacritics(txt);
      return exactLabels.has(txt) || exactLabels.has(ascii);
    });
    if (exactMatch) return exactMatch;

    // Fuzzy substring match excluding non-humanize actions
    const fuzzyMatch = buttons.find((btn) => {
      const txt = normText(btn.textContent);
      const ascii = stripDiacritics(txt);
      if (
        ascii.includes('detector') ||
        ascii.includes('check for ai') ||
        ascii.includes('kiem tra ai') ||
        ascii.includes('history') ||
        ascii.includes('lich su') ||
        ascii.includes('upgrade') ||
        ascii.includes('nang cap') ||
        ascii.includes('paste') ||
        ascii.includes('dan van ban') ||
        ascii.includes('sample') ||
        ascii.includes('try sample') ||
        ascii.includes('vi du') ||
        ascii.includes('copy') ||
        ascii.includes('sao chep')
      ) {
        return false;
      }
      return (
        ascii.includes('humanize') ||
        ascii.includes('nhan hoa') ||
        ascii.includes('bypass')
      );
    });
    if (fuzzyMatch) return fuzzyMatch;

    return null;
  }

  function selectModeIfAvailable(modeName) {
    if (!modeName) return;
    const normalized = modeName.trim().toLowerCase();
    const aliases = {
      fast: ['fast', 'nhanh'],
      balanced: ['balanced', 'cân bằng', 'can bang'],
      aggressive: ['aggressive', 'mạnh', 'manh', 'tối đa', 'toi da', 'chặt chẽ'],
    };
    const targets = aliases[normalized] || [normalized];

    const candidates = Array.from(
      document.querySelectorAll('button, [role="tab"], [role="radio"], label, [role="option"]')
    ).filter((el) => isVisible(el));

    const match = candidates.find((el) => {
      const txt = normText(el.textContent);
      const ascii = stripDiacritics(txt);
      return targets.some((t) => txt === t || ascii === stripDiacritics(t));
    });
    if (match) {
      triggerHumanClick(match);
    }
  }

  const PLACEHOLDER_OR_LOADING_SNIPPETS = [
    'output will appear',
    'your humanized text will appear',
    'result will appear',
    'ket qua se hien thi',
    'van ban da nhan hoa se hien thi',
    'humanizing...',
    'dang nhan hoa',
    'processing...',
    'dang xu ly',
    'checking ai',
    'dang kiem tra',
    'paste your text',
    'dan van ban cua ban',
    'enter your text',
    'nhap van ban cua ban',
  ];

  function isBoilerplateOrLoadingText(text) {
    const ascii = stripDiacritics(normText(text));
    if (!ascii || ascii.length < 15) return true;
    if (PLACEHOLDER_OR_LOADING_SNIPPETS.some((p) => ascii.includes(p))) return true;
    return false;
  }

  function cleanExtractedNodeText(node) {
    const clone = node.cloneNode(true);
    clone
      .querySelectorAll(
        'button, svg, [role="button"], input, textarea, [class*="badge"], [class*="counter"]'
      )
      .forEach((n) => n.remove());

    let raw = (clone.innerText || clone.textContent || '').trim();
    // Remove common trailing UI lines like "120 words", "120 từ", "Copy", "Sao chép", "100% Human"
    raw = raw
      .replace(/\b\d+\s*(?:words?|chars?|characters?|từ|ký tự)\b/gi, '')
      .replace(/\b\d{1,3}%\s*(?:human|ai|con người|tự nhiên)\b/gi, '')
      .replace(/^(?:output|kết quả|humanized|đã nhân hóa)\s*:?\s*/i, '')
      .trim();
    return raw;
  }

  function readOutputText(inputEl) {
    const inputRect = inputEl.getBoundingClientRect();

    // Strategy 1: Second visible textarea or readonly textbox/contenteditable (not inputEl)
    const textareas = Array.from(document.querySelectorAll('textarea')).filter((ta) => isVisible(ta));
    const otherTextarea = textareas.find((ta) => ta !== inputEl);
    if (otherTextarea) {
      const val = (otherTextarea.value || '').trim();
      if (val && !isBoilerplateOrLoadingText(val)) {
        return val;
      }
    }

    const otherEditors = Array.from(
      document.querySelectorAll('[role="textbox"], [contenteditable]')
    ).filter((el) => {
      if (el === inputEl || el.contains(inputEl) || inputEl.contains(el)) return false;
      return isVisible(el);
    });
    for (const ed of otherEditors) {
      const txt = cleanExtractedNodeText(ed);
      if (txt && !isBoilerplateOrLoadingText(txt)) {
        return txt;
      }
    }

    // Strategy 2: Output panel anchored to a visible "Copy" / "Sao chép" button on the right/bottom side
    const copyButtons = Array.from(
      document.querySelectorAll('button, [role="button"]')
    ).filter((btn) => {
      if (!isVisible(btn)) return false;
      const txt = stripDiacritics(normText(btn.textContent));
      const aria = stripDiacritics(
        normText(btn.getAttribute('aria-label') || btn.getAttribute('title') || '')
      );
      return (
        txt === 'copy' ||
        txt === 'sao chep' ||
        txt.includes('copy text') ||
        aria.includes('copy') ||
        aria.includes('sao chep')
      );
    });

    for (const copyBtn of copyButtons) {
      let ancestor = copyBtn.parentElement;
      for (let depth = 0; depth < 5 && ancestor && ancestor !== document.body; depth += 1) {
        if (ancestor.contains(inputEl)) break;
        const rect = ancestor.getBoundingClientRect();
        if (rect.width >= 180 && rect.height >= 90) {
          const txt = cleanExtractedNodeText(ancestor);
          if (txt && txt.length >= 20 && !isBoilerplateOrLoadingText(txt)) {
            return txt;
          }
        }
        ancestor = ancestor.parentElement;
      }
    }

    // Strategy 3: Semantic class/data-testid selectors OR right/below pane containers
    const candidateSelectors = [
      '[data-testid*="output"]',
      '[data-testid*="result"]',
      '[class*="output"]',
      '[class*="result"]',
      '.prose',
      '.ProseMirror',
    ];

    let bestText = '';
    for (const sel of candidateSelectors) {
      const nodes = Array.from(document.querySelectorAll(sel));
      for (const node of nodes) {
        if (node === inputEl || node.contains(inputEl) || inputEl.contains(node)) continue;
        if (!isVisible(node)) continue;
        const rect = node.getBoundingClientRect();
        const isRightOrBelow =
          rect.left >= inputRect.left + 80 || rect.top >= inputRect.bottom - 20;
        if (!isRightOrBelow || rect.height < 60) continue;

        const txt = cleanExtractedNodeText(node);
        if (!isBoilerplateOrLoadingText(txt) && txt.length > bestText.length) {
          bestText = txt;
        }
      }
    }
    if (bestText) return bestText;

    // Strategy 4: Fallback scan for Tailwind right-hand / bottom output div with multi-word prose
    const allDivs = Array.from(document.querySelectorAll('div, section, article, p'));
    for (const node of allDivs) {
      if (node === inputEl || node.contains(inputEl) || inputEl.contains(node)) continue;
      if (node.closest('header, nav, footer, aside')) continue;
      if (!isVisible(node)) continue;
      const rect = node.getBoundingClientRect();
      const isRightSide = rect.left >= inputRect.left + inputRect.width * 0.6;
      const isBelow = rect.top >= inputRect.bottom + 10;
      if ((!isRightSide && !isBelow) || rect.width < 180 || rect.height < 60 || rect.height > 900) {
        continue;
      }
      // Prefer innermost text wrapper containing paragraphs or direct text
      if (node.querySelectorAll('div').length > 4) continue;
      const txt = cleanExtractedNodeText(node);
      if (
        txt.length >= 25 &&
        txt.split(/\s+/).length >= 4 &&
        !isBoilerplateOrLoadingText(txt) &&
        txt.length > bestText.length
      ) {
        bestText = txt;
      }
    }

    return bestText;
  }

  function detectBlockerBanner() {
    const bodyText = stripDiacritics(normText(document.body?.innerText || ''));
    const captchaPatterns = [
      'verify you are human',
      'cf-turnstile',
      'complete the captcha',
      'xac minh ban la con nguoi',
    ];
    if (
      document.querySelector(
        'iframe[src*="turnstile"], iframe[src*="recaptcha"], iframe[src*="hcaptcha"]'
      ) ||
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
      'het luot tu',
      'vuot qua gioi han tu',
    ];
    if (limitSignals.some((p) => bodyText.includes(p))) {
      return 'WORD_LIMIT_REACHED';
    }
    return null;
  }

  async function runHumanizeJob(jobId, text, mode) {
    const runToken = ++activeRunToken;
    const setJob = (patch) => {
      if (currentJob && currentJob.jobId === jobId) {
        currentJob = { ...currentJob, ...patch };
      }
    };

    const inputEl = findInputElement();
    if (!inputEl) {
      setJob({
        status: 'error',
        ok: false,
        errorCode: 'INPUT_NOT_FOUND',
        error:
          'Không tìm thấy ô nhập văn bản trên tab hixbypass.com. Hãy đảm bảo bạn đang mở trang công cụ chính của HIX Bypass.',
      });
      return;
    }

    setJob({ step: 'Đang chọn chế độ & dán văn bản sang HIX Bypass...' });
    selectModeIfAvailable(mode);
    await sleep(120);

    if (runToken !== activeRunToken) {
      setJob({ status: 'error', ok: false, errorCode: 'CANCELLED', error: 'Đã tạm dừng.' });
      return;
    }

    const prevOutput = readOutputText(inputEl);
    setNativeTextValue(inputEl, text);
    await sleep(350);

    const humanizeBtn = findHumanizeButton();
    if (!humanizeBtn) {
      setJob({
        status: 'error',
        ok: false,
        errorCode: 'BUTTON_NOT_FOUND',
        error:
          'Đã dán văn bản nhưng không tìm thấy nút "Humanize" hoặc "Nhân hóa" trên tab hixbypass.com.',
      });
      return;
    }

    // Wait briefly if React still has button disabled after pasting
    let enableWait = 0;
    while (isButtonDisabled(humanizeBtn) && enableWait < 2400) {
      if (runToken !== activeRunToken) {
        setJob({ status: 'error', ok: false, errorCode: 'CANCELLED', error: 'Đã tạm dừng.' });
        return;
      }
      await sleep(150);
      enableWait += 150;
    }

    setJob({ step: 'Đang bấm nút Humanize / Nhân hóa trên HIX Bypass...' });
    triggerHumanClick(humanizeBtn);

    const deadline = Date.now() + 55000;
    let lastSeenOutput = '';
    let stableChecks = 0;

    setJob({ step: 'Đang chờ HIX Bypass tạo văn bản mới...' });

    while (Date.now() < deadline) {
      if (runToken !== activeRunToken) {
        setJob({
          status: 'error',
          ok: false,
          errorCode: 'CANCELLED',
          error: 'Đã tạm dừng thao tác trên tab HIX Bypass.',
        });
        return;
      }

      const blocker = detectBlockerBanner();
      if (blocker === 'CAPTCHA_REQUIRED') {
        setJob({
          status: 'error',
          ok: false,
          errorCode: 'CAPTCHA_REQUIRED',
          error:
            'HIX Bypass đang yêu cầu xác minh CAPTCHA. Vui lòng hoàn tất xác minh trên tab hixbypass.com rồi bấm Tiếp tục.',
        });
        return;
      }
      if (blocker === 'WORD_LIMIT_REACHED') {
        setJob({
          status: 'error',
          ok: false,
          errorCode: 'WORD_LIMIT_REACHED',
          error:
            'Tài khoản hixbypass.com báo hết lượt từ (Word limit). Vui lòng kiểm tra gói hoặc đăng nhập tài khoản khác.',
        });
        return;
      }

      const currentOutput = readOutputText(inputEl);
      const isDifferentFromPrev = currentOutput && currentOutput !== prevOutput;
      const isDifferentFromInput =
        currentOutput && normText(currentOutput) !== normText(text);

      if (isDifferentFromPrev && isDifferentFromInput) {
        if (currentOutput === lastSeenOutput) {
          stableChecks += 1;
        } else {
          lastSeenOutput = currentOutput;
          stableChecks = 0;
          setJob({ step: 'Đang nhận kết quả từ HIX Bypass...' });
        }

        const latestBtn = findHumanizeButton() || humanizeBtn;
        if (stableChecks >= 2 && !isButtonDisabled(latestBtn)) {
          setJob({
            status: 'done',
            ok: true,
            step: 'Đã lấy kết quả xong, chuẩn bị dán đè...',
            outputText: currentOutput,
          });
          return;
        }
      }

      await sleep(350);
    }

    if (lastSeenOutput) {
      setJob({
        status: 'done',
        ok: true,
        step: 'Đã lấy kết quả xong, chuẩn bị dán đè...',
        outputText: lastSeenOutput,
      });
      return;
    }

    setJob({
      status: 'error',
      ok: false,
      errorCode: 'TIMEOUT',
      error:
        'Đã dán & bấm Nhân hóa nhưng quá 55s chưa thấy kết quả trên tab hixbypass.com. Hãy kiểm tra xem tab HIX có đang hiện kết quả hoặc CAPTCHA không.',
    });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || !message.type) return false;

    if (message.type === 'ABORT_CURRENT') {
      activeRunToken += 1;
      if (currentJob && currentJob.status === 'running') {
        currentJob = {
          ...currentJob,
          status: 'error',
          ok: false,
          errorCode: 'CANCELLED',
          error: 'Đã tạm dừng thao tác.',
        };
      }
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === 'START_HUMANIZE') {
      const jobId = String(message.jobId || `job_${Date.now()}`);
      currentJob = {
        jobId,
        status: 'running',
        step: 'Đang kết nối tab HIX Bypass...',
        ok: true,
      };
      void runHumanizeJob(jobId, String(message.text || ''), String(message.mode || 'Balanced'));
      sendResponse({ ok: true, jobId });
      return false;
    }

    if (message.type === 'POLL_HUMANIZE') {
      if (!currentJob || (message.jobId && currentJob.jobId !== message.jobId)) {
        sendResponse({
          ok: false,
          status: 'error',
          errorCode: 'JOB_NOT_FOUND',
          error: 'Không tìm thấy tác vụ đang chạy trên tab HIX Bypass.',
        });
        return false;
      }
      sendResponse(currentJob);
      return false;
    }

    // Legacy direct sync support
    if (message.type === 'EXECUTE_HUMANIZE') {
      const jobId = String(message.jobId || `job_${Date.now()}`);
      currentJob = {
        jobId,
        status: 'running',
        step: 'Đang thực thi...',
        ok: true,
      };
      runHumanizeJob(jobId, String(message.text || ''), String(message.mode || 'Balanced'))
        .then(() => sendResponse(currentJob))
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
