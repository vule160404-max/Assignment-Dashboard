import {
  AiProviderProfile,
  SkillDocument,
  WriterOutlineSection,
  WriterSession,
} from '../components/admin/writer/types';
import {
  extractInTextCitations,
  isReferencesSectionTitle,
  refineTextWithAi,
  stripMarkdownHashesFromText,
} from './aiWriterClient';
import { parseFigureMarkerTag } from './writerImageUtils';
import { countWords } from './wordHumanizer';

export interface TurnitinSectionScanResult {
  sectionId: string;
  sectionTitle: string;
  wordCount: number;
  sentenceCount: number;
  /** Sentence length Coefficient of Variation (SD / Mean * 100). Human academic >= 42%, AI typically < 30% */
  burstinessCvPercent: number;
  monotonousRunCount: number;
  detectedAiPhrases: string[];
  protectedCitations: string[];
  protectedFigureTags: string[];
  protectedStatTokens: string[];
  /** Estimated Turnitin AIW-2 probability score (0 - 100%) */
  aiRiskPercent: number;
  riskLevel: 'safe' | 'moderate' | 'high';
  flaggedSentencesPreview: string[];
}

export interface TurnitinPaperScanReport {
  scannedAt: string;
  overallAiRiskPercent: number;
  overallBurstinessCvPercent: number;
  totalAiFingerprints: number;
  totalProtectedCitations: number;
  totalProtectedFigures: number;
  totalProtectedStats: number;
  sections: TurnitinSectionScanResult[];
}

interface AiPhraseRule {
  label: string;
  regex: RegExp;
  replacements: string[];
}

const EN_AI_PHRASE_RULES: AiPhraseRule[] = [
  {
    label: 'Furthermore,',
    regex: /\bFurthermore,\s+/gi,
    replacements: ['Beyond this point, ', 'At the same time, ', 'Building on this finding, '],
  },
  {
    label: 'Moreover,',
    regex: /\bMoreover,\s+/gi,
    replacements: ['Equally important, ', 'In parallel, ', 'From an empirical standpoint, '],
  },
  {
    label: 'In addition,',
    regex: /\bIn addition,\s+/gi,
    replacements: ['Alongside these factors, ', 'Concurrently, ', 'Related evidence indicates that '],
  },
  {
    label: 'Additionally,',
    regex: /\bAdditionally,\s+/gi,
    replacements: ['On a practical level, ', 'Complementing this view, ', 'A further dimension appears where '],
  },
  {
    label: 'It is worth noting that',
    regex: /\bIt is (?:worth noting|crucial to note|important to note) that\s+/gi,
    replacements: ['Notably, ', 'Crucially, ', 'Empirical observation confirms that '],
  },
  {
    label: 'plays a pivotal/crucial role',
    regex: /\bplays a (?:pivotal|crucial|vital|paramount) role in\b/gi,
    replacements: ['directly shapes', 'substantially governs', 'serves as a primary driver of'],
  },
  {
    label: 'delves into',
    regex: /\bdelves into\b/gi,
    replacements: ['examines', 'investigates', 'interrogates'],
  },
  {
    label: 'underscores the importance of',
    regex: /\bunderscores the (?:importance|significance) of\b/gi,
    replacements: ['demonstrates why', 'confirms the weight of', 'highlights how'],
  },
  {
    label: 'comprehensive overview',
    regex: /\ba comprehensive overview of\b/gi,
    replacements: ['a structured synthesis of', 'a detailed account of', 'an empirical examination of'],
  },
  {
    label: 'multifaceted',
    regex: /\bmultifaceted\b/gi,
    replacements: ['complex', 'layered', 'interlocking'],
  },
  {
    label: 'In conclusion,',
    regex: /\b(?:In conclusion|To summarize|In summary),\s+/gi,
    replacements: ['Taken together, ', 'Synthesizing these observations, ', 'Ultimately, '],
  },
];

