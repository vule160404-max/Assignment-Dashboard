export interface IntegrityCheckOptions {
  excludeReferences?: boolean;
  excludeQuotes?: boolean;
  title?: string;
}

export interface MatchedSourceItem {
  id: number;
  badgeColor: string;
  title: string;
  authorOrVenue: string;
  year?: string;
  url: string;
  sourceType: 'publication' | 'internet' | 'academic_repo';
  matchedSentenceCount: number;
  matchedWordCount: number;
  similarityPercent: number;
  sampleSnippet: string;
}

export interface AnalyzedSentence {
  id: string;
  paragraphIndex: number;
  sentenceIndex: number;
  text: string;
  wordCount: number;
  isExcludedReference: boolean;
  isExcludedQuote: boolean;
  matchedSourceId: number | null;
  matchSimilarity: number;
  matchedSnippet?: string;
  aiProbability: number;
  aiLevel: 'human' | 'mixed' | 'ai_high';
  aiReasons: string[];
}

export interface DetectedAiPhrase {
  phrase: string;
  count: number;
  category: 'transition' | 'cliche' | 'hedging';
}

export interface IntegrityAnalysisReport {
  reportId: string;
  analyzedAt: string;
  title: string;
  totalWords: number;
  analyzedWords: number;
  totalSentences: number;
  totalCharacters: number;
  overallSimilarityPercent: number;
  publicationsSimilarityPercent: number;
  internetSimilarityPercent: number;
  overallAiPercent: number;
  forensics: {
    burstinessScore: number;
    lexicalDiversityScore: number;
    structuralUniformityScore: number;
    aiPhraseDensityScore: number;
    avgSentenceLengthWords: number;
    sentenceLengthStdDev: number;
    highAiSentenceCount: number;
    mixedAiSentenceCount: number;
    humanSentenceCount: number;
  };
  detectedAiPhrases: DetectedAiPhrase[];
  sources: MatchedSourceItem[];
  sentences: AnalyzedSentence[];
}

interface ExternalCandidateSource {
  key: string;
  title: string;
  authorOrVenue: string;
  year?: string;
  url: string;
  sourceType: 'publication' | 'internet' | 'academic_repo';
  corpusText: string;
  corpusTokens: Set<string>;
  corpusTrigrams: Set<string>;
}

const SOURCE_BADGE_COLORS = [
  '#DC2626', // Crimson
  '#D97706', // Amber
  '#0284C7', // Sky
  '#7C3AED', // Violet
  '#059669', // Emerald
  '#DB2777', // Pink
  '#EA580C', // Orange
  '#4F46E5', // Indigo
];

const POLITE_HEADERS = {
  'User-Agent': 'AssignTrackAcademicChecker/1.0 (mailto:vule160404@gmail.com)',
  Accept: 'application/json',
};

const PROTECTED_ABBR_PATTERNS: RegExp[] = [
  /\b(e\.g|i\.e|et al|etc|vs|cf|approx|est|incl|ca|viz)\./gi,
  /\b(Dr|Prof|Mr|Mrs|Ms|Sr|Jr|St|Rev|Hon|Pres|Gen|Col|Capt)\./g,
  /\b(Fig|Figs|Eq|Eqs|Tab|Tabs|Vol|No|Nos|pp|p|Ch|Sec|App|Art|Ref|Refs|Inc|Ltd|Corp|Co)\./gi,
  /\b(U\.S|U\.K|U\.N|E\.U|Ph\.D|M\.A|B\.A|M\.Sc|B\.Sc)\./g,
];

