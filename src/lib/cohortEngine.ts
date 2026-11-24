import { CitationStyle } from '../types/domain';
import {
  CoverPageTemplateId,
  FontFamilyOption,
  LineSpacingOption,
  TextAlignmentOption,
  WriterSession,
} from '../components/admin/writer/types';
import { extractInTextCitations, isReferencesSectionTitle } from './aiWriterClient';
import { countWords } from './wordHumanizer';

export interface CohortPoolSourceItem {
  doi: string;
  title: string;
  authors: Array<{ family: string; given?: string }>;
  year: number;
  containerTitle: string;
  volume?: string;
  issue?: string;
  page?: string;
  publisher?: string;
}

export interface CohortStructuralArchetype {
  id: string;
  label: string;
  shortTag: string;
  outlineDirectiveEn: string;
  outlineDirectiveVi: string;
  proseDirectiveEn: string;
  proseDirectiveVi: string;
  fontEn: FontFamilyOption;
  fontSizeEn: number;
  lineSpacingEn: LineSpacingOption;
  alignEn: TextAlignmentOption;
  coverTemplate: CoverPageTemplateId;
  wordJitterRatio: number;
}

export const COHORT_STRUCTURAL_ARCHETYPES: CohortStructuralArchetype[] = [
  {
    id: 'deductive_theoretical',
    label: 'Lăng kính Lý thuyết → Kiểm chứng Thực nghiệm',
    shortTag: 'Bản A · Deductive',
    outlineDirectiveEn:
      'Organize the paper deductively: open with conceptual definitions and theoretical foundations first, then test those propositions against empirical industry evidence, followed by operational trade-offs and targeted managerial actions. Coin specific, concrete noun-phrase headings (avoid generic boilerplate headings like "Literature Review" or "Main Body").',
    outlineDirectiveVi:
      'Tổ chức dàn ý theo hướng diễn dịch từ khung lý thuyết cốt lõi xuống đối chiếu dữ liệu thực tiễn, sau đó phân tích các đánh đổi vận hành và giải pháp trọng tâm. Đặt tiêu đề chương/mục cụ thể sát nội dung phân tích, tránh rập khuôn máy móc.',
    proseDirectiveEn:
      'Lead paragraphs with analytical claims anchored in narrative citations (e.g., "Author (Year) demonstrates that..."). Favor medium-to-crisp sentence cadence with concrete operational mechanisms.',
    proseDirectiveVi:
      'Mở đoạn bằng luận điểm phân tích trực diện gắn với trích dẫn tường thuật (VD: "Theo Nghiên cứu của X (Năm)..."), nhịp câu dứt khoát, tập trung phân tích cơ chế vận hành.',
    fontEn: 'Times New Roman',
    fontSizeEn: 12,
    lineSpacingEn: 2.0,
    alignEn: 'left',
    coverTemplate: 'academic_international',
    wordJitterRatio: 1.0,
  },
  {
    id: 'diagnostic_problem_led',
    label: 'Lăng kính Chẩn đoán Nút thắt & Hệ quả',
    shortTag: 'Bản B · Diagnostic',
    outlineDirectiveEn:
      'Structure the paper around problem diagnosis: frame the opening around practical market/organizational tensions, organize middle sections by root-cause diagnostic dimensions and empirical performance gaps, and conclude with a prioritized intervention matrix. Phrase all H1/H2 headings using diagnostic or causal terminology completely distinct from a textbook chapter list.',
    outlineDirectiveVi:
      'Xây dựng dàn ý theo hướng chẩn đoán vấn đề thực tiễn: đi từ mâu thuẫn/nút thắt hiện hữu, mổ xẻ nguyên nhân gốc rễ qua các chiều kích đánh giá, rồi đề xuất lộ trình can thiệp theo thứ tự ưu tiên.',
    proseDirectiveEn:
      'Open paragraphs with empirical observations or concrete tensions before synthesizing parenthetical citations at clause end (e.g., "... (Author, Year; Author, Year)"). Vary short punchy sentences against compound analytical clauses.',
    proseDirectiveVi:
      'Mở đoạn từ hiện tượng thực tế hoặc con số đối chứng rồi mới lồng trích dẫn cuối mệnh đề, kết hợp câu ngắn nhấn ý xen kẽ câu ghép phân tích nguyên nhân – hệ quả.',
    fontEn: 'Calibri',
    fontSizeEn: 11,
    lineSpacingEn: 1.5,
    alignEn: 'justify',
    coverTemplate: 'modern_executive',
    wordJitterRatio: 1.03,
  },
  {
    id: 'stakeholder_governance',
    label: 'Lăng kính Đa bên Liên quan & Quản trị Rủi ro',
    shortTag: 'Bản C · Stakeholder',
    outlineDirectiveEn:
      'Organize the outline through institutional, stakeholder, and risk-governance lenses: examine how internal actors, external regulators/customers, and resource constraints interact, followed by comparative evaluation and risk-adjusted implementation steps. Use active, domain-specific section titles.',
    outlineDirectiveVi:
      'Triển khai dàn ý theo góc nhìn các bên liên quan và quản trị rủi ro: phân tích sự tương tác giữa nội lực tổ chức, khách hàng/thị trường và rào cản nguồn lực trước khi đưa ra giải pháp kiểm soát.',
    proseDirectiveEn:
      'Emphasize comparative contrasts across stakeholder groups and organizational contexts. Mix synthesis citations across multiple scholars and ground every recommendation in a concrete boundary condition.',
    proseDirectiveVi:
      'Nhấn mạnh phép đối chiếu giữa các nhóm đối tượng và điều kiện áp dụng thực tế; tổng hợp chéo nhiều nguồn học thuật trong cùng lập luận một cách tự nhiên.',
    fontEn: 'Georgia',
    fontSizeEn: 11.5,
    lineSpacingEn: 1.5,
    alignEn: 'left',
    coverTemplate: 'academic_international',
    wordJitterRatio: 0.98,
  },
  {
    id: 'comparative_dialectical',
    label: 'Lăng kính Đối chứng Hai Chiều & Phản biện',
    shortTag: 'Bản D · Dialectical',
    outlineDirectiveEn:
      'Design a dialectical, critical-evaluation outline: structure body chapters around competing scholarly schools of thought, methodological limitations, and real-world boundary tests before synthesizing a contingent strategic pathway. Ensure zero generic single-word headings.',
    outlineDirectiveVi:
      'Thiết kế dàn ý theo lối phản biện đối chứng: đặt các luồng quan điểm học thuật cạnh nhau, chỉ rõ giới hạn áp dụng thực tế rồi mới tổng hợp hướng giải quyết phù hợp bối cảnh.',
    proseDirectiveEn:
      'Foreground critical tension and scope conditions (when a framework works vs. when it breaks down). Alternate evidence-first openings with methodological critique.',
    proseDirectiveVi:
      'Đặt trọng tâm vào phân tích giới hạn và điều kiện biên của từng giải pháp, tránh lối liệt kê một chiều, giọng văn điềm tĩnh khách quan.',
    fontEn: 'Cambria',
    fontSizeEn: 12,
    lineSpacingEn: 2.0,
    alignEn: 'justify',
    coverTemplate: 'modern_executive',
    wordJitterRatio: 1.04,
  },
  {
    id: 'value_chain_process',
    label: 'Lăng kính Chuỗi Giá trị & Tiến trình Vận hành',
    shortTag: 'Bản E · Process',
    outlineDirectiveEn:
      'Map the outline chronologically or along the operational value chain (upstream inputs/drivers → core transformation mechanisms → downstream outcomes & KPI measurement → capability building). Use crisp process-oriented headings.',
    outlineDirectiveVi:
      'Chia bố cục theo chuỗi giá trị hoặc tiến trình vận hành (đầu vào & động lực → cơ chế chuyển hóa cốt lõi → kết quả đầu ra & đo lường hiệu quả → kiện toàn năng lực).',
    proseDirectiveEn:
      'Focus on causal mechanisms, workflow linkages, and measurable indicators. Keep transitions direct and concrete without formulaic signposting.',
    proseDirectiveVi:
      'Tập trung làm rõ mối liên kết nhân quả giữa các khâu thực thi và chỉ tiêu đo lường cụ thể, chuyển ý tự nhiên không dùng khuôn sáo.',
    fontEn: 'Arial',
    fontSizeEn: 11,
    lineSpacingEn: 1.5,
    alignEn: 'left',
    coverTemplate: 'academic_international',
    wordJitterRatio: 0.97,
  },
  {
    id: 'capability_resource_view',
    label: 'Lăng kính Nguồn lực Nội tại & Thích ứng Dài hạn',
    shortTag: 'Bản F · Capability',
    outlineDirectiveEn:
      'Frame the outline around organizational capabilities, dynamic adaptation, and structural constraints: evaluate internal capability readiness, external environmental shifts, empirical case lessons, and staged capability upgrades.',
    outlineDirectiveVi:
      'Tổ chức dàn ý xoay quanh năng lực nội tại và khả năng thích ứng dài hạn trước biến động môi trường, kết hợp bài học thực nghiệm và lộ trình nâng cấp theo giai đoạn.',
    proseDirectiveEn:
      'Anchor arguments in resource allocation, organizational learning, and long-horizon sustainability. Use varied clause lengths and grounded examples.',
    proseDirectiveVi:
      'Lập luận xoay quanh bài toán phân bổ nguồn lực, tính khả thi tài chính – nhân sự và hiệu quả bền vững dài hạn.',
    fontEn: 'Times New Roman',
    fontSizeEn: 12,
    lineSpacingEn: 1.5,
    alignEn: 'justify',
    coverTemplate: 'classic_vn_thesis',
    wordJitterRatio: 1.02,
  },
];

