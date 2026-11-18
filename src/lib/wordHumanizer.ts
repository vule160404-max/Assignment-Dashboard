import JSZip from 'jszip';

export interface WordParagraph {
  index: number;
  text: string;
  isHeading: boolean;
  isEmpty: boolean;
}

export interface ParsedWordDocument {
  fileName: string;
  rawBuffer: ArrayBuffer;
  paragraphs: WordParagraph[];
}

export interface HumanizeChunk {
  id: string;
  paragraphIndex: number;
  chunkOrder: number;
  text: string;
  wordCount: number;
  /** Exact character slice inside paragraph.text before modification */
  startOffset: number;
  endOffset: number;
}

export interface GlitchCheckResult {
  hasGlitch: boolean;
  reasons: string[];
  suspectTokens: string[];
}

export interface DiffPart {
  type: 'equal' | 'removed' | 'added';
  value: string;
}

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

// Academic abbreviations whose trailing periods do NOT end a sentence
const PROTECTED_ABBR_PATTERNS: RegExp[] = [
  /\b(e\.g|i\.e|et al|etc|vs|cf|approx|est|incl|ca|viz)\./gi,
  /\b(Dr|Prof|Mr|Mrs|Ms|Sr|Jr|St|Rev|Hon|Pres|Gen|Col|Capt)\./g,
  /\b(Fig|Figs|Eq|Eqs|Tab|Tabs|Vol|No|Nos|pp|p|Ch|Sec|App|Art|Ref|Refs|Inc|Ltd|Corp|Co)\./gi,
  /\b(U\.S|U\.K|U\.N|E\.U|Ph\.D|M\.A|B\.A|M\.Sc|B\.Sc)\./g,
  /\b[A-Z]\./g,
];

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Parse an uploaded .docx Word file using JSZip + XML DOMParser.
 */
export async function parseDocxFile(file: File): Promise<ParsedWordDocument> {
  const rawBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(rawBuffer);
  const docEntry = zip.file('word/document.xml');
  if (!docEntry) {
    throw new Error('Tệp .docx không hợp lệ (thiếu word/document.xml).');
  }

  const xmlText = await docEntry.async('string');
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
  const parseErr = xmlDoc.querySelector('parsererror');
  if (parseErr) {
    throw new Error('Không thể đọc cấu trúc XML của file Word này.');
  }

  const body =
    xmlDoc.getElementsByTagNameNS(WORD_NS, 'body')[0] ||
    xmlDoc.getElementsByTagName('w:body')[0];
  if (!body) {
    throw new Error('Không tìm thấy phần thân văn bản trong file Word.');
  }

  const pNodes = Array.from(xmlDoc.getElementsByTagNameNS(WORD_NS, 'p'));
  const paragraphs: WordParagraph[] = pNodes.map((pNode, index) => {
    const pStyleNode = pNode.getElementsByTagNameNS(WORD_NS, 'pStyle')[0];
    const styleVal = (pStyleNode?.getAttribute('w:val') || pStyleNode?.getAttribute('val') || '').toLowerCase();

    const tNodes = Array.from(pNode.getElementsByTagNameNS(WORD_NS, 't'));
    const rawText = tNodes.map((t) => t.textContent || '').join('');
    const normalized = rawText.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();

    const looksLikeHeadingStyle =
      styleVal.includes('heading') || styleVal.includes('title') || styleVal.includes('subtitle');
    const looksLikeShortTitle =
      normalized.length > 0 &&
      normalized.length <= 95 &&
      !normalized.endsWith('.') &&
      !normalized.endsWith('."') &&
      !normalized.endsWith('.)') &&
      !normalized.endsWith('.”') &&
      countWords(normalized) <= 14;

    return {
      index,
      text: normalized,
      isHeading: Boolean(normalized) && (looksLikeHeadingStyle || looksLikeShortTitle),
      isEmpty: normalized.length === 0,
    };
  });

  return {
    fileName: file.name,
    rawBuffer,
    paragraphs,
  };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Create a clean minimal .docx document from plain text paragraphs if the user pastes text directly.
 */
export async function createWordDocumentFromText(
  title: string,
  rawText: string
): Promise<ParsedWordDocument> {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const paragraphsXml = lines
    .map(
      (line) =>
        `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`
    )
    .join('');

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphsXml}
    <w:sectPr/>
  </w:body>
</w:document>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const zip = new JSZip();
  zip.file('[Content_Types].xml', contentTypesXml);
  zip.file('_rels/.rels', relsXml);
  zip.file('word/document.xml', documentXml);

  const rawBuffer = await zip.generateAsync({ type: 'arraybuffer' });
  const paragraphs: WordParagraph[] = lines.map((line, index) => ({
    index,
    text: line,
    isHeading:
      line.length <= 95 &&
      !line.endsWith('.') &&
      !line.endsWith('."') &&
      !line.endsWith('.)') &&
      countWords(line) <= 14,
    isEmpty: false,
  }));

  const safeTitle = title.trim().replace(/[^a-zA-Z0-9_-]+/g, '_') || 'assignment';
  return {
    fileName: safeTitle.endsWith('.docx') ? safeTitle : `${safeTitle}.docx`,
    rawBuffer,
    paragraphs,
  };
}