const AI_PHRASE_PATTERNS: {
  phrase: string;
  regex: RegExp;
  category: DetectedAiPhrase['category'];
  weight: number;
}[] = [
  { phrase: 'delve into', regex: /\bdelv(e|es|ed|ing)\s+into\b/gi, category: 'cliche', weight: 28 },
  { phrase: 'plays a pivotal role', regex: /\bplay(s|ed|ing)?\s+a\s+(pivotal|crucial|vital|paramount)\s+role\b/gi, category: 'cliche', weight: 26 },
  { phrase: 'testament to', regex: /\ba\s+testament\s+to\b/gi, category: 'cliche', weight: 24 },
  { phrase: 'it is crucial to note', regex: /\bit\s+is\s+(crucial|essential|imperative|worth)\s+(to\s+note|noting)\b/gi, category: 'hedging', weight: 22 },
  { phrase: 'multifaceted', regex: /\bmultifaceted\b/gi, category: 'cliche', weight: 22 },
  { phrase: 'comprehensive overview', regex: /\bcomprehensive\s+(overview|analysis|understanding|framework)\b/gi, category: 'cliche', weight: 20 },
  { phrase: 'underscore the importance', regex: /\bunderscore(s|d|ing)?\s+the\s+(importance|need|significance)\b/gi, category: 'cliche', weight: 22 },
  { phrase: 'in today’s rapidly evolving', regex: /\bin\s+today['’]?s\s+rapidly\s+(evolving|changing)\b/gi, category: 'cliche', weight: 28 },
  { phrase: 'in conclusion, it is evident', regex: /\bin\s+conclusion,\s+it\s+is\s+(evident|clear)\b/gi, category: 'transition', weight: 22 },
  { phrase: 'tapestry of', regex: /\b(rich\s+)?tapestry\s+of\b/gi, category: 'cliche', weight: 26 },
  { phrase: 'landscape of', regex: /\b(ever-evolving|complex|dynamic)\s+landscape\s+of\b/gi, category: 'cliche', weight: 22 },
  { phrase: 'foster innovation', regex: /\bfoster(s|ing)?\s+(innovation|collaboration|growth)\b/gi, category: 'cliche', weight: 18 },
  { phrase: 'moreover,', regex: /^\s*moreover,/gim, category: 'transition', weight: 15 },
  { phrase: 'furthermore,', regex: /^\s*furthermore,/gim, category: 'transition', weight: 15 },
  { phrase: 'additionally,', regex: /^\s*additionally,/gim, category: 'transition', weight: 15 },
  { phrase: 'consequently,', regex: /^\s*consequently,/gim, category: 'transition', weight: 14 },
  { phrase: 'notably,', regex: /^\s*notably,/gim, category: 'transition', weight: 16 },
  { phrase: 'on the other hand,', regex: /^\s*on\s+the\s+other\s+hand,/gim, category: 'transition', weight: 12 },
  { phrase: 'đóng vai trò then chốt', regex: /đóng\s+vai\s+trò\s+(then\s+chốt|quan\s+trọng\s+hàng\s+đầu|cốt\s+lõi)/gi, category: 'cliche', weight: 24 },
  { phrase: 'bức tranh toàn cảnh', regex: /bức\s+tranh\s+(toàn\s+cảnh|đa\s+chiều)/gi, category: 'cliche', weight: 24 },
  { phrase: 'tổng kết lại, có thể thấy', regex: /(tổng\s+kết\s+lại|tóm\s+lại),?\s+có\s+thể\s+thấy/gi, category: 'transition', weight: 22 },
  { phrase: 'hơn thế nữa,', regex: /^\s*hơn\s+thế\s+nữa,/gim, category: 'transition', weight: 16 },
  { phrase: 'bên cạnh đó,', regex: /^\s*bên\s+cạnh\s+đó,/gim, category: 'transition', weight: 14 },
  { phrase: 'đáng chú ý là', regex: /đáng\s+chú\s+ý\s+là/gi, category: 'hedging', weight: 16 },
  { phrase: 'không chỉ ... mà còn', regex: /không\s+chỉ\s+[^.]{3,60}\s+mà\s+còn/gi, category: 'cliche', weight: 14 },
];

const COMMON_STOPWORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'were', 'been',
  'they', 'their', 'which', 'what', 'when', 'where', 'will', 'would', 'could',
  'should', 'into', 'also', 'such', 'more', 'most', 'some', 'than', 'then',
  'these', 'those', 'there', 'about', 'between', 'through', 'while', 'under',
  'của', 'và', 'các', 'trong', 'cho', 'với', 'được', 'là', 'một', 'những',
  'này', 'để', 'từ', 'khi', 'như', 'về', 'đã', 'có', 'không', 'trên', 'theo',
]);

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