const INSTITUTION_RX =
  /\b(?:university|faculty|ministry|department|institute|association|organization|organisation|center|centre|council|board|commission|committee|office|agency|bank|academy|foundation|society|world|united|national|international|who|oecd|unesco|unicef|imf)\b/i;

function cleanXmlEntities(raw?: string): string {
  return (raw || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAuthorEntry(a: {
  family?: string;
  given?: string;
  name?: string;
}): { family: string; given?: string } {
  const rawFamily = cleanXmlEntities(a.family || a.name || '');
  const rawGiven = cleanXmlEntities(a.given || '');
  if (rawGiven) return { family: rawFamily, given: rawGiven };
  const parts = rawFamily.split(/\s+/).filter(Boolean);
  if (parts.length === 2 && !INSTITUTION_RX.test(rawFamily)) {
    return { given: parts[0], family: parts[1] };
  }
  return { family: rawFamily };
}

function formatInitials(given?: string): string {
  if (!given) return '';
  return given
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}.`)
    .join(' ');
}

export function formatPoolSourceInText(
  work: CohortPoolSourceItem,
  style: CitationStyle
): string {
  const fams = work.authors.map((a) => a.family).filter(Boolean);
  if (fams.length === 0) return `(${work.year})`;
  if (fams.length === 1) return `(${fams[0]}, ${work.year})`;
  if (fams.length === 2) {
    const conj = style === 'APA' ? '&' : 'and';
    return `(${fams[0]} ${conj} ${fams[1]}, ${work.year})`;
  }
  return `(${fams[0]} et al., ${work.year})`;
}

export function formatPoolSourceFullRef(
  work: CohortPoolSourceItem,
  style: CitationStyle
): string {
  const doiUrl = `https://doi.org/${work.doi}`;
  const authorStrings = work.authors.map((a) => {
    const init = formatInitials(a.given);
    return init ? `${a.family}, ${init}` : a.family;
  });

  let authorBlock = '';
  if (authorStrings.length === 1) {
    authorBlock = authorStrings[0];
  } else if (authorStrings.length === 2) {
    authorBlock =
      style === 'APA'
        ? `${authorStrings[0]}, & ${authorStrings[1]}`
        : `${authorStrings[0]} and ${authorStrings[1]}`;
  } else if (authorStrings.length > 2) {
    const head = authorStrings.slice(0, -1).join(', ');
    const last = authorStrings[authorStrings.length - 1];
    authorBlock = style === 'APA' ? `${head}, & ${last}` : `${head} and ${last}`;
  }

  const volIssue = work.volume
    ? work.issue
      ? `${work.volume}(${work.issue})`
      : work.volume
    : '';
  const pages = work.page ? `, ${work.page}` : '';

  if (style === 'Harvard') {
    return `${authorBlock} (${work.year}) '${work.title}', ${work.containerTitle}${
      volIssue ? `, ${volIssue}` : ''
    }${work.page ? `, pp. ${work.page}` : ''}. doi: ${work.doi}.`;
  }

  if (style === 'MLA') {
    const first = work.authors[0];
    const mlaAuthor =
      work.authors.length > 1
        ? `${first.family}, ${first.given || ''}, et al.`
        : `${first.family}, ${first.given || ''}.`;
    return `${mlaAuthor.replace(/\.\.$/, '.')} "${work.title}." ${
      work.containerTitle
    }${work.volume ? `, vol. ${work.volume}` : ''}${
      work.issue ? `, no. ${work.issue}` : ''
    }, ${work.year}${work.page ? `, pp. ${work.page}` : ''}, ${doiUrl}.`;
  }

  // APA 7 default
  return `${authorBlock} (${work.year}). ${work.title}. ${work.containerTitle}${
    volIssue ? `, ${volIssue}` : ''
  }${pages}. ${doiUrl}`;
}

async function queryCrossrefSlice(
  queryStr: string,
  rows: number,
  fromYear: number,
  signal?: AbortSignal
): Promise<CohortPoolSourceItem[]> {
  if (!queryStr.trim()) return [];
  const params = new URLSearchParams({
    'query.bibliographic': queryStr.trim().slice(0, 220),
    filter: `type:journal-article,from-pub-date:${fromYear}`,
    rows: String(rows),
    sort: 'relevance',
    select:
      'DOI,title,author,issued,published,container-title,volume,issue,page,publisher',
  });

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 9000);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);

  try {
    const res = await fetch(
      `https://api.crossref.org/works?${params.toString()}`,
      {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      message?: {
        items?: Array<{
          DOI?: string;
          title?: string[];
          author?: Array<{ family?: string; given?: string; name?: string }>;
          issued?: { 'date-parts'?: number[][] };
          published?: { 'date-parts'?: number[][] };
          'container-title'?: string[];
          volume?: string;
          issue?: string;
          page?: string;
          publisher?: string;
        }>;
      };
    };

    const parsed: CohortPoolSourceItem[] = [];
    for (const it of data?.message?.items || []) {
      const authors = (it.author || [])
        .map(normalizeAuthorEntry)
        .filter((a) => Boolean(a.family));
      const title = cleanXmlEntities(it.title?.[0]);
      const containerTitle = cleanXmlEntities(it['container-title']?.[0]);
      const year =
        it.issued?.['date-parts']?.[0]?.[0] ||
        it.published?.['date-parts']?.[0]?.[0] ||
        0;
      const doi = (it.DOI || '').trim();
      if (
        authors.length === 0 ||
        !title ||
        title.length < 15 ||
        !containerTitle ||
        !year ||
        year < 1995 ||
        !doi
      ) {
        continue;
      }
      parsed.push({
        doi,
        title,
        authors,
        year,
        containerTitle,
        volume: it.volume,
        issue: it.issue,
        page: it.page,
        publisher: it.publisher,
      });
    }
    return parsed;
  } catch {
    return [];
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/**
 * Fetches a rich Master Pool (30-45 real peer-reviewed CrossRef works) for a shared
 * class assignment so each classmate clone can randomly draw `K` (e.g. 15) sources
 * with natural, realistic classroom overlap rather than rigid artificial partitioning.
 */
export async function fetchCohortMasterCrossrefPool(
  baseSession: WriterSession,
  signal?: AbortSignal
): Promise<CohortPoolSourceItem[]> {
  const topic = (baseSession.topic || baseSession.title || '').trim();
  const subject = (baseSession.subject || '').trim();
  const extraKeywords = `${baseSession.instructions || ''} ${baseSession.rubricNotes || ''}`
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);

  const primaryQuery = `${topic} ${subject}`.trim();
  const secondaryQuery = extraKeywords
    ? `${subject} ${extraKeywords}`.trim()
    : `${topic} empirical framework analysis`.trim();

  const [batchA, batchB] = await Promise.all([
    queryCrossrefSlice(primaryQuery, 35, 2018, signal),
    queryCrossrefSlice(secondaryQuery, 28, 2016, signal),
  ]);

  const merged: CohortPoolSourceItem[] = [];
  const seenDois = new Set<string>();
  const seenAuthorYear = new Set<string>();

  for (const work of [...batchA, ...batchB]) {
    const doiKey = work.doi.toLowerCase();
    const firstFam = (work.authors[0]?.family || '').toLowerCase();
    const ayKey = `${firstFam}_${work.year}`;
    if (seenDois.has(doiKey) || seenAuthorYear.has(ayKey)) continue;
    seenDois.add(doiKey);
    // Avoid ambiguous same-surname-same-year collisions inside one bibliography
    seenAuthorYear.add(ayKey);
    merged.push(work);
    if (merged.length >= 45) break;
  }

  return merged;
}

function cryptoRandomShuffle<T>(items: T[]): T[] {
  const copy = [...items];
  const randBuf = new Uint32Array(copy.length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randBuf);
  } else {
    for (let i = 0; i < copy.length; i++) {
      randBuf[i] = Math.floor(Math.random() * 0xffffffff);
    }
  }
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randBuf[i] % (i + 1);
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

/**
 * Randomly draws `sourcesPerPaper` (e.g. 15) sources from the shared Master Pool
 * in a freshly shuffled order for one student's paper.
 */
export function buildRandomSampledDossierForClone(
  masterPool: CohortPoolSourceItem[],
  citationStyle: CitationStyle,
  sourcesPerPaper: number,
  sharedWebAppendix = ''
): { dossier: string; sampledCount: number } {
  const safeTarget = Math.max(5, Math.min(30, sourcesPerPaper || 15));
  const sampled = cryptoRandomShuffle(masterPool).slice(0, safeTarget);

  const crossrefBlock =
    sampled.length > 0
      ? `=== VERIFIED CROSSREF ACADEMIC SOURCES (RANDOMLY SAMPLED FOR THIS STUDENT: ${sampled.length} REAL PEER-REVIEWED WORKS — COMPLETE AUTHOR, YEAR, TITLE, JOURNAL, DOI) ===\n` +
        sampled
          .map((w, idx) => {
            const inText = formatPoolSourceInText(w, citationStyle);
            const fullRef = formatPoolSourceFullRef(w, citationStyle);
            return `[S${idx + 1}] In-Text: ${inText}\n    Full ${citationStyle}: ${fullRef}`;
          })
          .join('\n')
      : '';

  const combined = [crossrefBlock, sharedWebAppendix.trim()]
    .filter(Boolean)
    .join('\n\n')
    .trim();

  return {
    dossier: combined,
    sampledCount: sampled.length,
  };
}

/**
 * Builds the strict anti-cross-similarity instruction block injected into BOTH
 * Outline Generation and Section Prose Writing for Cohort Clones.
 */
export function buildCohortAntiSimilarityPromptBlock(
  session: WriterSession,
  mode: 'outline' | 'body'
): string {
  const meta = session.cohortMeta;
  if (!meta) return '';

  const archetype =
    COHORT_STRUCTURAL_ARCHETYPES.find((a) => a.id === meta.archetypeId) ||
    COHORT_STRUCTURAL_ARCHETYPES[
      (Math.max(1, meta.cloneIndex) - 1) % COHORT_STRUCTURAL_ARCHETYPES.length
    ];

  const isVi = session.writingLanguage === 'Vietnamese';
  const focusInstruction = meta.customCaseFocus?.trim()
    ? isVi
      ? `- GÓC NHÌN / VÍ DỤ ĐỘC QUYỀN CỦA BẢN NÀY: Tập trung phân tích sâu ví dụ/tình huống "${meta.customCaseFocus.trim()}" làm minh chứng chủ đạo xuyên suốt bài.`
      : `- EXCLUSIVE CASE / EMPIRICAL FOCUS FOR THIS STUDENT: Anchor empirical illustrations and applied examples specifically around "${meta.customCaseFocus.trim()}".`
    : isVi
    ? `- PHÂN NHÁNH VÍ DỤ ĐỘC LẬP (Bản #${meta.cloneIndex}/${meta.cohortSize}): Không chọn ví dụ doanh nghiệp đầu bảng quá phổ biến mà các bạn cùng lớp hay lấy giống nhau; hãy chọn bối cảnh/ví dụ minh họa đặc thù theo lăng kính số #${meta.cloneIndex}.`
    : `- INDEPENDENT EMPIRICAL ILLUSTRATION (Student Paper #${meta.cloneIndex} of ${meta.cohortSize}): Avoid cliché default textbook company examples when the brief allows open examples; select distinct real-world cases aligned with Analytical Lens #${meta.cloneIndex}.`;

  if (isVi) {
    return `\n\n=== CHẾ ĐỘ ĐA HÌNH CÙNG LỚP — CHỐNG ĐỤNG TURNITIN SIMILARITY CHÉO (BẢN #${meta.cloneIndex}/${meta.cohortSize}: ${archetype.label}) ===
Bài này thuộc nhóm ${meta.cohortSize} sinh viên học CÙNG MỘT LỚP nộp chung hệ thống quét chéo Turnitin. Danh mục nguồn trích dẫn có thể giao thoa tự nhiên từ bể nguồn chung, NHƯNG VĂN BẢN THÂN BÀI VÀ ĐỀ MỤC TUYỆT ĐỐI KHÔNG ĐƯỢC TRÙNG CỤM TỪ LIÊN TIẾP (>= 5 TỪ) VỚI BÀI KHÁC:
1. LĂNG KÍNH BỐ CỤC RIÊNG: ${mode === 'outline' ? archetype.outlineDirectiveVi : archetype.proseDirectiveVi}
2. CẤM SAO CHÉP NGUYÊN VĂN CÂU ĐỀ BÀI: Tuyệt đối không lặp lại nguyên xi câu hỏi trong đề bài hoặc tên tiêu chí Rubric dài quá 4 từ liên tiếp làm câu mở đầu hay tiêu đề mục — phải diễn đạt lại bằng từ vựng học thuật riêng.
${focusInstruction}
4. NHỊP TRÍCH DẪN & TRIỂN KHAI: Sử dụng linh hoạt khoảng ${meta.sampledSourceCount} nguồn đã cấp trong danh sách [S1]..[S${meta.sampledSourceCount}], viết hoàn toàn bằng cấu trúc câu độc lập của riêng Bản #${meta.cloneIndex}.`;
  }

  return `\n\n=== SAME-CLASS COHORT ANTI-SIMILARITY ENGINE (STUDENT PAPER #${meta.cloneIndex} OF ${meta.cohortSize} · ${archetype.shortTag}) ===
CRITICAL CONTEXT: ${meta.cohortSize} students in the SAME university class are submitting papers on this exact brief to the same Turnitin assignment inbox. Sharing some scholarly sources from the random course pool is completely natural, BUT BODY PROSE AND HEADINGS MUST HAVE ZERO CONTIGUOUS PHRASE OVERLAP (>= 5 WORDS) WITH ANY CLASSMATE:
1. ASSIGNED STRUCTURAL & RHETORICAL LENS: ${
    mode === 'outline' ? archetype.outlineDirectiveEn : archetype.proseDirectiveEn
  }
2. NEVER PARROT PROMPT OR RUBRIC PHRASING: Never copy 5+ consecutive words verbatim from the assignment prompt, topic sentence, or rubric descriptors into your headings or opening sentences. Reformulate every concept in fresh wording.
${focusInstruction}
4. NATURAL RANDOMIZED SOURCE INTEGRATION: Weave sources organically from this student's randomly sampled bibliography pack ([S1]..[S${meta.sampledSourceCount}]), varying citation placement and never listing sources in the exact order [S1], [S2], [S3].`;
}

// ---------------------------------------------------------------------------
// Fast Client-Side Pairwise Turnitin Cross-Student Shingle Similarity Scanner
// ---------------------------------------------------------------------------

export interface CohortCollisionSnippet {
  sectionIdA: string;
  sectionTitleA: string;
  sentenceA: string;
  sectionIdB: string;
  sectionTitleB: string;
  sentenceB: string;
  sharedPhrase: string;
  sharedWordCount: number;
}

export interface CohortPairSimilarity {
  sessionIdA: string;
  titleA: string;
  sessionIdB: string;
  titleB: string;
  /** Turnitin-style 5-word contiguous body shingle overlap % (excludes References) */
  bodySimilarityPercent: number;
  status: 'safe' | 'caution' | 'danger';
  sharedCitationCount: number;
  totalCitationsA: number;
  totalCitationsB: number;
  collisions: CohortCollisionSnippet[];
}

export interface CohortSimilarityMatrixReport {
  computedAt: string;
  sessionCount: number;
  maxSimilarityPercent: number;
  avgSimilarityPercent: number;
  pairs: CohortPairSimilarity[];
}

interface IndexedSentence {
  sectionId: string;
  sectionTitle: string;
  raw: string;
  tokens: string[];
}

function tokenizeNormalizedWords(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/\[figure:\s*[^\]]+\]/gi, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

function extractBodySentencesForSession(session: WriterSession): IndexedSentence[] {
  const out: IndexedSentence[] = [];
  for (const sec of session.outline || []) {
    if (isReferencesSectionTitle(sec.title)) continue;
    const rawContent = (sec.content || '').trim();
    if (!rawContent) continue;
    const rawSentences = rawContent
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 28);
    for (const s of rawSentences) {
      const tokens = tokenizeNormalizedWords(s);
      if (tokens.length >= 6) {
        out.push({
          sectionId: sec.id,
          sectionTitle: sec.title,
          raw: s,
          tokens,
        });
      }
    }
  }
  return out;
}

