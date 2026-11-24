import type { CitationStyle } from '../types/domain';
import {
  getShortSchoolName,
  type SampleCatalogItem,
  type SampleTocItem,
} from '../services/sampleLibraryService';

export const SITE_ORIGIN = 'https://assigntrack.site';

export interface OrderPrefillData {
  serviceType?: string;
  subject?: string;
  topic?: string;
  wordCount?: string;
  citationStyle?: CitationStyle;
  notes?: string;
  sourceBadge?: string;
}

export interface SampleRouteState {
  isSamplesRoute: boolean;
  sampleSlug: string | null;
  courseCodeSlug: string | null;
  schoolSlug: string | null;
}

export interface CourseFaqItem {
  question: string;
  answer: string;
}

export interface RubricCheckpoint {
  title: string;
  detail: string;
  weightLabel: string;
}

export interface SlicedSamplePreview {
  unlockedHtml: string;
  lockedTeaserLines: string[];
  unlockedWordCount: number;
  lockedWordCount: number;
  unlockedHeadingIds: Set<string>;
  lockedSectionCount: number;
}

export function toSchoolSlug(schoolName: string): string {
  return schoolName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getSampleCanonicalPath(slug: string): string {
  return `/samples/${encodeURIComponent(slug)}`;
}

export function getSampleCanonicalUrl(slug: string): string {
  return `${SITE_ORIGIN}${getSampleCanonicalPath(slug)}`;
}

export function getSchoolHubPath(schoolName: string): string {
  return `/uni/${encodeURIComponent(toSchoolSlug(schoolName))}`;
}

export function getSchoolHubUrl(schoolName: string): string {
  return `${SITE_ORIGIN}${getSchoolHubPath(schoolName)}`;
}

export function parseSampleRouteFromLocation(loc: Location = window.location): SampleRouteState {
  const pathname = loc.pathname.replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(loc.search);

  // Clean path: /samples/<slug>
  const sampleMatch = pathname.match(/^\/samples\/([^/]+)$/i);
  if (sampleMatch) {
    const slug = decodeURIComponent(sampleMatch[1]);
    if (slug && !['articles', 'logos', 'media', 'index.json'].includes(slug.toLowerCase())) {
      return {
        isSamplesRoute: true,
        sampleSlug: slug,
        courseCodeSlug: null,
        schoolSlug: null,
      };
    }
  }

  // Clean short alias: /course/<course-code>
  const courseMatch = pathname.match(/^\/course\/([^/]+)$/i);
  if (courseMatch) {
    const code = decodeURIComponent(courseMatch[1]).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (code) {
      return {
        isSamplesRoute: true,
        sampleSlug: null,
        courseCodeSlug: code,
        schoolSlug: null,
      };
    }
  }

  // Clean path: /uni/<school-slug>
  const uniMatch = pathname.match(/^\/uni\/([^/]+)$/i);
  if (uniMatch) {
    const schoolSlug = decodeURIComponent(uniMatch[1]).toLowerCase();
    if (schoolSlug) {
      return {
        isSamplesRoute: true,
        sampleSlug: null,
        courseCodeSlug: null,
        schoolSlug,
      };
    }
  }

  // Clean path: /samples
  if (pathname.toLowerCase() === '/samples') {
    return {
      isSamplesRoute: true,
      sampleSlug: params.get('sample'),
      courseCodeSlug: params.get('course')?.toUpperCase() || null,
      schoolSlug: params.get('uni'),
    };
  }

  // Legacy query params (?sample=... or ?page=samples)
  const querySample = params.get('sample');
  const queryCourse = params.get('course');
  const queryUni = params.get('uni');
  if (querySample || queryCourse || queryUni || params.get('page') === 'samples') {
    return {
      isSamplesRoute: true,
      sampleSlug: querySample,
      courseCodeSlug: queryCourse ? queryCourse.toUpperCase() : null,
      schoolSlug: queryUni,
    };
  }

  return {
    isSamplesRoute: false,
    sampleSlug: null,
    courseCodeSlug: null,
    schoolSlug: null,
  };
}

export function inferPreferredCitationStyle(item: SampleCatalogItem): CitationStyle {
  const country = (item.country || '').toLowerCase();
  const school = (item.school || '').toLowerCase();
  if (country.includes('anh') || school.includes('coventry') || school.includes('northampton') || school.includes('kent')) {
    return 'Harvard';
  }
  if (school.includes('rmit') || school.includes('swinburne') || school.includes('deakin') || school.includes('la trobe')) {
    return 'Harvard';
  }
  return 'APA';
}

export function buildOrderPrefillFromSample(item: SampleCatalogItem): OrderPrefillData {
  const shortSchool = getShortSchoolName(item.school);
  const codePrefix = item.courseCode ? `${item.courseCode} — ` : '';
  const roundedWords = Math.max(
    1000,
    Math.round((item.wordCount || 2000) / 250) * 250
  );
  const citationStyle = inferPreferredCitationStyle(item);
  const cleanTitle = item.title
    .replace(/\s*[–—-]\s*Sample\s*(HD|DI|CR)?/gi, '')
    .trim();

  return {
    serviceType: 'Viết mới Assignment / Essay / Report',
    subject: `${codePrefix}${item.major || 'Academic Course'} (${shortSchool})`,
    topic: `Đặt viết bài mới độc bản 100% cho môn ${
      item.courseCode ? `${item.courseCode} (${cleanTitle})` : cleanTitle
    } bám sát Rubric kỳ hiện tại`,
    wordCount: String(roundedWords),
    citationStyle,
    notes: `Khách chuyển đổi từ trang phân tích bài mẫu SEO [${
      item.courseCode || item.slug
    } · ${item.school}]. Yêu cầu bài làm mới hoàn toàn 100%, số liệu/case study cập nhật theo đề kỳ hiện tại, kèm báo cáo Turnitin & AI 0%.`,
    sourceBadge: item.courseCode
      ? `Mã môn mục tiêu: ${item.courseCode} · ${shortSchool} — Viết mới độc bản 100%`
      : `Môn học: ${cleanTitle} · ${shortSchool} — Viết mới độc bản 100%`,
  };
}

export function buildSampleSeoTitle(item: SampleCatalogItem): string {
  const shortSchool = getShortSchoolName(item.school);
  const grade = item.gradeLabel || 'HD';
  if (item.courseCode) {
    const cleanName = item.title
      .replace(new RegExp(`\\b${item.courseCode}\\b`, 'gi'), '')
      .replace(/\bSample\s*(HD|DI|CR)?\b/gi, '')
      .replace(/^[\s–—-]+|[\s–—-]+$/g, '')
      .replace(/\s*[–—-]\s*[–—-]\s*/g, ' – ')
      .trim();
    return `${item.courseCode}${cleanName ? ` ${cleanName}` : ''} — Bài Mẫu ${grade} ${shortSchool} & Phân Tích Rubric | AssignTrack`;
  }
  return `${item.title} — Bài Mẫu ${grade} ${shortSchool} & Hướng Dẫn Rubric | AssignTrack`;
}

export function buildSampleSeoDescription(item: SampleCatalogItem): string {
  const codeText = item.courseCode ? `mã môn ${item.courseCode} ` : '';
  const structureBits: string[] = [`${item.wordCount.toLocaleString('vi-VN')} từ`];
  if (item.tableCount > 0) structureBits.push(`${item.tableCount} bảng dữ liệu`);
  if (item.imageCount > 0) structureBits.push(`${item.imageCount} biểu đồ`);
  if (item.hasReferences) structureBits.push('References học thuật');

  return `Tham khảo bài mẫu đạt ${item.gradeLabel || 'HD'} ${codeText}tại ${
    item.school
  } (${item.major} · ${structureBits.join(', ')}). Xem phân tích bẫy mất điểm Rubric và nhận bài viết mới độc bản 0% Turnitin & AI cho kỳ học hiện tại.`;
}

export function buildCourseRubricBreakdown(
  item: SampleCatalogItem,
  toc: SampleTocItem[]
): RubricCheckpoint[] {
  const shortSchool = getShortSchoolName(item.school);
  const codeLabel = item.courseCode || item.major || 'học phần này';
  const topSections = toc
    .filter((t) => t.level === 1)
    .slice(0, 4)
    .map((t) => t.text)
    .join(' → ');

  return [
    {
      title: `Khung lập luận chuẩn chấm điểm ${shortSchool}`,
      detail: topSections
        ? `Bố cục triển khai mạch lạc qua ${toc.length} phần: ${topSections}.`
        : `Triển khai trực diện câu hỏi đề bài (${item.wordCount.toLocaleString('vi-VN')} từ), phân bổ tỷ trọng Mở bài 10% – Phân tích trọng tâm 75% – Kết luận & Khuyến nghị 15%.`,
      weightLabel: '40% điểm Rubric',
    },
    {
      title: `Bằng chứng thực nghiệm & Dữ liệu chuyên ngành ${item.major}`,
      detail:
        item.tableCount > 0 || item.imageCount > 0
          ? `Bài đạt ${item.gradeLabel || 'HD'} nhờ minh họa trực quan bằng ${item.tableCount} bảng phân tích số liệu và ${item.imageCount} hình/mô hình thay vì chỉ viết lý thuyết suông.`
          : `Vận dụng khung lý thuyết chuyên ngành ${item.major} kết hợp phân tích tình huống thực tế (Critical Application) thay vì tóm tắt giáo trình.`,
      weightLabel: '35% điểm Rubric',
    },
    {
      title: `Độ sạch nguồn trích dẫn & Rủi ro Turnitin (${codeLabel})`,
      detail: `Định dạng chuẩn ${inferPreferredCitationStyle(item)} với nguồn peer-reviewed thật. Lưu ý: Bài mẫu công khai đã lưu vết trên kho đối chiếu toàn cầu — cần làm bài độc bản theo Case Study kỳ mới để đạt 0% AI & Similarity an toàn.`,
      weightLabel: '25% điểm Rubric',
    },
  ];
}

export function buildCourseSeoFaqs(item: SampleCatalogItem): CourseFaqItem[] {
  const shortSchool = getShortSchoolName(item.school);
  const subjectLabel = item.courseCode
    ? `môn ${item.courseCode} (${item.school})`
    : `bài ${item.title} (${shortSchool})`;

  return [
    {
      question: `Làm thế nào để đạt điểm ${item.gradeLabel || 'HD'} cho ${subjectLabel}?`,
      answer: `Để ăn trọn thang điểm High Distinction / Distinction cho ${subjectLabel}, bài viết cần bám sát từng tiêu chí trong Marking Rubric của ${shortSchool}, kết hợp lập luận phản biện (critical analysis), số liệu minh chứng cập nhật${
        item.tableCount > 0 ? ` (như hệ thống ${item.tableCount} bảng phân tích trong bài mẫu)` : ''
      } và trích dẫn chuẩn ${inferPreferredCitationStyle(item)} từ các bài báo khoa học có DOI thực tế.`,
    },
    {
      question: `Tôi có thể copy hoặc paraphrase lại bài mẫu ${item.courseCode || shortSchool} này để nộp không?`,
      answer: `Tuyệt đối không nên. Toàn bộ bài mẫu tham khảo trên mạng và kho dữ liệu các khóa trước đều đã được hệ thống Turnitin quét lập chỉ mục. Việc sao chép hoặc đảo từ thủ công sẽ bị đánh dấu đạo văn (Similarity cao hoặc cờ giải trình học thuật). Bạn chỉ nên tham khảo bố cục triển khai và đặt viết bài mới độc bản 100% theo đúng đề kỳ học hiện tại.`,
    },
    {
      question: `AssignTrack hỗ trợ làm bài mới môn ${item.courseCode || item.major} trong bao lâu?`,
      answer: `Đội ngũ Writer chuyên ngành ${item.major} tại AssignTrack nhận triển khai bài viết mới 100% cho sinh viên ${shortSchool} theo tiến độ tiêu chuẩn 3–7 ngày hoặc hỗ trợ ca gấp 12h–24h đêm khuya, bàn giao kèm báo cáo kiểm tra Turnitin & AI 0% và cho phép xem trước bài trên Portal trước khi tất toán.`,
    },
  ];
}

/**
 * Slices sanitized article HTML cleanly at top-level DOM block boundaries (~35% words)
 * so public visitors read a sharp, unbroken opening while the bottom 65% deep solution
 * stays completely absent from the DOM (preventing F12 Inspect-Element scraping).
 */
export function slicePreviewHtmlAtRatio(
  sanitizedHtml: string,
  toc: SampleTocItem[],
  totalWords: number,
  unlockRatio = 0.35
): SlicedSamplePreview {
  if (typeof DOMParser === 'undefined' || !sanitizedHtml.trim()) {
    return {
      unlockedHtml: sanitizedHtml,
      lockedTeaserLines: [],
      unlockedWordCount: totalWords,
      lockedWordCount: 0,
      unlockedHeadingIds: new Set(toc.map((t) => t.id)),
      lockedSectionCount: 0,
    };
  }

  const doc = new DOMParser().parseFromString(
    `<div id="seo-slice-root">${sanitizedHtml}</div>`,
    'text/html'
  );
  const root = doc.getElementById('seo-slice-root');
  if (!root || root.children.length <= 3) {
    return {
      unlockedHtml: sanitizedHtml,
      lockedTeaserLines: [],
      unlockedWordCount: totalWords,
      lockedWordCount: 0,
      unlockedHeadingIds: new Set(toc.map((t) => t.id)),
      lockedSectionCount: 0,
    };
  }

  const children = Array.from(root.children);
  const blockWordCounts = children.map((el) => {
    const txt = (el.textContent || '').trim();
    return txt ? txt.split(/\s+/).length : 0;
  });

  const computedTotal =
    blockWordCounts.reduce((acc, n) => acc + n, 0) || Math.max(1, totalWords);
  const targetWords = Math.max(220, Math.round(computedTotal * unlockRatio));

  let accWords = 0;
  let cutIndex = 0;
  for (let i = 0; i < children.length; i++) {
    accWords += blockWordCounts[i];
    cutIndex = i + 1;
    // Do not leave a dangling heading as the very last unlocked element
    const isHeading = /^H[1-6]$/i.test(children[i].tagName);
    if (accWords >= targetWords && i >= 2 && !isHeading) {
      break;
    }
  }

  // Ensure at least 35% locked when possible
  if (cutIndex >= children.length) {
    cutIndex = Math.max(2, Math.floor(children.length * 0.45));
  }

  const unlockedEls = children.slice(0, cutIndex);
  const lockedEls = children.slice(cutIndex);

  const unlockedHeadingIds = new Set<string>();
  for (const el of unlockedEls) {
    if (el.id) unlockedHeadingIds.add(el.id);
    el.querySelectorAll('[id]').forEach((sub) => {
      if (sub.id) unlockedHeadingIds.add(sub.id);
    });
  }

  let lockedSectionCount = 0;
  for (const entry of toc) {
    if (!unlockedHeadingIds.has(entry.id)) {
      lockedSectionCount++;
    }
  }
  if (lockedSectionCount === 0 && lockedEls.length > 0) {
    lockedSectionCount = Math.max(
      2,
      lockedEls.filter((el) => /^H[1-4]$/i.test(el.tagName)).length || 3
    );
  }

  // Build masked, non-copyable visual silhouette lines for the blur curtain
  // without leaking actual essay sentences into the DOM!
  const lockedHeadingTitles = lockedEls
    .filter((el) => /^H[1-4]$/i.test(el.tagName))
    .slice(0, 3)
    .map((el) => (el.textContent || '').trim())
    .filter(Boolean);

  const lockedTeaserLines = [
    lockedHeadingTitles[0] || '3. Critical Analysis & Empirical Rubric Evaluation',
    'Synthesis of peer-reviewed frameworks, quantitative variance interpretation, and applied strategic matrix aligned with marking criteria. Detailed discussion of core variables, operational constraints, and empirical evidence across multi-stage case evaluation.',
    lockedHeadingTitles[1] || '4. Strategic Recommendations, Implementation Roadmap & References',
    'Actionable managerial roadmap with KPI benchmarking, risk mitigation table, academic references (DOI verified), and full supporting appendix tables.',
  ];

  const unlockedWordCount = Math.min(
    totalWords,
    Math.max(180, Math.round((accWords / computedTotal) * totalWords))
  );
  const lockedWordCount = Math.max(0, totalWords - unlockedWordCount);

  return {
    unlockedHtml: unlockedEls.map((el) => el.outerHTML).join('\n'),
    lockedTeaserLines,
    unlockedWordCount,
    lockedWordCount,
    unlockedHeadingIds,
    lockedSectionCount,
  };
}

function upsertMetaTag(
  attrName: 'name' | 'property',
  attrValue: string,
  content: string
): void {
  let el = document.head.querySelector(
    `meta[${attrName}="${attrValue}"]`
  ) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonicalLink(href: string): void {
  let link = document.head.querySelector(
    'link[rel="canonical"]'
  ) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

function upsertJsonLdScript(id: string, payload: unknown | null): void {
  const existing = document.getElementById(id);
  if (!payload) {
    existing?.remove();
    return;
  }
  const script = (existing as HTMLScriptElement | null) || document.createElement('script');
  script.id = id;
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(payload);
  if (!existing) {
    document.head.appendChild(script);
  }
}

export function syncDocumentSeoMeta(options: {
  title: string;
  description: string;
  canonicalUrl: string;
  jsonLd?: unknown | null;
}): void {
  if (typeof document === 'undefined') return;
  document.title = options.title;
  upsertMetaTag('name', 'description', options.description);
  upsertMetaTag('property', 'og:title', options.title);
  upsertMetaTag('property', 'og:description', options.description);
  upsertMetaTag('property', 'og:url', options.canonicalUrl);
  upsertCanonicalLink(options.canonicalUrl);
  upsertJsonLdScript('assigntrack-dynamic-jsonld', options.jsonLd ?? null);
}