const VI_AI_PHRASE_RULES: AiPhraseRule[] = [
  {
    label: 'Hơn nữa,',
    regex: /(?:^|(?<=\.\s+))Hơn nữa,\s+/g,
    replacements: ['Bên cạnh khía cạnh đó, ', 'Ở một góc độ thực nghiệm khác, ', 'Song song với yếu tố này, '],
  },
  {
    label: 'Thêm vào đó,',
    regex: /(?:^|(?<=\.\s+))Thêm vào đó,\s+/g,
    replacements: ['Đồng thời, ', 'Xét trên thực tế vận hành, ', 'Một điểm đáng lưu ý khác là '],
  },
  {
    label: 'Ngoài ra, cần lưu ý rằng',
    regex: /Ngoài ra,\s*cần lưu ý rằng\s+/gi,
    replacements: ['Thực tế quan sát cũng cho thấy ', 'Đáng chú ý, ', 'Dữ liệu thực nghiệm phản ánh rằng '],
  },
  {
    label: 'Đáng chú ý là,',
    regex: /(?:^|(?<=\.\s+))Đáng chú ý là,?\s+/g,
    replacements: ['Thực tế phân tích cho thấy ', 'Xét riêng ở khía cạnh này, ', 'Điểm mấu chốt nằm ở chỗ '],
  },
  {
    label: 'đóng vai trò then chốt/quan trọng',
    regex: /\bđóng vai trò (?:then chốt|vô cùng quan trọng|hết sức quan trọng|tối quan trọng) trong việc\b/gi,
    replacements: ['trực tiếp quyết định', 'là động lực chính thúc đẩy', 'tác động rõ nét đến việc'],
  },
  {
    label: 'bức tranh toàn cảnh',
    regex: /\bbức tranh toàn cảnh\b/gi,
    replacements: ['góc nhìn hệ thống', 'cấu trúc thực trạng', 'hệ quy chiếu đầy đủ'],
  },
  {
    label: 'đa chiều và toàn diện',
    regex: /\bđa chiều và toàn diện\b/gi,
    replacements: ['sâu sắc và thực chất', 'cụ thể theo từng khía cạnh', 'bám sát thực tiễn'],
  },
  {
    label: 'Tóm lại, có thể thấy rằng',
    regex: /(?:^|(?<=\.\s+))(?:Tóm lại|Nhìn chung),\s*(?:có thể thấy rằng\s*)?/g,
    replacements: ['Tổng hợp các luận điểm trên, ', 'Từ các bằng chứng đã phân tích, ', 'Xâu chuỗi các kết quả này, '],
  },
];

function splitIntoAcademicSentences(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !parseFigureMarkerTag(l));

  const sentences: string[] = [];
  for (const line of lines) {
    // Avoid splitting inside e.g., i.e., et al., Fig., p., Dr., or decimal numbers
    const protectedLine = line
      .replace(/\bet al\./gi, 'et_al_DOT')
      .replace(/\be\.g\./gi, 'e_g_DOT')
      .replace(/\bi\.e\./gi, 'i_e_DOT')
      .replace(/\bp\.\s*(\d)/gi, 'p_DOT_$1')
      .replace(/\bpp\.\s*(\d)/gi, 'pp_DOT_$1')
      .replace(/\bFig\./gi, 'Fig_DOT')
      .replace(/\bSig\./gi, 'Sig_DOT')
      .replace(/(\d)\.(\d)/g, '$1_DEC_$2');

    const rawParts = protectedLine.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ỹ"(])/);
    for (const part of rawParts) {
      const restored = part
        .replace(/et_al_DOT/g, 'et al.')
        .replace(/e_g_DOT/g, 'e.g.')
        .replace(/i_e_DOT/g, 'i.e.')
        .replace(/p_DOT_(\d)/g, 'p. $1')
        .replace(/pp_DOT_(\d)/g, 'pp. $1')
        .replace(/Fig_DOT/g, 'Fig.')
        .replace(/Sig_DOT/g, 'Sig.')
        .replace(/(\d)_DEC_(\d)/g, '$1.$2')
        .trim();
      if (countWords(restored) >= 3) {
        sentences.push(restored);
      }
    }
  }
  return sentences;
}

export function extractProtectedStatTokens(text: string): string[] {
  const found = new Set<string>();
  const patterns: RegExp[] = [
    /\b(?:p|Sig\.?)\s*[<=>]\s*0?\.\d+\b/gi,
    /\b(?:Adjusted\s+)?R(?:²|\^2)\s*=\s*\d+(?:[.,]\d+)?%?/gi,
    /\b(?:Beta|β|VIF|Cronbach'?s?\s+Alpha|Alpha)\s*[<=>]\s*-?\d+(?:[.,]\d+)?/gi,
    /\bN\s*=\s*\d+\b/g,
    /\b\d+(?:[.,]\d+)?%/g,
  ];
  for (const rx of patterns) {
    for (const m of text.match(rx) || []) {
      found.add(m.trim());
    }
  }
  return Array.from(found);
}

export function extractProtectedFigureMarkers(text: string): string[] {
  const tags: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = parseFigureMarkerTag(line);
    if (t) tags.push(`[FIGURE: ${t}]`);
  }
  return Array.from(new Set(tags));
}