function buildTrigrams(tokens: string[]): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i <= tokens.length - 3; i++) {
    set.add(`${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`);
  }
  return set;
}

function splitParagraphIntoSentences(paragraph: string): string[] {
  const placeholder = '__DOT__';
  let masked = paragraph.trim();
  if (!masked) return [];

  for (const pat of PROTECTED_ABBR_PATTERNS) {
    masked = masked.replace(pat, (m) => m.replace(/\./g, placeholder));
  }
  // Protect decimal numbers (e.g. 3.14, 12.5%) and initials (A. B.)
  masked = masked.replace(/(\d)\.(\d)/g, `$1${placeholder}$2`);
  masked = masked.replace(/\b([A-Z])\./g, `$1${placeholder}`);

  const rawChunks = masked.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ỹ"“(\[])/);
  return rawChunks
    .map((s) => s.replace(new RegExp(placeholder, 'g'), '.').trim())
    .filter((s) => s.length > 0);
}

function isReferenceSectionHeading(paragraph: string): boolean {
  const clean = paragraph.replace(/^#+\s*/, '').trim();
  return /^(references|bibliography|works\s+cited|reference\s+list|tài\s+liệu\s+tham\s+khảo)(\s*\(.*\))?$/i.test(
    clean
  );
}

function isMostlyQuotedSentence(sentence: string): boolean {
  const quotedMatches = sentence.match(/["“][^"”]{10,}["”]/g);
  if (!quotedMatches) return false;
  const quotedLen = quotedMatches.reduce((sum, q) => sum + q.length, 0);
  return quotedLen / Math.max(1, sentence.length) >= 0.55;
}

function reconstructOpenAlexAbstract(
  invertedIndex: Record<string, number[]> | null | undefined
): string {
  if (!invertedIndex || typeof invertedIndex !== 'object') return '';
  const words: string[] = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    if (!Array.isArray(positions)) continue;
    for (const pos of positions) {
      if (typeof pos === 'number' && pos >= 0 && pos < 600) {
        words[pos] = word;
      }
    }
  }
  return words.filter(Boolean).join(' ');
}

function stripHtmlTags(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSearchKeywords(sentence: string): string {
  const tokens = normalizeWords(sentence).filter(
    (w) => w.length >= 3 && !COMMON_STOPWORDS.has(w)
  );
  return tokens.slice(0, 10).join(' ');
}

async function queryCrossrefForSentence(
  query: string
): Promise<ExternalCandidateSource[]> {
  if (!query) return [];
  try {
    const url = `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(
      query
    )}&rows=2&select=DOI,title,author,published,container-title,abstract,URL`;
    const resp = await fetch(url, {
      headers: POLITE_HEADERS,
      signal: AbortSignal.timeout(4500),
    });
    if (!resp.ok) return [];
    const data = (await resp.json()) as {
      message?: {
        items?: Array<{
          DOI?: string;
          URL?: string;
          title?: string[];
          abstract?: string;
          'container-title'?: string[];
          author?: Array<{ family?: string; given?: string }>;
          published?: { 'date-parts'?: number[][] };
        }>;
      };
    };
    const items = data.message?.items || [];
    return items
      .map((item) => {
        const title = (item.title?.[0] || '').trim();
        if (!title) return null;
        const venue = (item['container-title']?.[0] || '').trim();
        const firstAuthor = item.author?.[0]?.family || '';
        const yearNum = item.published?.['date-parts']?.[0]?.[0];
        const year = yearNum ? String(yearNum) : undefined;
        const abstractClean = stripHtmlTags(item.abstract || '');
        const corpusText = `${title}. ${abstractClean}`.trim();
        const tokens = normalizeWords(corpusText);
        return {
          key: `crossref:${item.DOI || title.toLowerCase()}`,
          title,
          authorOrVenue: [firstAuthor, venue].filter(Boolean).join(' · ') || 'Crossref Publication',
          year,
          url: item.URL || (item.DOI ? `https://doi.org/${item.DOI}` : 'https://search.crossref.org/'),
          sourceType: 'publication' as const,
          corpusText,
          corpusTokens: new Set(tokens.filter((t) => !COMMON_STOPWORDS.has(t))),
          corpusTrigrams: buildTrigrams(tokens),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  } catch {
    return [];
  }
}

async function queryOpenAlexForSentence(
  query: string
): Promise<ExternalCandidateSource[]> {
  if (!query) return [];
  try {
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(
      query
    )}&per-page=2&select=id,doi,title,publication_year,primary_location,authorships,abstract_inverted_index`;
    const resp = await fetch(url, {
      headers: POLITE_HEADERS,
      signal: AbortSignal.timeout(4500),
    });
    if (!resp.ok) return [];
    const data = (await resp.json()) as {
      results?: Array<{
        id?: string;
        doi?: string;
        title?: string;
        publication_year?: number;
        primary_location?: { source?: { display_name?: string } };
        authorships?: Array<{ author?: { display_name?: string } }>;
        abstract_inverted_index?: Record<string, number[]>;
      }>;
    };
    return (data.results || [])
      .map((work) => {
        const title = (work.title || '').trim();
        if (!title) return null;
        const abstract = reconstructOpenAlexAbstract(work.abstract_inverted_index);
        const author = work.authorships?.[0]?.author?.display_name || '';
        const venue = work.primary_location?.source?.display_name || '';
        const corpusText = `${title}. ${abstract}`.trim();
        const tokens = normalizeWords(corpusText);
        return {
          key: `openalex:${work.doi || work.id || title.toLowerCase()}`,
          title,
          authorOrVenue: [author, venue].filter(Boolean).join(' · ') || 'OpenAlex Scholarly Index',
          year: work.publication_year ? String(work.publication_year) : undefined,
          url: work.doi || work.id || 'https://openalex.org',
          sourceType: 'academic_repo' as const,
          corpusText,
          corpusTokens: new Set(tokens.filter((t) => !COMMON_STOPWORDS.has(t))),
          corpusTrigrams: buildTrigrams(tokens),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  } catch {
    return [];
  }
}

async function queryWikipediaForSentence(
  query: string,
  isVietnamese: boolean
): Promise<ExternalCandidateSource[]> {
  if (!query) return [];
  try {
    const lang = isVietnamese ? 'vi' : 'en';
    const url = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      query
    )}&utf8=&format=json&srlimit=2`;
    const resp = await fetch(url, {
      headers: POLITE_HEADERS,
      signal: AbortSignal.timeout(4000),
    });
    if (!resp.ok) return [];
    const data = (await resp.json()) as {
      query?: {
        search?: Array<{
          pageid?: number;
          title?: string;
          snippet?: string;
        }>;
      };
    };
    return (data.query?.search || [])
      .map((item) => {
        const title = (item.title || '').trim();
        if (!title) return null;
        const snippet = stripHtmlTags(item.snippet || '');
        const corpusText = `${title}. ${snippet}`.trim();
        const tokens = normalizeWords(corpusText);
        return {
          key: `wiki:${lang}:${item.pageid || title.toLowerCase()}`,
          title: `${title} — Wikipedia (${lang.toUpperCase()})`,
          authorOrVenue: `${lang}.wikipedia.org`,
          url: `https://${lang}.wikipedia.org/?curid=${item.pageid || ''}`,
          sourceType: 'internet' as const,
          corpusText,
          corpusTokens: new Set(tokens.filter((t) => !COMMON_STOPWORDS.has(t))),
          corpusTrigrams: buildTrigrams(tokens),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  } catch {
    return [];
  }
}

function computeSentenceSourceSimilarity(
  sentence: string,
  source: ExternalCandidateSource
): number {
  const tokens = normalizeWords(sentence);
  if (tokens.length < 5) return 0;

  const contentTokens = tokens.filter(
    (t) => t.length >= 3 && !COMMON_STOPWORDS.has(t)
  );
  if (contentTokens.length === 0) return 0;

  let matchedContentCount = 0;
  for (const tok of contentTokens) {
    if (source.corpusTokens.has(tok)) {
      matchedContentCount += 1;
    }
  }
  const tokenCoverage = matchedContentCount / contentTokens.length;

  const sentTrigrams = buildTrigrams(tokens);
  let trigramMatches = 0;
  if (sentTrigrams.size > 0 && source.corpusTrigrams.size > 0) {
    for (const tg of sentTrigrams) {
      if (source.corpusTrigrams.has(tg)) {
        trigramMatches += 1;
      }
    }
  }
  const trigramCoverage =
    sentTrigrams.size > 0 ? trigramMatches / sentTrigrams.size : 0;

  // Weighted similarity percentage (0..100)
  const rawScore = trigramCoverage * 75 + tokenCoverage * 45;
  return Math.min(100, Math.round(rawScore));
}

export async function analyzeDocumentIntegrity(
  rawText: string,
  options: IntegrityCheckOptions = {}
): Promise<IntegrityAnalysisReport> {
  const excludeReferences = options.excludeReferences !== false;
  const excludeQuotes = options.excludeQuotes !== false;
  const trimmedText = rawText.trim();
  const title = (options.title || '').trim() || 'Tài liệu kiểm định học thuật';

  const paragraphs = trimmedText
    .split(/\r?\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  let inReferenceSection = false;
  const parsedSentences: AnalyzedSentence[] = [];
  const paragraphSentenceLengths: number[][] = [];

  paragraphs.forEach((para, pIdx) => {
    if (isReferenceSectionHeading(para)) {
      inReferenceSection = true;
    }

    const sents = splitParagraphIntoSentences(para);
    const lengthsInPara: number[] = [];

    sents.forEach((sentText, sIdx) => {
      const wc = countWords(sentText);
      const isExcludedRef = excludeReferences && inReferenceSection;
      const isExcludedQ = excludeQuotes && !isExcludedRef && isMostlyQuotedSentence(sentText);

      if (!isExcludedRef && !isExcludedQ && wc >= 4) {
        lengthsInPara.push(wc);
      }

      parsedSentences.push({
        id: `p${pIdx}_s${sIdx}`,
        paragraphIndex: pIdx,
        sentenceIndex: sIdx,
        text: sentText,
        wordCount: wc,
        isExcludedReference: isExcludedRef,
        isExcludedQuote: isExcludedQ,
        matchedSourceId: null,
        matchSimilarity: 0,
        aiProbability: 0,
        aiLevel: 'human',
        aiReasons: [],
      });
    });

    paragraphSentenceLengths.push(lengthsInPara);
  });

  const activeSentences = parsedSentences.filter(
    (s) => !s.isExcludedReference && !s.isExcludedQuote && s.wordCount >= 5
  );

  // --- 1. Plagiarism Source Retrieval via OpenAlex, Crossref, and Wikipedia ---
  const isVietnameseDoc =
    /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(
      trimmedText
    );

  // Select up to 6 informative sentences evenly spaced across active prose
  const candidateProbes: AnalyzedSentence[] = [];
  if (activeSentences.length > 0) {
    const eligible = activeSentences.filter((s) => s.wordCount >= 8);
    const pool = eligible.length > 0 ? eligible : activeSentences;
    const step = Math.max(1, Math.floor(pool.length / 6));
    for (let i = 0; i < pool.length && candidateProbes.length < 6; i += step) {
      candidateProbes.push(pool[i]);
    }
  }

  const externalPoolMap = new Map<string, ExternalCandidateSource>();
  if (candidateProbes.length > 0) {
    const queryPromises = candidateProbes.flatMap((probe) => {
      const kw = buildSearchKeywords(probe.text);
      return [
        queryCrossrefForSentence(kw),
        queryOpenAlexForSentence(kw),
        queryWikipediaForSentence(kw, isVietnameseDoc),
      ];
    });

    const settled = await Promise.allSettled(queryPromises);
    for (const res of settled) {
      if (res.status !== 'fulfilled') continue;
      for (const src of res.value) {
        if (!externalPoolMap.has(src.key)) {
          externalPoolMap.set(src.key, src);
        }
      }
    }
  }

  const externalCandidates = Array.from(externalPoolMap.values());

  // Match every active sentence against retrieved external sources
  const sourceMatchesMap = new Map<
    string,
    {
      source: ExternalCandidateSource;
      sentenceIds: string[];
      matchedWordCount: number;
      sampleSnippet: string;
    }
  >();

  for (const sent of activeSentences) {
    let bestCandidate: ExternalCandidateSource | null = null;
    let bestScore = 0;

    for (const cand of externalCandidates) {
      const score = computeSentenceSourceSimilarity(sent.text, cand);
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = cand;
      }
    }

    if (bestCandidate && bestScore >= 32) {
      sent.matchSimilarity = bestScore;
      sent.matchedSnippet = bestCandidate.corpusText.slice(0, 220);

      const existing = sourceMatchesMap.get(bestCandidate.key) || {
        source: bestCandidate,
        sentenceIds: [],
        matchedWordCount: 0,
        sampleSnippet: bestCandidate.corpusText.slice(0, 220),
      };
      existing.sentenceIds.push(sent.id);
      existing.matchedWordCount += sent.wordCount;
      sourceMatchesMap.set(bestCandidate.key, existing);
    }
  }

  const analyzedWords = Math.max(
    1,
    parsedSentences
      .filter((s) => !s.isExcludedReference && !s.isExcludedQuote)
      .reduce((sum, s) => sum + s.wordCount, 0)
  );

  // Rank matched sources and assign numeric IDs (1, 2, 3...)
  const sortedSourceEntries = Array.from(sourceMatchesMap.values())
    .sort((a, b) => b.matchedWordCount - a.matchedWordCount)
    .slice(0, 12);

  const sources: MatchedSourceItem[] = sortedSourceEntries.map((entry, idx) => {
    const id = idx + 1;
    const badgeColor = SOURCE_BADGE_COLORS[idx % SOURCE_BADGE_COLORS.length];
    const simPercent = Math.max(
      1,
      Math.min(100, Math.round((entry.matchedWordCount / analyzedWords) * 100))
    );

    // Bind matchedSourceId back to sentences
    const idSet = new Set(entry.sentenceIds);
    for (const s of parsedSentences) {
      if (idSet.has(s.id)) {
        s.matchedSourceId = id;
      }
    }

    return {
      id,
      badgeColor,
      title: entry.source.title,
      authorOrVenue: entry.source.authorOrVenue,
      year: entry.source.year,
      url: entry.source.url,
      sourceType: entry.source.sourceType,
      matchedSentenceCount: entry.sentenceIds.length,
      matchedWordCount: entry.matchedWordCount,
      similarityPercent: simPercent,
      sampleSnippet: entry.sampleSnippet,
    };
  });

  const totalMatchedWords = parsedSentences
    .filter((s) => s.matchedSourceId !== null)
    .reduce((sum, s) => sum + s.wordCount, 0);

  const pubMatchedWords = parsedSentences
    .filter((s) => {
      if (s.matchedSourceId === null) return false;
      const src = sources.find((item) => item.id === s.matchedSourceId);
      return src && src.sourceType !== 'internet';
    })
    .reduce((sum, s) => sum + s.wordCount, 0);

  const netMatchedWords = parsedSentences
    .filter((s) => {
      if (s.matchedSourceId === null) return false;
      const src = sources.find((item) => item.id === s.matchedSourceId);
      return src && src.sourceType === 'internet';
    })
    .reduce((sum, s) => sum + s.wordCount, 0);

  const overallSimilarityPercent = Math.min(
    100,
    Math.round((totalMatchedWords / analyzedWords) * 100)
  );
  const publicationsSimilarityPercent = Math.min(
    100,
    Math.round((pubMatchedWords / analyzedWords) * 100)
  );
  const internetSimilarityPercent = Math.min(
    100,
    Math.round((netMatchedWords / analyzedWords) * 100)
  );

  // --- 2. Linguistic AI Forensics Engine ---
  const allSentenceLengths = activeSentences.map((s) => s.wordCount);
  const avgLen =
    allSentenceLengths.length > 0
      ? allSentenceLengths.reduce((a, b) => a + b, 0) / allSentenceLengths.length
      : 0;
  const variance =
    allSentenceLengths.length > 1
      ? allSentenceLengths.reduce((acc, l) => acc + Math.pow(l - avgLen, 2), 0) /
        allSentenceLengths.length
      : 0;
  const stdDev = Math.sqrt(variance);

  // Burstiness: humans vary sentence lengths sharply (stdDev >= 8-12); AI tends to stay uniform (stdDev 3-6)
  const burstinessScore = Math.max(
    5,
    Math.min(100, Math.round((stdDev / Math.max(8, avgLen * 0.55)) * 100))
  );

  // Lexical diversity (Type-Token Ratio adjusted for length)
  const activeWordTokens = normalizeWords(
    activeSentences.map((s) => s.text).join(' ')
  );
  const uniqueTokens = new Set(activeWordTokens);
  const rawTtr =
    activeWordTokens.length > 0
      ? uniqueTokens.size / Math.sqrt(activeWordTokens.length * 2)
      : 0.5;
  const lexicalDiversityScore = Math.max(
    10,
    Math.min(100, Math.round(rawTtr * 85))
  );

  const phraseCounts = new Map<
    string,
    { count: number; category: DetectedAiPhrase['category'] }
  >();

  let totalPhraseHits = 0;

  for (const sent of parsedSentences) {
    if (sent.isExcludedReference || sent.isExcludedQuote || sent.wordCount < 4) {
      continue;
    }

    let aiScore = 18; // baseline neutral prior
    const reasons: string[] = [];

    // Factor A: AI Fingerprint Phrases
    for (const pat of AI_PHRASE_PATTERNS) {
      const matches = sent.text.match(pat.regex);
      if (matches && matches.length > 0) {
        totalPhraseHits += matches.length;
        const prev = phraseCounts.get(pat.phrase) || {
          count: 0,
          category: pat.category,
        };
        prev.count += matches.length;
        phraseCounts.set(pat.phrase, prev);

        aiScore += pat.weight;
        reasons.push(`Chứa cụm từ khuôn mẫu thường gặp ở AI: "${pat.phrase}"`);
      }
    }

    // Factor B: Local Paragraph Uniformity (low local burstiness)
    const paraLens = paragraphSentenceLengths[sent.paragraphIndex] || [];
    if (paraLens.length >= 3) {
      const pMean = paraLens.reduce((a, b) => a + b, 0) / paraLens.length;
      const pStd = Math.sqrt(
        paraLens.reduce((a, b) => a + Math.pow(b - pMean, 2), 0) / paraLens.length
      );
      if (pStd < 3.8 && sent.wordCount >= 14) {
        aiScore += 22;
        reasons.push(
          `Độ dài các câu trong đoạn quá đồng đều (độ lệch chuẩn ${pStd.toFixed(
            1
          )} từ — Burstiness thấp)`
        );
      } else if (pStd >= 8.5) {
        aiScore -= 14;
      }
    }

    // Factor C: Balanced medium-long clause structure typical of LLM output (18-30 words with comma-semicolon cadence)
    const commaCount = (sent.text.match(/,/g) || []).length;
    if (sent.wordCount >= 18 && sent.wordCount <= 34 && commaCount >= 2) {
      aiScore += 14;
      reasons.push('Nhịp câu phân tách mệnh đề cân đối đặc trưng của mô hình ngôn ngữ');
    }

    // Factor D: Personal voice / informal markers / specific parenthetical years lower AI likelihood
    if (/\b(19|20)\d{2}[a-z]?\b/.test(sent.text) && /\([^)]+\)/.test(sent.text)) {
      aiScore -= 8;
    }
    if (sent.wordCount <= 8) {
      aiScore -= 10;
    }

    // Factor E: Global document low burstiness amplifies suspicion
    if (burstinessScore < 42 && sent.wordCount >= 14) {
      aiScore += 12;
      if (reasons.length === 0) {
        reasons.push('Nhịp điệu toàn bài đồng nhất cao (thiếu biến thiên độ dài câu tự nhiên)');
      }
    }

    const clampedScore = Math.max(2, Math.min(98, Math.round(aiScore)));
    sent.aiProbability = clampedScore;
    if (clampedScore >= 65) {
      sent.aiLevel = 'ai_high';
    } else if (clampedScore >= 38) {
      sent.aiLevel = 'mixed';
    } else {
      sent.aiLevel = 'human';
    }
    sent.aiReasons =
      reasons.length > 0
        ? reasons
        : clampedScore >= 38
        ? ['Cấu trúc ngữ pháp và mật độ từ vựng mang tính chuẩn hóa cao']
        : ['Biến thiên cấu trúc và cách diễn đạt tự nhiên'];
  }

  const aiWeightedSum = activeSentences.reduce(
    (sum, s) => sum + s.aiProbability * s.wordCount,
    0
  );
  const activeAiWordTotal = Math.max(
    1,
    activeSentences.reduce((sum, s) => sum + s.wordCount, 0)
  );
  const overallAiPercent = Math.min(
    100,
    Math.round(aiWeightedSum / activeAiWordTotal)
  );

  const highAiSentenceCount = activeSentences.filter(
    (s) => s.aiLevel === 'ai_high'
  ).length;
  const mixedAiSentenceCount = activeSentences.filter(
    (s) => s.aiLevel === 'mixed'
  ).length;
  const humanSentenceCount = activeSentences.filter(
    (s) => s.aiLevel === 'human'
  ).length;

  const detectedAiPhrases: DetectedAiPhrase[] = Array.from(phraseCounts.entries())
    .map(([phrase, meta]) => ({
      phrase,
      count: meta.count,
      category: meta.category,
    }))
    .sort((a, b) => b.count - a.count);

  const structuralUniformityScore = Math.max(
    5,
    Math.min(100, 100 - burstinessScore)
  );
  const aiPhraseDensityScore = Math.min(
    100,
    Math.round((totalPhraseHits / Math.max(1, activeSentences.length / 2.5)) * 100)
  );

  return {
    reportId: `CHK-${Date.now().toString(36).toUpperCase()}`,
    analyzedAt: new Date().toISOString(),
    title,
    totalWords: countWords(trimmedText),
    analyzedWords,
    totalSentences: parsedSentences.length,
    totalCharacters: trimmedText.length,
    overallSimilarityPercent,
    publicationsSimilarityPercent,
    internetSimilarityPercent,
    overallAiPercent,
    forensics: {
      burstinessScore,
      lexicalDiversityScore,
      structuralUniformityScore,
      aiPhraseDensityScore,
      avgSentenceLengthWords: Number(avgLen.toFixed(1)),
      sentenceLengthStdDev: Number(stdDev.toFixed(1)),
      highAiSentenceCount,
      mixedAiSentenceCount,
      humanSentenceCount,
    },
    detectedAiPhrases,
    sources,
    sentences: parsedSentences,
  };
}