function buildShingleSet(
  sentences: IndexedSentence[],
  shingleSize: number,
  ignoredShingles: Set<string>
): { allShingles: Set<string>; totalWordCount: number } {
  const allShingles = new Set<string>();
  let totalWordCount = 0;
  for (const sent of sentences) {
    totalWordCount += sent.tokens.length;
    for (let i = 0; i <= sent.tokens.length - shingleSize; i++) {
      const sh = sent.tokens.slice(i, i + shingleSize).join(' ');
      if (!ignoredShingles.has(sh)) {
        allShingles.add(sh);
      }
    }
  }
  return { allShingles, totalWordCount };
}

function findLongestCommonContiguousPhrase(
  tokensA: string[],
  tokensB: string[],
  ignoredShingles: Set<string>
): { phrase: string; length: number } {
  const minLen = 5;
  if (tokensA.length < minLen || tokensB.length < minLen) {
    return { phrase: '', length: 0 };
  }

  let bestLen = 0;
  let bestStartA = 0;

  // Compact DP over word indices for two single sentences
  const prev = new Uint16Array(tokensB.length + 1);
  const curr = new Uint16Array(tokensB.length + 1);

  for (let i = 1; i <= tokensA.length; i++) {
    for (let j = 1; j <= tokensB.length; j++) {
      if (tokensA[i - 1] === tokensB[j - 1]) {
        const len = prev[j - 1] + 1;
        curr[j] = len;
        if (len >= minLen && len > bestLen) {
          const candidate5 = tokensA.slice(i - minLen, i).join(' ');
          if (!ignoredShingles.has(candidate5)) {
            bestLen = len;
            bestStartA = i - len;
          }
        }
      } else {
        curr[j] = 0;
      }
    }
    prev.set(curr);
    curr.fill(0);
  }

  if (bestLen < minLen) return { phrase: '', length: 0 };
  return {
    phrase: tokensA.slice(bestStartA, bestStartA + bestLen).join(' '),
    length: bestLen,
  };
}