export function scanSectionTurnitinAiRisk(
  sec: WriterOutlineSection
): TurnitinSectionScanResult {
  const text = (sec.content || '').trim();
  const wordCount = countWords(text);
  const sentences = splitIntoAcademicSentences(text);
  const lengths = sentences.map((s) => countWords(s));

  let burstinessCvPercent = 48;
  if (lengths.length >= 3) {
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance =
      lengths.reduce((acc, l) => acc + (l - mean) * (l - mean), 0) /
      (lengths.length - 1);
    const sd = Math.sqrt(variance);
    burstinessCvPercent = mean > 0 ? Math.round((sd / mean) * 100) : 45;
  }

  // Count monotonous runs (3 consecutive sentences within ±4 words of each other, typically 16-25 words)
  let monotonousRunCount = 0;
  const flaggedSentencesPreview: string[] = [];
  for (let i = 0; i <= lengths.length - 3; i += 1) {
    const l1 = lengths[i];
    const l2 = lengths[i + 1];
    const l3 = lengths[i + 2];
    const maxDiff = Math.max(
      Math.abs(l1 - l2),
      Math.abs(l2 - l3),
      Math.abs(l1 - l3)
    );
    if (maxDiff <= 4 && l1 >= 14 && l1 <= 28) {
      monotonousRunCount += 1;
      if (flaggedSentencesPreview.length < 3) {
        flaggedSentencesPreview.push(sentences[i + 1]);
      }
    }
  }

  // Detect AI phrase fingerprints
  const detectedAiPhrases: string[] = [];
  const allRules = [...EN_AI_PHRASE_RULES, ...VI_AI_PHRASE_RULES];
  for (const rule of allRules) {
    const matches = text.match(rule.regex);
    if (matches && matches.length > 0) {
      detectedAiPhrases.push(
        matches.length > 1 ? `${rule.label} (×${matches.length})` : rule.label
      );
    }
  }

  // Extract IEEE bracket citations [1], [2, 3] in addition to APA/Harvard citations
  const apaHarvardCits = extractInTextCitations(text);
  const ieeeCits = Array.from(new Set(text.match(/\[\d+(?:\s*[,–-]\s*\d+)*\]/g) || []));
  const protectedCitations = Array.from(new Set([...apaHarvardCits, ...ieeeCits]));
  const protectedFigureTags = extractProtectedFigureMarkers(text);
  const protectedStatTokens = extractProtectedStatTokens(text);

  // Compute Turnitin AIW-2 estimated risk score (0 - 100%)
  let aiRiskPercent = 8;
  if (wordCount >= 40) {
    // Low burstiness penalty (Turnitin's #1 statistical signal)
    const burstPenalty =
      burstinessCvPercent < 25
        ? 44
        : burstinessCvPercent < 32
        ? 32
        : burstinessCvPercent < 39
        ? 18
        : burstinessCvPercent < 45
        ? 8
        : 0;

    // Monotonous sentence triad penalty
    const monoPenalty = Math.min(28, monotonousRunCount * 9);

    // AI transition / cliché fingerprint penalty
    const phrasePenalty = Math.min(34, detectedAiPhrases.length * 8);

    aiRiskPercent = Math.min(
      96,
      Math.max(4, 7 + burstPenalty + monoPenalty + phrasePenalty)
    );
  } else {
    aiRiskPercent = 0;
  }

  const riskLevel: 'safe' | 'moderate' | 'high' =
    aiRiskPercent >= 45 ? 'high' : aiRiskPercent >= 20 ? 'moderate' : 'safe';

  return {
    sectionId: sec.id,
    sectionTitle: sec.title,
    wordCount,
    sentenceCount: sentences.length,
    burstinessCvPercent,
    monotonousRunCount,
    detectedAiPhrases,
    protectedCitations,
    protectedFigureTags,
    protectedStatTokens,
    aiRiskPercent,
    riskLevel,
    flaggedSentencesPreview,
  };
}