/**
 * Patch modified paragraphs directly back into the original .docx word/document.xml
 * preserving paragraph styles (<w:pPr>) and primary run formatting (<w:rPr>).
 */
export async function exportPatchedDocx(
  docData: ParsedWordDocument,
  updatedParagraphs: Record<number, string>
): Promise<Blob> {
  const zip = await JSZip.loadAsync(docData.rawBuffer);
  const docEntry = zip.file('word/document.xml');
  if (!docEntry) {
    throw new Error('Không tìm thấy word/document.xml để xuất file Word.');
  }

  const xmlText = await docEntry.async('string');
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
  const pNodes = Array.from(xmlDoc.getElementsByTagNameNS(WORD_NS, 'p'));

  for (const [idxStr, nextText] of Object.entries(updatedParagraphs)) {
    const idx = Number(idxStr);
    const pNode = pNodes[idx];
    if (!pNode) continue;

    // Preserve paragraph properties (<w:pPr>) and first run's <w:rPr>
    const firstRun = pNode.getElementsByTagNameNS(WORD_NS, 'r')[0] || null;
    const firstRPr = firstRun
      ? firstRun.getElementsByTagNameNS(WORD_NS, 'rPr')[0]?.cloneNode(true) || null
      : null;

    // Remove existing runs / hyperlinks / text containers while keeping <w:pPr>
    const childrenToRemove: Node[] = [];
    for (let i = 0; i < pNode.childNodes.length; i++) {
      const child = pNode.childNodes[i];
      if (child.nodeType === 1) {
        const el = child as Element;
        if (el.localName !== 'pPr') {
          childrenToRemove.push(child);
        }
      }
    }
    childrenToRemove.forEach((child) => pNode.removeChild(child));

    const newRun = xmlDoc.createElementNS(WORD_NS, 'w:r');
    if (firstRPr) {
      newRun.appendChild(firstRPr);
    }
    const newT = xmlDoc.createElementNS(WORD_NS, 'w:t');
    newT.setAttribute('xml:space', 'preserve');
    newT.textContent = nextText;
    newRun.appendChild(newT);
    pNode.appendChild(newRun);
  }

  const serializer = new XMLSerializer();
  const updatedXml = serializer.serializeToString(xmlDoc);
  zip.file('word/document.xml', updatedXml);

  return zip.generateAsync({
    type: 'blob',
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

interface SentenceSpan {
  text: string;
  startOffset: number;
  endOffset: number;
  endsWithPeriod: boolean;
}

/**
 * STRICT TERMINAL-PERIOD SENTENCE SPLITTER:
 * Never splits mid-sentence, never breaks decimals (3.14) or academic abbreviations (e.g., et al., Dr.),
 * and only marks a sentence complete when it terminates cleanly with a period (`.`, `."`, `.)`, `.”`).
 */
export function splitParagraphIntoTerminalPeriodSentences(paragraphText: string): SentenceSpan[] {
  const text = paragraphText;
  if (!text.trim()) return [];

  // Mask periods that should NOT split sentences using same-length placeholder `\uE000`
  const chars = text.split('');
  const maskPeriodAt = (idx: number) => {
    if (chars[idx] === '.') {
      chars[idx] = '\uE000';
    }
  };

  // 1. Protect ellipses (...)
  for (let i = 0; i < text.length - 1; i++) {
    if (text[i] === '.' && text[i + 1] === '.') {
      maskPeriodAt(i);
      maskPeriodAt(i + 1);
    }
  }

  // 2. Protect decimal numbers / versions (e.g. 3.14, 0.05, v2.1)
  for (let i = 1; i < text.length - 1; i++) {
    if (text[i] === '.' && /\d/.test(text[i - 1]) && /\d/.test(text[i + 1])) {
      maskPeriodAt(i);
    }
  }

  // 3. Protect URLs / domains (e.g. hixbypass.com)
  const urlRe = /\b[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?\b/g;
  let match: RegExpExecArray | null;
  while ((match = urlRe.exec(text)) !== null) {
    for (let k = match.index; k < match.index + match[0].length; k++) {
      if (text[k] === '.') maskPeriodAt(k);
    }
  }

  // 4. Protect academic abbreviations
  for (const abbrRe of PROTECTED_ABBR_PATTERNS) {
    abbrRe.lastIndex = 0;
    while ((match = abbrRe.exec(text)) !== null) {
      for (let k = match.index; k < match.index + match[0].length; k++) {
        if (text[k] === '.') maskPeriodAt(k);
      }
    }
  }

  const masked = chars.join('');
  const sentences: SentenceSpan[] = [];
  // Sentence terminates ONLY at a real period `.` (optionally followed by closing quote/paren/bracket)
  // followed by whitespace + sentence start or end-of-paragraph.
  // Masked periods (\uE000 from abbreviations/decimals/URLs) remain inside the sentence span.
  const boundaryRe = /([\s\S]*?\.(?:["'”’)\]]*))(?=\s+|$)/g;

  let cursor = 0;
  while ((match = boundaryRe.exec(masked)) !== null) {
    const rawSegmentMasked = match[1];
    const startOffset = match.index;
    const endOffset = startOffset + rawSegmentMasked.length;
    const originalSlice = text.slice(startOffset, endOffset).trim();

    // Trim leading spaces offset accurately
    const leadingSpaces = text.slice(startOffset, endOffset).search(/\S/);
    const cleanStart = leadingSpaces >= 0 ? startOffset + leadingSpaces : startOffset;

    if (originalSlice.length > 0) {
      sentences.push({
        text: originalSlice,
        startOffset: cleanStart,
        endOffset,
        endsWithPeriod: /\.(?:["'”’)\]]*)$/.test(originalSlice),
      });
    }
    cursor = endOffset;
  }

  // Any trailing text that does NOT end with a period `.` stays untouched and is NEVER sent to HIX Bypass
  if (cursor < text.length) {
    const tail = text.slice(cursor).trim();
    if (tail.length > 0) {
      const leadingSpaces = text.slice(cursor).search(/\S/);
      const cleanStart = leadingSpaces >= 0 ? cursor + leadingSpaces : cursor;
      sentences.push({
        text: tail,
        startOffset: cleanStart,
        endOffset: text.length,
        endsWithPeriod: false,
      });
    }
  }

  return sentences;
}

export const MIN_HIX_CHUNK_WORDS = 50;

/**
 * Group complete terminal-period sentences into chunks between `minWordsPerChunk` (50) and `maxWordsPerChunk`.
 * NEVER splits a sentence mid-way, NEVER includes sentences without a terminal period `.`,
 * and rebalances trailing sentences so HIX Bypass's 50-word minimum requirement is respected.
 */
export function buildSentenceBoundaryChunks(
  paragraphs: WordParagraph[],
  maxWordsPerChunk: number,
  minWordsPerChunk: number = MIN_HIX_CHUNK_WORDS
): HumanizeChunk[] {
  const effectiveMax = Math.max(minWordsPerChunk, maxWordsPerChunk);
  const chunks: HumanizeChunk[] = [];
  let globalOrder = 0;

  for (const para of paragraphs) {
    if (para.isEmpty || para.isHeading) continue;

    const sentences = splitParagraphIntoTerminalPeriodSentences(para.text).filter(
      (s) => s.endsWithPeriod && countWords(s.text) >= 3
    );
    if (sentences.length === 0) continue;

    const rawGroups: SentenceSpan[][] = [];
    let currentGroup: SentenceSpan[] = [];
    let currentWords = 0;

    const flushCurrent = () => {
      if (currentGroup.length === 0) return;
      rawGroups.push(currentGroup);
      currentGroup = [];
      currentWords = 0;
    };

    for (const sent of sentences) {
      const w = countWords(sent.text);
      if (currentGroup.length > 0 && currentWords + w > effectiveMax) {
        flushCurrent();
      }
      currentGroup.push(sent);
      currentWords += w;
      if (w >= effectiveMax) {
        flushCurrent();
      }
    }
    flushCurrent();

    const groupWordCount = (grp: SentenceSpan[]): number =>
      grp.reduce((sum, s) => sum + countWords(s.text), 0);

    // Rebalance trailing chunk if it fell below 50 words by shifting whole sentences from previous chunk
    if (rawGroups.length >= 2) {
      const lastIdx = rawGroups.length - 1;
      const lastGrp = rawGroups[lastIdx];
      const prevGrp = rawGroups[lastIdx - 1];

      while (
        groupWordCount(lastGrp) < minWordsPerChunk &&
        prevGrp.length >= 2
      ) {
        const candidate = prevGrp[prevGrp.length - 1];
        const candidateWords = countWords(candidate.text);
        const nextPrevWords = groupWordCount(prevGrp) - candidateWords;
        const nextLastWords = groupWordCount(lastGrp) + candidateWords;
        if (nextPrevWords >= minWordsPerChunk && nextLastWords <= effectiveMax) {
          prevGrp.pop();
          lastGrp.unshift(candidate);
        } else {
          break;
        }
      }

      // If tail is still < 50 words, merge with previous chunk if combined size fits within limit
      if (
        groupWordCount(lastGrp) < minWordsPerChunk &&
        groupWordCount(prevGrp) + groupWordCount(lastGrp) <= Math.max(effectiveMax, 125)
      ) {
        prevGrp.push(...lastGrp);
        rawGroups.pop();
      }
    }

    for (const grp of rawGroups) {
      if (grp.length === 0) continue;
      const first = grp[0];
      const last = grp[grp.length - 1];
      const joined = para.text.slice(first.startOffset, last.endOffset).trim();
      const wc = countWords(joined);

      // Strictly respect HIX Bypass minimum 50-word requirement
      if (wc < minWordsPerChunk) {
        continue;
      }

      globalOrder += 1;
      chunks.push({
        id: `chk_${para.index}_${globalOrder}`,
        paragraphIndex: para.index,
        chunkOrder: globalOrder,
        text: joined,
        wordCount: wc,
        startOffset: first.startOffset,
        endOffset: last.endOffset,
      });
    }
  }

  return chunks;
}

// Common valid English words containing digits or long consonant sequences to whitelist
const ALPHANUM_WHITELIST = /^(covid-?19|co2|h2o|b2b|b2c|c2c|web3|5g|4g|4k|3d|2d|q[1-4]|iso\d+|m\d+|p\d+|\d+(st|nd|rd|th))$/i;

const UI_LEAK_PATTERNS = [
  'hix bypass',
  'humanize more',
  'words remaining',
  'upgrade your plan',
  'paste your text here',
  'detect ai',
  'try for free',
];

/**
 * Careful corrupted-output / gibberish detector for HIX Bypass responses.
 * Designed to avoid false positives on intentional humanizer grammar tweaks,
 * while catching actual garbled character strings, encoding glitches, stuck loops,
 * accidental UI text leakage, and abrupt mid-sentence truncation.
 */
export function detectHixGlitch(originalText: string, outputText: string): GlitchCheckResult {
  const reasons: string[] = [];
  const suspectTokens: string[] = [];
  const trimmedOut = outputText.trim();
  const origWords = countWords(originalText);
  const outWords = countWords(trimmedOut);

  if (!trimmedOut) {
    return {
      hasGlitch: true,
      reasons: ['HIX Bypass trả về đoạn văn bản trống.'],
      suspectTokens: [],
    };
  }

  // 1. Check severe truncation or missing terminal period
  if (origWords >= 12 && outWords < Math.max(4, Math.floor(origWords * 0.35))) {
    reasons.push(
      `Văn bản trả về bị cụt bất thường (${outWords} từ so với ${origWords} từ gốc).`
    );
  } else if (origWords >= 8 && outWords > origWords * 2.4) {
    reasons.push(
      `Văn bản trả về bị phình lặp bất thường (${outWords} từ so với ${origWords} từ gốc).`
    );
  }

  const origEndedWithPeriod = /\.(?:["'”’)\]]*)$/.test(originalText.trim());
  const outEndedProperly = /[.!?](?:["'”’)\]]*)$/.test(trimmedOut);
  if (origEndedWithPeriod && !outEndedProperly) {
    reasons.push('Đoạn văn mới bị mất dấu kết thúc câu (.) ở cuối đoạn.');
  }

  // 2. Mojibake / Unicode replacement / HTML tags / stray symbol garbage
  if (/[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(trimmedOut) || /Ã©|Ã¨|â€™|â€œ|â€/.test(trimmedOut)) {
    reasons.push('Phát hiện lỗi mã hóa ký tự (mojibake / ký tự không hợp lệ).');
  }

  const strayHtmlOrSymbols = trimmedOut.match(/<\/?[a-z]+[^>]*>|[@#$%^*~`|\\]{2,}/gi);
  if (strayHtmlOrSymbols && strayHtmlOrSymbols.length > 0) {
    reasons.push(`Phát hiện chuỗi ký tự đặc biệt bất thường: "${strayHtmlOrSymbols[0]}".`);
    suspectTokens.push(...strayHtmlOrSymbols.slice(0, 3));
  }

  // 3. Accidental HIX Bypass UI text leakage
  const lowerOut = trimmedOut.toLowerCase();
  const leakedUi = UI_LEAK_PATTERNS.find((pat) => lowerOut.includes(pat));
  if (leakedUi && !originalText.toLowerCase().includes(leakedUi)) {
    reasons.push(`Đoạn trả về lẫn chữ giao diện web ("${leakedUi}").`);
    suspectTokens.push(leakedUi);
  }

  // 4. Token-level scan: impossible alphanumeric mashups, triple-letter spam, or unpronounceable consonant smash
  const rawTokens = trimmedOut.split(/\s+/);
  for (const rawTok of rawTokens) {
    const cleanTok = rawTok.replace(/^[("'“‘[\]]+|[.,;:!?)"'”’\]\-]+$/g, '');
    if (!cleanTok || cleanTok.length < 3) continue;
    if (/^https?:\/\//i.test(cleanTok)) continue;

    // Mixed letters + numbers inside a regular prose word (e.g. "resea4ch", "examp1e")
    if (
      /[a-z]/i.test(cleanTok) &&
      /\d/.test(cleanTok) &&
      !ALPHANUM_WHITELIST.test(cleanTok) &&
      !/^\d+(?:[a-z]{1,2})?$/i.test(cleanTok) &&
      !/^[A-Z0-9-]+$/.test(cleanTok) // allow uppercase codes like ISO-9001 or IDs
    ) {
      reasons.push(`Từ bị dính chữ và số bất thường: "${cleanTok}".`);
      suspectTokens.push(cleanTok);
    }

    // 3+ identical consecutive letters inside a normal word (e.g. "thhhhe", "soooo")
    if (/([a-zA-Z])\1\1/.test(cleanTok) && !/^(xii+|viii+|iii+)$/i.test(cleanTok)) {
      reasons.push(`Từ có ký tự lặp lỗi: "${cleanTok}".`);
      suspectTokens.push(cleanTok);
    }

    // 6+ consecutive consonants inside a lowercase word (keyboard smash / corrupted generation)
    if (
      cleanTok === cleanTok.toLowerCase() &&
      /[bcdfghjklmnpqrstvwxz]{6,}/.test(cleanTok)
    ) {
      reasons.push(`Chuỗi phụ âm vô nghĩa nghi sinh lỗi: "${cleanTok}".`);
      suspectTokens.push(cleanTok);
    }
  }

  // 5. Stuck-loop word / phrase repetition (e.g. "the the", "in order to in order to")
  const immediateDupMatch = trimmedOut.match(
    /\b(the|and|is|are|was|were|to|of|in|on|for|with|that|this|a|an)\s+\1\b/i
  );
  if (immediateDupMatch) {
    reasons.push(`Phát hiện từ bị lặp kẹt liền kề: "${immediateDupMatch[0]}".`);
    suspectTokens.push(immediateDupMatch[0]);
  }

  const wordsLower = rawTokens.map((w) => w.toLowerCase().replace(/[.,;:!?]/g, ''));
  for (let i = 0; i <= wordsLower.length - 6; i++) {
    const trigramA = `${wordsLower[i]} ${wordsLower[i + 1]} ${wordsLower[i + 2]}`;
    const trigramB = `${wordsLower[i + 3]} ${wordsLower[i + 4]} ${wordsLower[i + 5]}`;
    if (trigramA === trigramB && trigramA.trim().length > 6) {
      reasons.push(`Phát hiện cụm từ bị lặp kẹt: "${trigramA}".`);
      suspectTokens.push(trigramA);
      break;
    }
  }

  return {
    hasGlitch: reasons.length > 0,
    reasons: Array.from(new Set(reasons)),
    suspectTokens: Array.from(new Set(suspectTokens)),
  };
}

/**
 * Simple word-level LCS diff for inspecting original vs HIX Bypass output.
 */
export function computeWordDiff(oldText: string, newText: string): DiffPart[] {
  const a = oldText.trim().split(/\s+/).filter(Boolean);
  const b = newText.trim().split(/\s+/).filter(Boolean);
  const m = a.length;
  const n = b.length;

  // Fallback for very long spans to keep UI instant
  if (m * n > 90000) {
    return [
      { type: 'removed', value: oldText },
      { type: 'added', value: newText },
    ];
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0)
  );
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const parts: DiffPart[] = [];
  let i = 0;
  let j = 0;
  const pushPart = (type: DiffPart['type'], word: string) => {
    const prev = parts[parts.length - 1];
    if (prev && prev.type === type) {
      prev.value = `${prev.value} ${word}`;
    } else {
      parts.push({ type, value: word });
    }
  };

  while (i < m && j < n) {
    if (a[i] === b[j]) {
      pushPart('equal', a[i]);
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      pushPart('removed', a[i]);
      i += 1;
    } else {
      pushPart('added', b[j]);
      j += 1;
    }
  }
  while (i < m) {
    pushPart('removed', a[i]);
    i += 1;
  }
  while (j < n) {
    pushPart('added', b[j]);
    j += 1;
  }

  return parts;
}