/**
 * Computes Turnitin-style pairwise contiguous 5-word body similarity across all
 * drafted papers in a cohort (excluding References, while also reporting shared
 * citation counts separately for transparency).
 */
export function computeCohortSimilarityReport(
  sessions: WriterSession[]
): CohortSimilarityMatrixReport {
  const drafted = sessions.filter((s) =>
    s.outline.some(
      (sec) => !isReferencesSectionTitle(sec.title) && countWords(sec.content) >= 40
    )
  );

  // Build ignored shingle set from the assignment prompt topic/subject so legitimate
  // mentions of the assigned course title aren't falsely flagged
  const ignoredShingles = new Set<string>();
  for (const s of drafted) {
    const topicTokens = tokenizeNormalizedWords(`${s.topic} ${s.subject}`);
    for (let i = 0; i <= topicTokens.length - 5; i++) {
      ignoredShingles.add(topicTokens.slice(i, i + 5).join(' '));
    }
  }

  const prepared = drafted.map((s) => {
    const sentences = extractBodySentencesForSession(s);
    const { allShingles, totalWordCount } = buildShingleSet(
      sentences,
      5,
      ignoredShingles
    );
    const bodyText = s.outline
      .filter((sec) => !isReferencesSectionTitle(sec.title))
      .map((sec) => sec.content)
      .join('\n');
    const cits = extractInTextCitations(bodyText).map((c) =>
      c.toLowerCase().replace(/[^a-z0-9]/g, '')
    );
    return {
      session: s,
      sentences,
      shingles: allShingles,
      totalWordCount: Math.max(1, totalWordCount),
      citationSet: new Set(cits),
    };
  });

  const pairs: CohortPairSimilarity[] = [];

  for (let i = 0; i < prepared.length; i++) {
    for (let j = i + 1; j < prepared.length; j++) {
      const A = prepared[i];
      const B = prepared[j];

      // Count matched words covered by shared 5-word shingles in A & B
      const sharedShingles = new Set<string>();
      A.shingles.forEach((sh) => {
        if (B.shingles.has(sh)) sharedShingles.add(sh);
      });

      let matchedTokenPositionsA = 0;
      if (sharedShingles.size > 0) {
        for (const sent of A.sentences) {
          const hitFlags = new Uint8Array(sent.tokens.length);
          for (let k = 0; k <= sent.tokens.length - 5; k++) {
            const sh = sent.tokens.slice(k, k + 5).join(' ');
            if (sharedShingles.has(sh)) {
              for (let m = k; m < k + 5; m++) hitFlags[m] = 1;
            }
          }
          for (let m = 0; m < hitFlags.length; m++) {
            if (hitFlags[m]) matchedTokenPositionsA++;
          }
        }
      }

      const rawPct = (matchedTokenPositionsA / A.totalWordCount) * 100;
      const bodySimilarityPercent = Math.min(
        100,
        Math.round(rawPct * 10) / 10
      );

      // Extract top colliding sentence pairs if sharedShingles > 0
      const collisions: CohortCollisionSnippet[] = [];
      if (sharedShingles.size > 0) {
        const seenSentA = new Set<string>();
        for (const sentA of A.sentences) {
          let hasHit = false;
          for (let k = 0; k <= sentA.tokens.length - 5; k++) {
            if (sharedShingles.has(sentA.tokens.slice(k, k + 5).join(' '))) {
              hasHit = true;
              break;
            }
          }
          if (!hasHit) continue;

          for (const sentB of B.sentences) {
            const common = findLongestCommonContiguousPhrase(
              sentA.tokens,
              sentB.tokens,
              ignoredShingles
            );
            if (common.length >= 5) {
              const keyA = `${sentA.sectionId}:${sentA.raw.slice(0, 60)}`;
              if (!seenSentA.has(keyA)) {
                seenSentA.add(keyA);
                collisions.push({
                  sectionIdA: sentA.sectionId,
                  sectionTitleA: sentA.sectionTitle,
                  sentenceA: sentA.raw,
                  sectionIdB: sentB.sectionId,
                  sectionTitleB: sentB.sectionTitle,
                  sentenceB: sentB.raw,
                  sharedPhrase: common.phrase,
                  sharedWordCount: common.length,
                });
              }
              break;
            }
          }
          if (collisions.length >= 12) break;
        }
        collisions.sort((x, y) => y.sharedWordCount - x.sharedWordCount);
      }

      let sharedCitationCount = 0;
      A.citationSet.forEach((c) => {
        if (B.citationSet.has(c)) sharedCitationCount++;
      });

      const status: CohortPairSimilarity['status'] =
        bodySimilarityPercent >= 8
          ? 'danger'
          : bodySimilarityPercent >= 3
          ? 'caution'
          : 'safe';

      pairs.push({
        sessionIdA: A.session.id,
        titleA: A.session.linkedOrderCode
          ? `#${A.session.linkedOrderCode} · ${A.session.title}`
          : A.session.title,
        sessionIdB: B.session.id,
        titleB: B.session.linkedOrderCode
          ? `#${B.session.linkedOrderCode} · ${B.session.title}`
          : B.session.title,
        bodySimilarityPercent,
        status,
        sharedCitationCount,
        totalCitationsA: A.citationSet.size,
        totalCitationsB: B.citationSet.size,
        collisions,
      });
    }
  }

  pairs.sort((a, b) => b.bodySimilarityPercent - a.bodySimilarityPercent);

  const maxSimilarityPercent =
    pairs.length > 0 ? pairs[0].bodySimilarityPercent : 0;
  const avgSimilarityPercent =
    pairs.length > 0
      ? Math.round(
          (pairs.reduce((acc, p) => acc + p.bodySimilarityPercent, 0) /
            pairs.length) *
            10
        ) / 10
      : 0;

  return {
    computedAt: new Date().toLocaleTimeString('vi-VN'),
    sessionCount: drafted.length,
    maxSimilarityPercent,
    avgSimilarityPercent,
    pairs,
  };
}