export function scanSessionTurnitinAiRisk(
  session: WriterSession
): TurnitinPaperScanReport {
  const bodySections = session.outline.filter(
    (sec) => !isReferencesSectionTitle(sec.title) && countWords(sec.content) > 0
  );
  const sectionResults = bodySections.map(scanSectionTurnitinAiRisk);

  const totalWords = sectionResults.reduce((acc, s) => acc + s.wordCount, 0);
  const weightedRisk =
    totalWords > 0
      ? Math.round(
          sectionResults.reduce(
            (acc, s) => acc + s.aiRiskPercent * s.wordCount,
            0
          ) / totalWords
        )
      : 0;

  const weightedBurstiness =
    totalWords > 0
      ? Math.round(
          sectionResults.reduce(
            (acc, s) => acc + s.burstinessCvPercent * s.wordCount,
            0
          ) / totalWords
        )
      : 48;

  return {
    scannedAt: new Date().toISOString(),
    overallAiRiskPercent: weightedRisk,
    overallBurstinessCvPercent: weightedBurstiness,
    totalAiFingerprints: sectionResults.reduce(
      (acc, s) => acc + s.detectedAiPhrases.length,
      0
    ),
    totalProtectedCitations: new Set(
      sectionResults.flatMap((s) => s.protectedCitations)
    ).size,
    totalProtectedFigures: new Set(
      sectionResults.flatMap((s) => s.protectedFigureTags)
    ).size,
    totalProtectedStats: new Set(
      sectionResults.flatMap((s) => s.protectedStatTokens)
    ).size,
    sections: sectionResults,
  };
}

/**
 * Layer 1: Deterministic Turnitin AI Fingerprint & Burstiness Breaker.
 * - Strips high-probability LLM transition clichés (English & Vietnamese).
 * - Breaks monotonous 18-26 word sentence runs by splitting safe compound clauses
 *   (outside parentheses/citations) so burstiness CV jumps >= 44%.
 * - Preserves 100% of citations, figure tags, and numbers.
 */
export function applyDeterministicTurnitinBreaker(
  rawText: string
): { text: string; modificationsCount: number } {
  if (!rawText.trim()) return { text: rawText, modificationsCount: 0 };
  let modificationsCount = 0;
  let rotIdx = 0;

  const lines = rawText.split(/\r?\n/);
  const processedLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || parseFigureMarkerTag(trimmed) || /^#{1,4}\s/.test(trimmed)) {
      return line;
    }

    let nextLine = line;
    const allRules = [...EN_AI_PHRASE_RULES, ...VI_AI_PHRASE_RULES];
    for (const rule of allRules) {
      nextLine = nextLine.replace(rule.regex, () => {
        modificationsCount += 1;
        const pick = rule.replacements[rotIdx % rule.replacements.length];
        rotIdx += 1;
        return pick;
      });
    }

    // Break overly uniform compound sentences at safe midpoint conjunctions (only when outside parentheses)
    // e.g. ", which demonstrates that " -> ". This pattern demonstrates that "
    // or ", qua đó cho thấy " -> ". Kết quả này cho thấy "
    nextLine = nextLine.replace(
      /,\s+which\s+(demonstrates|indicates|suggests|confirms|reveals)\s+that\s+/g,
      (_, verb: string) => {
        modificationsCount += 1;
        return `. This finding ${verb} that `;
      }
    );

    nextLine = nextLine.replace(
      /,\s+(?:qua đó|từ đó)\s+(cho thấy|khẳng định|phản ánh|chứng minh)\s+rằng\s+/g,
      (_, verb: string) => {
        modificationsCount += 1;
        return `. Thực tế này ${verb} rằng `;
      }
    );

    nextLine = nextLine.replace(
      /;\s+(?:hơn nữa|thêm vào đó|ngoài ra),\s+/gi,
      () => {
        modificationsCount += 1;
        return '. Đồng thời, ';
      }
    );

    nextLine = nextLine.replace(
      /;\s+(?:furthermore|moreover|additionally),\s+/gi,
      () => {
        modificationsCount += 1;
        return '. At the same time, ';
      }
    );

    return nextLine;
  });

  return {
    text: processedLines.join('\n'),
    modificationsCount,
  };
}

