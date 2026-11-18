(() => {
  // Always allow upgrading listener on dynamic re-inject
  if (window.__ASSIGNTRACK_HIX_CONTENT_VERSION__ === '1.1.3') return;
  window.__ASSIGNTRACK_HIX_CONTENT_VERSION__ = '1.1.3';
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

  function isVisible(el, minW = 24, minH = 16) {
    if (!el || !el.isConnected) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width >= minW && rect.height >= minH;
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
        // Ignore
      }

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
      el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ' }));
      return;
    }

    // contenteditable / TipTap / Lexical / ProseMirror support
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
      // Fall through
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
      (ta) => isVisible(ta, 60, 40) && !ta.readOnly && !ta.disabled
    );
    if (textareas.length > 0) {
      textareas.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
      return textareas[0];
    }

    const editables = Array.from(
      document.querySelectorAll('[contenteditable="true"], [role="textbox"]')
    ).filter((el) => {
      if (!isVisible(el, 60, 40)) return false;
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
      isVisible(btn, 36, 20)
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

    return (
      buttons.find((btn) => {
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
      }) || null
    );
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
    ).filter((el) => isVisible(el, 24, 16));

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

  const UI_CHROME_LINE_RES = [
    /^\d+\s*(?:words?|chars?|characters?|từ|ký tự|tu|ky tu)\b/i,
    /^(?:\d+\s*\/\s*\d+)$/,
    /^(?:output|result|kết quả|ket qua|humanized|đã nhân hóa|da nhan hoa|ai detector|kiểm tra ai|bypassed|copy|sao chép|sao chep|copied|đã sao chép|share|export|download|re-humanize|nhân hóa lại|clear|xóa)$/i,
    /^\d{1,3}%\s*(?:human|ai|con người|tự nhiên|human-written)/i,
    /^(?:the output seems to be|your text appears|your humanized text|all ai detectors|passed|tất cả các trình|văn bản có vẻ|đầu ra có vẻ|vượt qua)/i,
  ];

  function isBoilerplateOrLoadingText(text) {
    const ascii = stripDiacritics(normText(text));
    if (!ascii || ascii.length < 10) return true;
    return PLACEHOLDER_OR_LOADING_SNIPPETS.some((p) => ascii.includes(p));
  }

  function cleanExtractedNodeText(node) {
    if (!node) return '';
    const clone = node.cloneNode(true);
    clone
      .querySelectorAll(
        'button, svg, [role="button"], input, textarea, select, header, footer, nav, [class*="badge"], [class*="counter"]'
      )
      .forEach((n) => n.remove());

    // If the node contains <p> prose blocks inside, prefer joining meaningful <p> tags directly
    const pElements = Array.from(clone.querySelectorAll('p'));
    if (pElements.length > 0) {
      const pLines = pElements
        .map((p) => (p.textContent || '').replace(/\s+/g, ' ').trim())
        .filter((line) => {
          if (!line) return false;
          const ascii = stripDiacritics(line);
          if (UI_CHROME_LINE_RES.some((re) => re.test(line) || re.test(ascii))) return false;
          if (PLACEHOLDER_OR_LOADING_SNIPPETS.some((s) => ascii.includes(s))) return false;
          return true;
        });
      const joinedP = pLines.join(' ').trim();
      if (joinedP.length >= 12) {
        return joinedP;
      }
    }

    const raw = (clone.innerText || clone.textContent || '').trim();
    if (!raw) return '';

    const cleanLines = raw
      .split(/\r?\n+/)
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter((line) => {
        if (!line) return false;
        const ascii = stripDiacritics(line);
        if (UI_CHROME_LINE_RES.some((re) => re.test(line) || re.test(ascii))) return false;
        if (PLACEHOLDER_OR_LOADING_SNIPPETS.some((s) => ascii.includes(s))) return false;
        return true;
      });

    return cleanLines.join(' ').trim();
  }

  function findTwinOutputPanels(inputEl) {
    const panels = [];
    let current = inputEl.parentElement;

    for (let depth = 0; depth < 7 && current && current !== document.body; depth += 1) {
      const parent = current.parentElement;
      if (!parent) break;

      const curRect = current.getBoundingClientRect();
      const siblings = Array.from(parent.children);
      for (const sib of siblings) {
        if (sib === current || sib.contains(inputEl) || inputEl.contains(sib)) continue;
        if (!isVisible(sib, 160, 80)) continue;
        if (sib.tagName === 'HEADER' || sib.tagName === 'NAV' || sib.tagName === 'ASIDE') continue;

        const sibRect = sib.getBoundingClientRect();
        const isRight = sibRect.left >= curRect.left + curRect.width * 0.45;
        const isBelow = sibRect.top >= curRect.bottom - 15 && Math.abs(sibRect.left - curRect.left) < 120;
        if (isRight || isBelow) {
          panels.push(sib);
        }
      }

      current = parent;
    }

    return panels;
  }

  function readOutputText(inputEl) {
    const inputRect = inputEl.getBoundingClientRect();
    const inputNorm = normText(inputEl.value !== undefined ? inputEl.value : inputEl.innerText);

    // Strategy 1: Second visible textarea or readonly textbox/contenteditable (not inputEl)
    const textareas = Array.from(document.querySelectorAll('textarea')).filter((ta) =>
      isVisible(ta, 60, 40)
    );
    const otherTextarea = textareas.find((ta) => ta !== inputEl);
    if (otherTextarea) {
      const val = (otherTextarea.value || '').trim();
      if (val && normText(val) !== inputNorm && !isBoilerplateOrLoadingText(val)) {
        return val;
      }
    }

    const otherEditors = Array.from(
      document.querySelectorAll('[role="textbox"], [contenteditable]')
    ).filter((el) => {
      if (el === inputEl || el.contains(inputEl) || inputEl.contains(el)) return false;
      return isVisible(el, 60, 40);
    });
    for (const ed of otherEditors) {
      const txt = cleanExtractedNodeText(ed);
      if (txt && normText(txt) !== inputNorm && !isBoilerplateOrLoadingText(txt)) {
        return txt;
      }
    }

    // Strategy 2: Structural Twin-Column Output Panel (the right/bottom card beside inputEl's card)
    const twinPanels = findTwinOutputPanels(inputEl);
    for (const panel of twinPanels) {
      // Check inner scrollable/prose/output elements inside the twin panel first
      const innerCandidates = Array.from(
        panel.querySelectorAll(
          '[data-testid*="output"], [data-testid*="result"], [class*="output"], [class*="result"], .prose, .ProseMirror, [class*="overflow-y"]'
        )
      ).filter((n) => isVisible(n, 120, 40));

      for (const inner of innerCandidates) {
        const txt = cleanExtractedNodeText(inner);
        if (txt && normText(txt) !== inputNorm && !isBoilerplateOrLoadingText(txt)) {
          return txt;
        }
      }

      // Extract directly from the entire twin Output Card
      const panelText = cleanExtractedNodeText(panel);
      if (panelText && normText(panelText) !== inputNorm && !isBoilerplateOrLoadingText(panelText)) {
        return panelText;
      }
    }

    // Strategy 3: Output panel anchored to a Copy / Sao chep button (including small SVG icon buttons)
    const copyButtons = Array.from(
      document.querySelectorAll('button, [role="button"]')
    ).filter((btn) => {
      if (!isVisible(btn, 14, 14)) return false;
      const txt = stripDiacritics(normText(btn.textContent));
      const aria = stripDiacritics(
        normText(
          `${btn.getAttribute('aria-label') || ''} ${btn.getAttribute('title') || ''} ${
            btn.getAttribute('data-testid') || ''
          }`
        )
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
      for (let depth = 0; depth < 6 && ancestor && ancestor !== document.body; depth += 1) {
        if (ancestor.contains(inputEl)) break;
        const rect = ancestor.getBoundingClientRect();
        if (rect.width >= 160 && rect.height >= 70) {
          const txt = cleanExtractedNodeText(ancestor);
          if (
            txt &&
            txt.length >= 12 &&
            normText(txt) !== inputNorm &&
            !isBoilerplateOrLoadingText(txt)
          ) {
            return txt;
          }
        }
        ancestor = ancestor.parentElement;
      }
    }

    // Strategy 4: Global right/below prose or semantic output selector scan
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
        if (!isVisible(node, 120, 50)) continue;
        const rect = node.getBoundingClientRect();
        const isRightOrBelow =
          rect.left >= inputRect.left + 60 || rect.top >= inputRect.bottom - 20;
        if (!isRightOrBelow) continue;

        const txt = cleanExtractedNodeText(node);
        if (
          txt &&
          normText(txt) !== inputNorm &&
          !isBoilerplateOrLoadingText(txt) &&
          txt.length > bestText.length
        ) {
          bestText = txt;
        }
      }
    }

    return bestText;
  }

  function detectBlockerBanner(elapsedMs) {
    // Inspect only visible modals, dialogs, alerts, and toast notifications
    // (never static header/footer/pricing text or invisible reCAPTCHA v3 badges)
    const overlayNodes = Array.from(
      document.querySelectorAll(
        '[role="dialog"], [aria-modal="true"], [role="alertdialog"], [role="alert"], [class*="modal"], [class*="toast"]'
      )
    ).filter((el) => isVisible(el, 150, 45));

    const overlayText = stripDiacritics(
      normText(overlayNodes.map((n) => n.innerText || n.textContent || '').join(' '))
    );

    const limitSignals = [
      'reached your word limit',
      'exceeded the word limit',
      'upgrade your plan to continue',
      'out of words',
      'insufficient words',
      'het luot tu',
      'vuot qua gioi han tu',
    ];
    if (limitSignals.some((p) => overlayText.includes(p))) {
      return 'WORD_LIMIT_REACHED';
    }

    const minWordsSignals = [
      'at least 50 words',
      'minimum 50 words',
      'minimum of 50 words',
      'toi thieu 50 tu',
      'it nhat 50 tu',
    ];
    if (minWordsSignals.some((p) => overlayText.includes(p))) {
      return 'MIN_WORDS_REQUIRED';
    }

    // Give automatic invisible Turnstile / reCAPTCHA checks 10 seconds to pass on their own
    if (elapsedMs < 10000) {
      return null;
    }

    const captchaPatterns = [
      'verify you are human',
      'complete the captcha',
      'xac minh ban la con nguoi',
      'hoan tat xac minh',
    ];

    const blockingIframe = Array.from(
      document.querySelectorAll(
        'iframe[src*="turnstile"], iframe[src*="recaptcha"], iframe[src*="hcaptcha"]'
      )
    ).find((iframe) => {
      if (iframe.closest('.grecaptcha-badge')) return false;
      if (!isVisible(iframe, 200, 50)) return false;
      const rect = iframe.getBoundingClientRect();
      // Ignore corner badges pinned near bottom-right
      const isBottomRightCorner =
        rect.right > window.innerWidth - 40 && rect.bottom > window.innerHeight - 140;
      return !isBottomRightCorner;
    });

    const hasModalCaptchaText = captchaPatterns.some((p) => overlayText.includes(p));
    if (blockingIframe || hasModalCaptchaText) {
      return 'CAPTCHA_REQUIRED';
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

    const startedWaitAt = Date.now();
    const deadline = startedWaitAt + 55000;
    let lastSeenOutput = '';
    let stableChecks = 0;
    const normInputText = normText(text);
    const normPrevOutput = normText(prevOutput);

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

      const blocker = detectBlockerBanner(Date.now() - startedWaitAt);
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
      if (blocker === 'MIN_WORDS_REQUIRED') {
        setJob({
          status: 'error',
          ok: false,
          errorCode: 'MIN_WORDS_REQUIRED',
          error:
            'HIX Bypass yêu cầu tối thiểu 50 từ cho mỗi lượt. Hãy tăng giới hạn từ/lượt lên (~250 từ/lượt) hoặc gộp thêm câu trong đoạn.',
        });
        return;
      }

      const currentOutput = readOutputText(inputEl);
      const normCurrent = normText(currentOutput);
      const isDifferentFromPrev = Boolean(currentOutput) && normCurrent !== normPrevOutput;
      const isDifferentFromInput = Boolean(currentOutput) && normCurrent !== normInputText;

      if (isDifferentFromPrev && isDifferentFromInput) {
        if (currentOutput === lastSeenOutput) {
          stableChecks += 1;
        } else {
          lastSeenOutput = currentOutput;
          stableChecks = 0;
          setJob({ step: 'Đang nhận kết quả từ HIX Bypass...' });
        }

        // Complete once output stabilizes cleanly (~1.1s unchanged),
        // without blocking if HIX keeps the Humanize button disabled after run
        if (stableChecks >= 3) {
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
        'HIX Bypass đã xử lý nhưng Extension chưa đọc được ô kết quả bên phải. Hãy đảm bảo 2 ô Nhập/Kết quả đều đang hiển thị trên tab hixbypass.com.',
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