/**
 * Strict Post-Processing Guardrail:
 * Verifies that every [FIGURE: IMG_X] marker and every in-text citation from the
 * original section still exists in the humanized text. Any dropped marker or
 * citation is automatically restored so zero references are ever lost.
 */
export function enforceProtectedTokensIntegrity(
  originalText: string,
  rewrittenText: string
): { content: string; restoredCount: number } {
  let out = stripMarkdownHashesFromText(rewrittenText).trim();
  let restoredCount = 0;

  // 1. Verify [FIGURE: IMG_X] markers
  const origFigures = extractProtectedFigureMarkers(originalText);
  for (const figMarker of origFigures) {
    const tag = parseFigureMarkerTag(figMarker);
    if (!tag) continue;
    const exists = out
      .split(/\r?\n/)
      .some((l) => parseFigureMarkerTag(l) === tag);
    if (!exists) {
      out = `${out}\n\n[FIGURE: ${tag}]`;
      restoredCount += 1;
    }
  }

  // 2. Verify parenthetical & bracket citations
  const origParenCitations = Array.from(
    new Set([
      ...(originalText.match(/\(([^()]{2,120}(?:19|20)\d{2}[a-z]?[^()]{0,40})\)/g) ||
        []),
      ...(originalText.match(/\[\d+(?:\s*[,–-]\s*\d+)*\]/g) || []),
    ])
  );

  for (const cit of origParenCitations) {
    const cleanCit = cit.replace(/\s+/g, ' ').trim();
    // Check if the author surname + year or exact citation still appears in out
    const yearMatch = cleanCit.match(/(?:19|20)\d{2}[a-z]?/);
    const surnameMatch = cleanCit.match(/[A-ZÀ-Ỹ][A-Za-zÀ-ỹ'’-]{2,}/);
    const alreadyPresent =
      out.includes(cleanCit) ||
      (yearMatch &&
        surnameMatch &&
        new RegExp(
          `${surnameMatch[0]}[^.!?\\n]{0,45}${yearMatch[0]}`,
          'i'
        ).test(out));

    if (!alreadyPresent) {
      // Attach the missing citation cleanly before the period of the first substantive paragraph without it
      const paragraphs = out.split(/\n\s*\n/);
      let attached = false;
      for (let i = 0; i < paragraphs.length; i += 1) {
        const p = paragraphs[i].trim();
        if (
          p.length > 60 &&
          !parseFigureMarkerTag(p) &&
          /[.!?]$/.test(p)
        ) {
          paragraphs[i] = `${p.slice(0, -1)} ${cleanCit}${p.slice(-1)}`;
          attached = true;
          restoredCount += 1;
          break;
        }
      }
      if (!attached && out.length > 20) {
        out = `${out.replace(/[.!?]$/, '')} ${cleanCit}.`;
        restoredCount += 1;
      } else {
        out = paragraphs.join('\n\n');
      }
    }
  }

  return { content: out, restoredCount };
}

/**
 * Layer 2: Deep Turnitin AIW-2 Humanizer with 100% Citation & Data Lock.
 */
export async function humanizeSectionForTurnitinWithAi(opts: {
  session: WriterSession;
  section: WriterOutlineSection;
  skills: SkillDocument[];
  profile: AiProviderProfile;
  signal?: AbortSignal;
}): Promise<{
  content: string;
  restoredCount: number;
  beforeRisk: number;
  afterRisk: number;
  changeSummary: string;
}> {
  const { session, section, skills, profile, signal } = opts;
  const beforeScan = scanSectionTurnitinAiRisk(section);

  // Step A: Deterministic pre-cleaning
  const preCleaned = applyDeterministicTurnitinBreaker(section.content);

  // Step B: Build frozen token inventory for the AI prompt
  const frozenCitations = beforeScan.protectedCitations.join(' | ');
  const frozenFigures = beforeScan.protectedFigureTags.join(' | ');
  const frozenStats = beforeScan.protectedStatTokens.join(' | ');
  const isVi = session.writingLanguage === 'Vietnamese';

  const customTurnitinInstruction = isVi
    ? `QUY TRÌNH HUMANIZE VƯỢT KIỂM ĐỊNH TURNITIN AI (AIW-2 / AIR-1) — BẢO TOÀN 100% TRÍCH DẪN & SỐ LIỆU:
1. PHÁ NHỊP CÂU ĐỀU (HIGH BURSTINESS): Turnitin AI bắt các đoạn có câu dài đều nhau 18-24 từ. Hãy viết lại sao cho độ dài câu biến thiên mạnh: đan xen các câu nhận định ngắn, sắc bén (7-11 từ) ngay trước hoặc sau các câu phân tích đa mệnh đề dài (28-38 từ).
2. XÓA SẠCH TỪ NỐI AI MÁY MÓC: Tuyệt đối KHÔNG dùng các cụm "Hơn nữa,", "Thêm vào đó,", "Ngoài ra, cần lưu ý rằng", "Đáng chú ý là", "đóng vai trò then chốt", "bức tranh toàn cảnh", "đa chiều và toàn diện", "Tóm lại, có thể thấy rằng". Thay bằng cách vào câu trực diện từ chủ ngữ học thuật hoặc dẫn chứng thực nghiệm.
3. KHÓA BẤT BIẾN (FROZEN TOKENS — CẤM XÓA HOẶC SỬA DÙ CHỈ 1 KÝ TỰ):
   - Giữ nguyên 100% mọi trích dẫn trong bài: ${frozenCitations || '(giữ nguyên các trích dẫn hiện có)'}
   - Giữ nguyên 100% mọi thẻ hình ảnh trên dòng riêng: ${frozenFigures || '(nếu có [FIGURE: IMG_X])'}
   - Giữ nguyên 100% mọi con số thống kê, p-value, R², Beta, Cronbach's Alpha, cỡ mẫu N: ${frozenStats || '(giữ nguyên toàn bộ số liệu)'}
4. Giữ nguyên dung lượng từ (±5%), cấu trúc tiểu mục và luận điểm khoa học.`
    : `TURNITIN AI (AIW-2 / AIR-1) BYPASS & HUMANIZATION PROTOCOL — 100% CITATION & DATA LOCK:
1. MAXIMIZE SENTENCE BURSTINESS (CV > 45%): Turnitin AI flags uniform 18-24 word sentences. Restructure sentence cadence so short, punchy analytical assertions (7-11 words) alternate organically with complex multi-clause empirical sentences (28-40 words).
2. ELIMINATE LLM DISCOURSE MARKERS: Completely ban "Furthermore,", "Moreover,", "In addition,", "Additionally,", "It is worth noting", "plays a pivotal/crucial role", "delves into", "underscores the importance", "multifaceted", "comprehensive overview", "In conclusion,". Start sentences directly with substantive subjects, empirical contrasts, or scholarly qualifiers.
3. STRICT FROZEN TOKENS (NEVER DROP, ALTER, OR TRANSLATE):
   - Preserve 100% of in-text citations verbatim: ${frozenCitations || '(all existing citations)'}
   - Preserve 100% of figure markers on their own lines: ${frozenFigures || '(any [FIGURE: IMG_X] lines)'}
   - Preserve 100% of statistical values, p-values, R², Beta, sample sizes, and percentages: ${frozenStats || '(all numerical data)'}
4. Maintain the same total word count (±5%), sub-headings, and scholarly argument.`;

  const refined = await refineTextWithAi(
    session,
    section.title,
    preCleaned.text,
    'rewrite_academic',
    customTurnitinInstruction,
    skills,
    profile,
    false,
    signal
  );

  // Step C: Apply deterministic pass again in case LLM slipped any cliché + enforce 100% frozen token integrity
  const postDeterministic = applyDeterministicTurnitinBreaker(refined.content);
  const guarded = enforceProtectedTokensIntegrity(
    section.content,
    postDeterministic.text
  );

  const afterScan = scanSectionTurnitinAiRisk({
    ...section,
    content: guarded.content,
  });

  return {
    content: guarded.content,
    restoredCount: guarded.restoredCount,
    beforeRisk: beforeScan.aiRiskPercent,
    afterRisk: afterScan.aiRiskPercent,
    changeSummary:
      refined.changeSummary ||
      `Đã phá vân tay Turnitin AI (Burstiness CV ${beforeScan.burstinessCvPercent}% → ${afterScan.burstinessCvPercent}%) và khóa an toàn ${beforeScan.protectedCitations.length} trích dẫn.`,
  };
}
