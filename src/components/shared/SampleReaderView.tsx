import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import DOMPurify from 'dompurify';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Eye,
  FileSpreadsheet,
  FileText,
  Flame,
  HelpCircle,
  Image as ImageIcon,
  Link2,
  ListTree,
  Loader2,
  Lock,
  MessageCircle,
  Moon,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Table2,
  Unlock,
  X,
  ZoomIn,
} from 'lucide-react';
import {
  SITE_ORIGIN,
  buildCourseRubricBreakdown,
  buildCourseSeoFaqs,
  buildOrderPrefillFromSample,
  buildSampleSeoDescription,
  buildSampleSeoTitle,
  getSampleCanonicalPath,
  getSampleCanonicalUrl,
  getSchoolHubPath,
  getSchoolHubUrl,
  slicePreviewHtmlAtRatio,
  syncDocumentSeoMeta,
  type OrderPrefillData,
} from '../../lib/sampleSeo';
import {
  fetchSampleArticle,
  getShortSchoolName,
  type SampleArticleDetail,
  type SampleCatalogItem,
} from '../../services/sampleLibraryService';
import { SampleUniversityBadge } from './SampleUniversityBadge';

const ZALO_DIRECT_URL = 'https://zalo.me/0916045202';

interface SampleReaderViewProps {
  activeItem: SampleCatalogItem;
  allItems: SampleCatalogItem[];
  isAdmin?: boolean;
  onSelectSample: (slug: string) => void;
  onSelectSchool?: (schoolName: string) => void;
  onBackToList: () => void;
  onOrderNow: (prefill?: OrderPrefillData) => void;
}

interface LightboxImage {
  src: string;
  alt: string;
}

export function SampleReaderView({
  activeItem,
  allItems,
  isAdmin = false,
  onSelectSample,
  onSelectSchool,
  onBackToList,
  onOrderNow,
}: SampleReaderViewProps) {
  const [article, setArticle] = useState<SampleArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const [fontScale, setFontScale] = useState<'sm' | 'md' | 'lg'>('md');
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [copiedZaloPrompt, setCopiedZaloPrompt] = useState(false);
  const [sidebarQuery, setSidebarQuery] = useState('');
  const [lightboxImage, setLightboxImage] = useState<LightboxImage | null>(null);
  const [adminUnlockFull, setAdminUnlockFull] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [gatePulse, setGatePulse] = useState(false);

  const isNightOwlWindow = useMemo(() => {
    const hr = new Date().getHours();
    return hr >= 21 || hr < 6;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchSampleArticle(activeItem.slug)
      .then((data) => {
        if (!cancelled) {
          setArticle(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Không thể tải bài mẫu.');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeItem.slug, reloadNonce]);

  useEffect(() => {
    if (!lightboxImage) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxImage(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxImage]);

  const currentMeta = article || activeItem;
  const shortSchool = getShortSchoolName(currentMeta.school);
  const courseBadgeText = currentMeta.courseCode || shortSchool;

  const faqs = useMemo(() => buildCourseSeoFaqs(currentMeta), [currentMeta]);
  const rubricCheckpoints = useMemo(
    () => buildCourseRubricBreakdown(currentMeta, article?.toc || []),
    [currentMeta, article?.toc]
  );

  // Sync dynamic <head> title, canonical URL, OpenGraph & Google Structured Data (ScholarlyArticle + FAQPage + BreadcrumbList)
  useEffect(() => {
    const seoTitle = buildSampleSeoTitle(currentMeta);
    const seoDesc = buildSampleSeoDescription(currentMeta);
    const canonicalUrl = getSampleCanonicalUrl(currentMeta.slug);

    const jsonLd = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Trang chủ AssignTrack',
              item: `${SITE_ORIGIN}/`,
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'Thư viện Bài mẫu Đại học Quốc tế',
              item: `${SITE_ORIGIN}/samples`,
            },
            {
              '@type': 'ListItem',
              position: 3,
              name: currentMeta.school,
              item: getSchoolHubUrl(currentMeta.school),
            },
            {
              '@type': 'ListItem',
              position: 4,
              name: currentMeta.courseCode
                ? `${currentMeta.courseCode} — ${currentMeta.title}`
                : currentMeta.title,
              item: canonicalUrl,
            },
          ],
        },
        {
          '@type': 'ScholarlyArticle',
          headline: seoTitle,
          name: currentMeta.title,
          description: seoDesc,
          url: canonicalUrl,
          inLanguage: ['en', 'vi'],
          wordCount: currentMeta.wordCount,
          educationalLevel: currentMeta.level || 'University',
          about: [
            currentMeta.courseCode,
            currentMeta.major,
            currentMeta.school,
          ].filter(Boolean),
          isAccessibleForFree: false,
          hasPart: {
            '@type': 'WebPageElement',
            isAccessibleForFree: false,
            cssSelector: '.seo-paywall-locked',
          },
          publisher: {
            '@type': 'Organization',
            name: 'AssignTrack Academic Support',
            url: SITE_ORIGIN,
          },
        },
        {
          '@type': 'FAQPage',
          mainEntity: faqs.map((f) => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: f.answer,
            },
          })),
        },
      ],
    };

    syncDocumentSeoMeta({
      title: seoTitle,
      description: seoDesc,
      canonicalUrl,
      jsonLd,
    });
  }, [currentMeta, faqs]);

  const sanitizedHtml = useMemo(() => {
    if (!article?.html) return '';
    return DOMPurify.sanitize(article.html, {
      USE_PROFILES: { html: true },
      ADD_ATTR: [
        'target',
        'rel',
        'loading',
        'decoding',
        'start',
        'colspan',
        'rowspan',
        'scope',
        'class',
        'id',
      ],
    });
  }, [article?.html]);

  const slicedPreview = useMemo(
    () =>
      slicePreviewHtmlAtRatio(
        sanitizedHtml,
        article?.toc || [],
        currentMeta.wordCount || 2000,
        0.35
      ),
    [sanitizedHtml, article?.toc, currentMeta.wordCount]
  );

  const isFullUnlocked = Boolean(isAdmin && adminUnlockFull);
  const renderedHtml = isFullUnlocked ? sanitizedHtml : slicedPreview.unlockedHtml;

  const sidebarItems = useMemo(() => {
    const q = sidebarQuery.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter((item) => {
      const hay = `${item.title} ${item.school} ${item.major} ${item.courseCode}`.toLowerCase();
      return hay.includes(q);
    });
  }, [allItems, sidebarQuery]);

  // Related samples at the same university (or same major fallback) for deep SEO internal linking
  const relatedSamples = useMemo(() => {
    const sameSchool = allItems.filter(
      (it) => it.slug !== currentMeta.slug && it.school === currentMeta.school
    );
    if (sameSchool.length >= 6) return sameSchool.slice(0, 6);
    const sameMajor = allItems.filter(
      (it) =>
        it.slug !== currentMeta.slug &&
        it.school !== currentMeta.school &&
        it.major === currentMeta.major
    );
    return [...sameSchool, ...sameMajor].slice(0, 6);
  }, [allItems, currentMeta.slug, currentMeta.school, currentMeta.major]);

  const handleCopySampleLink = () => {
    const url = getSampleCanonicalUrl(activeItem.slug);
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedSlug(activeItem.slug);
    window.setTimeout(() => setCopiedSlug(null), 2000);
  };

  const handleTriggerPrefilledOrder = () => {
    onOrderNow(buildOrderPrefillFromSample(currentMeta));
  };

  const handleQuickZaloConsult = () => {
    const msg = `Chào AssignTrack, mình đang xem bài mẫu ${
      currentMeta.courseCode ? `mã môn ${currentMeta.courseCode} ` : ''
    }(${currentMeta.school}) và muốn nhận báo giá viết bài mới độc bản 100% cho kỳ học hiện tại.`;
    navigator.clipboard?.writeText(msg).catch(() => {});
    setCopiedZaloPrompt(true);
    window.setTimeout(() => setCopiedZaloPrompt(false), 3000);
    window.open(ZALO_DIRECT_URL, '_blank', 'noopener,noreferrer');
  };

  const scrollToAnchorOrGate = (anchorId: string, isUnlockedHeading: boolean) => {
    if (isFullUnlocked || isUnlockedHeading) {
      const el = document.getElementById(anchorId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    const gateEl = document.getElementById('sniper-unlock-gate');
    if (gateEl) {
      gateEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setGatePulse(true);
      window.setTimeout(() => setGatePulse(false), 1400);
    }
  };

  const handleProseClick = (e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (target && target.tagName === 'IMG') {
      const img = target as HTMLImageElement;
      if (img.src) {
        setLightboxImage({
          src: img.src,
          alt: img.alt || activeItem.title,
        });
      }
    }
  };

  const bodyTextClass =
    fontScale === 'sm'
      ? 'text-[13.5px] leading-relaxed'
      : fontScale === 'lg'
      ? 'text-[16.5px] leading-[1.85]'
      : 'text-[15px] leading-[1.78]';

  const readingMinutes = Math.max(1, Math.round(currentMeta.wordCount / 220));

  return (
    <div className="bg-[#F4F7FB] min-h-[calc(100vh-4rem)] pb-16">
      {/* Top Reader Breadcrumb & Controls Bar */}
      <div className="bg-white border-b border-slate-200/90 sticky top-16 z-20">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-3">
          <a
            href="/samples"
            onClick={(e) => {
              if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
                e.preventDefault();
                onBackToList();
              }
            }}
            className="btn-press inline-flex items-center gap-2 text-xs font-bold text-[#0B2559] hover:text-[#12489B] whitespace-nowrap shrink-0 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Thư viện Bài mẫu ({allItems.length})</span>
          </a>

          <nav
            aria-label="Breadcrumb bài mẫu"
            className="hidden md:flex items-center gap-2 text-xs text-slate-500 min-w-0"
          >
            <a
              href={getSchoolHubPath(currentMeta.school)}
              onClick={(e) => {
                if (
                  onSelectSchool &&
                  !e.metaKey &&
                  !e.ctrlKey &&
                  !e.shiftKey &&
                  e.button === 0
                ) {
                  e.preventDefault();
                  onSelectSchool(currentMeta.school);
                }
              }}
              className="font-semibold text-slate-800 hover:text-[#12489B] shrink-0 transition-colors"
            >
              {currentMeta.school}
            </a>
            <span>/</span>
            <span className="truncate font-medium text-[#12489B]">
              {currentMeta.major}
            </span>
            {currentMeta.courseCode && (
              <>
                <span>/</span>
                <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 font-mono font-bold text-amber-900 shrink-0">
                  {currentMeta.courseCode}
                </span>
              </>
            )}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:inline-flex items-center rounded-full border border-slate-200 bg-slate-50 p-0.5 text-[11px] font-bold">
              {(['sm', 'md', 'lg'] as const).map((sz, idx) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setFontScale(sz)}
                  className={`px-2.5 py-1 rounded-full transition-colors ${
                    fontScale === sz
                      ? 'bg-[#0B2559] text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {idx === 0 ? 'A-' : idx === 1 ? 'A' : 'A+'}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleCopySampleLink}
              title={`Chép link SEO chuẩn: ${getSampleCanonicalUrl(activeItem.slug)}`}
              className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:border-[#12489B] text-xs font-semibold text-slate-700 whitespace-nowrap transition-colors"
            >
              {copiedSlug === activeItem.slug ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Đã chép URL SEO</span>
                </>
              ) : (
                <>
                  <Link2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Link SEO</span>
                </>
              )}
            </button>

            {isFullUnlocked && (
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-press hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:border-[#12489B] text-xs font-semibold text-slate-700 whitespace-nowrap transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>In / PDF</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Admin-Only SEO & Paywall Preview Inspector Bar */}
      {isAdmin && (
        <div className="bg-[#071A42] text-white border-b border-sky-400/20">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/40 text-amber-300 font-bold text-[10.5px] shrink-0">
                ADMIN SEO SNIPER
              </span>
              <span className="font-mono text-[11.5px] text-sky-200 truncate">
                {getSampleCanonicalUrl(activeItem.slug)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAdminUnlockFull((v) => !v)}
                className={`btn-press inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11.5px] font-bold transition-colors ${
                  adminUnlockFull
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white/15 hover:bg-white/25 text-amber-200 border border-white/20'
                }`}
              >
                {adminUnlockFull ? (
                  <>
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Admin: Đang mở 100% toàn văn (Bấm để xem khóa 35% như Khách)</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>Giao diện Khách: Mở 35% + Khóa phễu 65% (Bấm mở 100%)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3-Column Academic Reader Layout */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT SIDEBAR: Dark Navy Searchable University & Course Code Navigator */}
        <aside className="hidden lg:block lg:col-span-3 sticky top-36">
          <div className="rounded-3xl bg-[#0B2559] text-white overflow-hidden shadow-md border border-[#163B82]">
            <div className="px-4 py-3.5 border-b border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-sky-300">
                    Course Code Directory
                  </div>
                  <div className="text-sm font-bold text-white">
                    Kho Mã Môn ({sidebarItems.length}/{allItems.length})
                  </div>
                </div>
                <BookOpen className="w-4 h-4 text-amber-300" />
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-sky-200/70 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={sidebarQuery}
                  onChange={(e) => setSidebarQuery(e.target.value)}
                  placeholder="Gõ mã môn (BUSM2570, BAFI...)..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-xs text-white placeholder:text-sky-200/60 focus:outline-none focus:border-[#F5B700]"
                />
              </div>
            </div>

            <div className="max-h-[calc(100vh-19rem)] overflow-y-auto divide-y divide-white/10">
              {sidebarItems.map((item) => {
                const isCurrent = item.slug === activeItem.slug;
                return (
                  <a
                    key={item.slug}
                    href={getSampleCanonicalPath(item.slug)}
                    onClick={(e) => {
                      if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
                        e.preventDefault();
                        onSelectSample(item.slug);
                      }
                    }}
                    className={`w-full text-left px-3.5 py-2.5 flex items-start gap-2.5 transition-colors ${
                      isCurrent
                        ? 'bg-[#12489B] border-l-4 border-[#F5B700]'
                        : 'hover:bg-white/5 border-l-4 border-transparent'
                    }`}
                  >
                    <SampleUniversityBadge
                      logoUrl={item.logoUrl}
                      schoolName={item.school}
                      size="xs"
                      className="mt-0.5 border-white/20"
                    />
                    <div className="min-w-0 flex-1">
                      {item.courseCode && (
                        <span className="inline-block mb-0.5 px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 font-mono text-[10px] font-bold">
                          {item.courseCode}
                        </span>
                      )}
                      <div className="text-xs font-bold leading-snug text-white line-clamp-2">
                        {item.title}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-[10.5px] text-sky-200/85 font-mono tabular-nums">
                        <span className="truncate">{getShortSchoolName(item.school)}</span>
                        <span>·</span>
                        <span className="text-amber-300 font-bold shrink-0">
                          {item.wordCount.toLocaleString('vi-VN')} từ
                        </span>
                      </div>
                    </div>
                  </a>
                );
              })}
              {sidebarItems.length === 0 && (
                <div className="p-5 text-center text-xs text-sky-200/75">
                  Không có mã môn khớp từ khóa.
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* CENTER: Course-Code Sniper Sheet + Rubric Analysis + 35% Preview + Conversion Gate + FAQs */}
        <div className="lg:col-span-6 space-y-6">
          <article className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_10px_34px_rgba(11,37,89,0.05)] overflow-hidden">
            {/* Academic Cover Banner */}
            <header className="p-6 sm:p-8 border-b border-slate-200/80 bg-gradient-to-b from-slate-50/90 to-white space-y-5">
              <div className="flex items-start gap-4">
                <SampleUniversityBadge
                  logoUrl={currentMeta.logoUrl}
                  schoolName={currentMeta.school}
                  size="lg"
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    {currentMeta.courseCode ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-[#0B2559] text-amber-300 font-mono font-bold tracking-wide">
                        {currentMeta.courseCode}
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-[#0B2559] text-white font-bold">
                        {shortSchool}
                      </span>
                    )}
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[#12489B] font-semibold">
                      {currentMeta.major}
                    </span>
                    {currentMeta.gradeLabel && (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono font-bold">
                        Chuẩn {currentMeta.gradeLabel}
                      </span>
                    )}
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 font-semibold">
                      Phân tích Rubric &amp; Bài mẫu
                    </span>
                  </div>

                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 leading-snug">
                    {currentMeta.courseCode &&
                    !currentMeta.title.toUpperCase().includes(currentMeta.courseCode.toUpperCase())
                      ? `${currentMeta.courseCode} – ${currentMeta.title}`
                      : currentMeta.title}
                  </h1>

                  <p className="text-xs text-slate-600 font-medium">
                    {currentMeta.school}
                    {currentMeta.country ? ` (${currentMeta.country})` : ''}
                    {currentMeta.courseCode ? (
                      <>
                        {' '}
                        · Mã học phần:{' '}
                        <span className="font-mono font-bold text-slate-900">
                          {currentMeta.courseCode}
                        </span>
                      </>
                    ) : null}
                    {currentMeta.level ? ` · ${currentMeta.level}` : ''}
                  </p>
                </div>
              </div>

              {/* Compact Academic Paper Metrics Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                <div className="rounded-xl bg-slate-50 border border-slate-200/80 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Quy mô bài chuẩn
                  </div>
                  <div className="text-xs font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                    {currentMeta.wordCount.toLocaleString('vi-VN')} từ
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-200/80 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Mở đọc miễn phí
                  </div>
                  <div className="text-xs font-bold font-mono tabular-nums text-[#12489B] mt-0.5">
                    {isFullUnlocked
                      ? '100% (Admin)'
                      : `35% đầu (~${slicedPreview.unlockedWordCount.toLocaleString('vi-VN')} từ)`}
                  </div>
                </div>

                <div className="rounded-xl bg-blue-50/60 border border-blue-200/70 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#12489B]">
                    Bảng &amp; Biểu đồ
                  </div>
                  <div className="text-xs font-bold text-[#0B2559] mt-0.5 tabular-nums">
                    {currentMeta.tableCount} Bảng · {currentMeta.imageCount} Hình
                  </div>
                </div>

                <div className="rounded-xl bg-emerald-50/70 border border-emerald-200/80 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                    Thời lượng nghiên cứu
                  </div>
                  <div className="text-xs font-bold text-emerald-800 mt-0.5 truncate">
                    ~{readingMinutes} phút đọc
                  </div>
                </div>
              </div>

              {/* RUBRIC BREAKDOWN & TURNITIN WARNING BOX */}
              <div className="rounded-2xl bg-[#F8FAFC] border border-slate-200/90 p-4 sm:p-5 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0B2559]">
                    <Sparkles className="w-4 h-4 text-[#D97706]" />
                    <span>
                      Bóc tách tiêu chí ăn điểm Rubric {courseBadgeText} ({shortSchool})
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    Đạt chuẩn {currentMeta.gradeLabel || 'HD'}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {rubricCheckpoints.map((cp) => (
                    <div
                      key={cp.title}
                      className="rounded-xl bg-white border border-slate-200/80 px-3.5 py-2.5 flex items-start justify-between gap-3"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#12489B] shrink-0" />
                          <span>{cp.title}</span>
                        </div>
                        <p className="text-[11.5px] text-slate-600 leading-relaxed pl-5">
                          {cp.detail}
                        </p>
                      </div>
                      <span className="shrink-0 px-2 py-0.5 rounded-md bg-blue-50 text-[#12489B] font-mono text-[10px] font-bold">
                        {cp.weightLabel}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl bg-amber-50/90 border border-amber-200/90 px-3.5 py-2.5 flex items-start gap-2.5 text-[11.5px] text-amber-950 leading-relaxed">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Cảnh báo Turnitin Repository:</span> Bài mẫu{' '}
                    <span className="font-mono font-bold">{courseBadgeText}</span> này đã lưu vết
                    trên kho đối chiếu học thuật quốc tế. Nộp lại hoặc tự viết đè lên khung cũ sẽ
                    báo trùng lặp <span className="font-bold">75% – 100%</span>.
                  </div>
                </div>
              </div>
            </header>

            {/* Academic Body Content (35% Sharp Open Preview + 65% Sniper Gate) */}
            <div className="p-6 sm:p-8 space-y-6">
              {currentMeta.imageCount > 0 && !loading && !error && (
                <div className="rounded-xl bg-slate-50 border border-slate-200/80 px-3.5 py-2 text-[11.5px] text-slate-600 flex items-center gap-2">
                  <ZoomIn className="w-3.5 h-3.5 text-[#12489B] shrink-0" />
                  <span>
                    Nhấn vào bảng dữ liệu hoặc sơ đồ minh họa trong phần mở đọc bên dưới để phóng to chi tiết.
                  </span>
                </div>
              )}

              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
                  <Loader2 className="w-7 h-7 text-[#12489B] animate-spin" />
                  <p className="text-xs font-medium">
                    Đang tải phân tích &amp; trích đoạn bài mẫu {courseBadgeText}...
                  </p>
                </div>
              ) : error ? (
                <div className="py-14 px-6 rounded-2xl bg-red-50/70 border border-red-200 text-center space-y-3">
                  <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
                  <div className="text-sm font-bold text-slate-900">{error}</div>
                  <button
                    type="button"
                    onClick={() => setReloadNonce((n) => n + 1)}
                    className="btn-press inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#0B2559] text-white text-xs font-bold"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Thử tải lại</span>
                  </button>
                </div>
              ) : (
                <>
                  <div
                    onClick={handleProseClick}
                    className={`sample-article-prose ${bodyTextClass}`}
                    dangerouslySetInnerHTML={{ __html: renderedHtml }}
                  />

                  {/* SNIPER 65% LOCKED CONVERSION CURTAIN */}
                  {!isFullUnlocked && slicedPreview.lockedWordCount > 0 && (
                    <div
                      id="sniper-unlock-gate"
                      className={`seo-paywall-locked relative mt-2 rounded-3xl overflow-hidden border transition-all duration-300 ${
                        gatePulse
                          ? 'border-[#F59E0B] ring-4 ring-amber-300/40'
                          : 'border-[#163B82]/25'
                      }`}
                    >
                      {/* Masked Visual Silhouette Underlay (Zero real hidden essay words leaked in DOM) */}
                      <div
                        aria-hidden="true"
                        className="relative px-6 pt-5 pb-10 bg-slate-50 select-none pointer-events-none space-y-3 overflow-hidden"
                      >
                        {slicedPreview.lockedTeaserLines.map((line, i) => (
                          <p
                            key={i}
                            className={
                              i % 2 === 0
                                ? 'text-base font-bold text-slate-800 blur-[5px] opacity-65'
                                : 'text-sm text-slate-600 leading-relaxed blur-[6px] opacity-55'
                            }
                          >
                            {line}
                          </p>
                        ))}
                        <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-white/80 to-[#071A42]" />
                      </div>

                      {/* High-Intent Course-Code Conversion Box */}
                      <div className="relative bg-gradient-to-br from-[#071A42] via-[#0B2559] to-[#12489B] text-white p-6 sm:p-8 space-y-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/15 border border-amber-300/35 text-[11px] font-bold text-amber-300">
                            {isNightOwlWindow ? (
                              <>
                                <Moon className="w-3.5 h-3.5" />
                                <span>
                                  Ca trực đêm đang mở · Nhận cứu gấp môn {courseBadgeText} (12h–24h)
                                </span>
                              </>
                            ) : (
                              <>
                                <Flame className="w-3.5 h-3.5" />
                                <span>
                                  Đang nhận làm mới kỳ hiện tại · Môn {courseBadgeText}
                                </span>
                              </>
                            )}
                          </span>

                          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-sky-200 bg-white/10 px-2.5 py-1 rounded-full">
                            <Lock className="w-3 h-3 text-amber-300" />
                            <span>
                              Khóa 65% cuối ({slicedPreview.lockedWordCount.toLocaleString('vi-VN')} từ)
                            </span>
                          </span>
                        </div>

                        <div className="space-y-2">
                          <h2 className="text-lg sm:text-xl font-bold leading-snug text-white">
                            Phần giải quyết câu hỏi khó nhất, bảng kết quả &amp; danh mục References của môn{' '}
                            <span className="text-amber-300">{courseBadgeText}</span> đang được bảo vệ
                          </h2>
                          <p className="text-xs sm:text-[13px] text-slate-200/90 leading-relaxed">
                            Đừng mạo hiểm xào nấu lại bài mẫu cũ đã bị Turnitin lưu kho. Đặt đội ngũ Thạc sĩ chuyên ngành{' '}
                            <strong className="text-white">{currentMeta.major}</strong> triển khai một{' '}
                            <strong className="text-amber-300">
                              bài viết mới độc bản 100% theo đúng đề &amp; Case Study kỳ học hiện tại
                            </strong>{' '}
                            của bạn tại {shortSchool}.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11.5px]">
                          <div className="rounded-2xl bg-white/10 border border-white/15 p-3 space-y-1">
                            <div className="font-bold text-amber-300">Độc bản kỳ này</div>
                            <div className="text-slate-200/90 leading-snug">
                              Viết mới từ đầu theo đúng file Brief &amp; Rubric giảng viên vừa giao.
                            </div>
                          </div>
                          <div className="rounded-2xl bg-white/10 border border-white/15 p-3 space-y-1">
                            <div className="font-bold text-emerald-300">Turnitin &amp; AI 0%</div>
                            <div className="text-slate-200/90 leading-snug">
                              Nguồn bài báo DOI sống 100%, tặng kèm báo cáo kiểm định trước khi nộp.
                            </div>
                          </div>
                          <div className="rounded-2xl bg-white/10 border border-white/15 p-3 space-y-1">
                            <div className="font-bold text-sky-300">Xem bài trước</div>
                            <div className="text-slate-200/90 leading-snug">
                              Theo dõi tiến độ &amp; kiểm tra chất lượng bài trên Portal trước khi tất toán.
                            </div>
                          </div>
                        </div>

                        <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                          <button
                            type="button"
                            onClick={handleTriggerPrefilledOrder}
                            className="btn-press flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-[#F59E0B] to-[#EA580C] hover:from-[#D97706] hover:to-[#C2410C] text-white text-xs sm:text-sm font-bold shadow-[0_12px_28px_rgba(234,88,12,0.38)] transition-all"
                          >
                            <span>
                              Nhận bài viết mới độc bản cho môn {courseBadgeText}
                            </span>
                            <ArrowUpRight className="w-4 h-4 shrink-0" />
                          </button>

                          <button
                            type="button"
                            onClick={handleQuickZaloConsult}
                            className="btn-press inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-white/12 hover:bg-white/20 border border-white/25 text-white text-xs font-bold whitespace-nowrap transition-colors"
                          >
                            <MessageCircle className="w-4 h-4 text-sky-300 shrink-0" />
                            <span>
                              {copiedZaloPrompt
                                ? 'Đã chép mã môn · Đang mở Zalo...'
                                : `Hỏi nhanh Zalo môn ${courseBadgeText}`}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Academic Integrity Footnote */}
              <div className="rounded-2xl bg-blue-50/70 border border-blue-200/80 p-4 text-xs text-slate-700 leading-relaxed flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-[#12489B] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-[#0B2559]">
                    Cam kết bảo mật học thuật AssignTrack:
                  </span>{' '}
                  Mỗi đơn đặt mới cho mã môn{' '}
                  <span className="font-mono font-bold">{courseBadgeText}</span> được phân công
                  riêng 01 chuyên gia đúng ngành {currentMeta.major}, tuyệt đối không tái sử dụng
                  lại bất kỳ đoạn văn nào từ kho bài mẫu công khai.
                </div>
              </div>
            </div>
          </article>

          {/* COURSE-SPECIFIC SEO FAQ ACCORDION (Matches FAQPage JSON-LD Schema) */}
          <section
            aria-label={`Câu hỏi thường gặp môn ${courseBadgeText}`}
            className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-[0_6px_24px_rgba(11,37,89,0.04)] space-y-4"
          >
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0B2559]">
              <HelpCircle className="w-4 h-4 text-[#12489B]" />
              <span>
                Câu hỏi thường gặp khi làm bài môn {courseBadgeText} ({shortSchool})
              </span>
            </div>

            <div className="divide-y divide-slate-200/80">
              {faqs.map((faq, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div key={faq.question} className="py-3.5 first:pt-1 last:pb-1">
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                      className="w-full flex items-start justify-between gap-3 text-left"
                    >
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                        {faq.question}
                      </h3>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 shrink-0 mt-0.5 transition-transform ${
                          isOpen ? 'rotate-180 text-[#12489B]' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <p className="mt-2 text-xs sm:text-[13px] text-slate-600 leading-relaxed">
                        {faq.answer}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* INTERNAL SEO LINK MESH: Other Course Codes at the Same University */}
          {relatedSamples.length > 0 && (
            <section
              aria-label={`Mã môn liên quan tại ${currentMeta.school}`}
              className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-[0_6px_24px_rgba(11,37,89,0.04)] space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-[#0B2559]">
                    Bài mẫu &amp; Mã môn học liên quan tại {shortSchool}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Tham khảo thêm các học phần đạt điểm cao cùng trường hoặc cùng nhóm ngành{' '}
                    {currentMeta.major}
                  </p>
                </div>

                {onSelectSchool && (
                  <a
                    href={getSchoolHubPath(currentMeta.school)}
                    onClick={(e) => {
                      if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
                        e.preventDefault();
                        onSelectSchool(currentMeta.school);
                      }
                    }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#12489B] hover:underline"
                  >
                    <span>Tất cả bài {shortSchool}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {relatedSamples.map((rel) => (
                  <a
                    key={rel.slug}
                    href={getSampleCanonicalPath(rel.slug)}
                    onClick={(e) => {
                      if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
                        e.preventDefault();
                        onSelectSample(rel.slug);
                      }
                    }}
                    className="group rounded-2xl border border-slate-200/90 hover:border-[#12489B] bg-slate-50/60 hover:bg-white p-3.5 flex flex-col justify-between gap-2 transition-all"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
                        {rel.courseCode && (
                          <span className="px-2 py-0.5 rounded-md bg-[#0B2559] text-amber-300 font-mono font-bold">
                            {rel.courseCode}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#12489B] font-semibold">
                          {rel.major}
                        </span>
                        {rel.gradeLabel && (
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 font-mono font-bold">
                            {rel.gradeLabel}
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-bold text-slate-900 group-hover:text-[#12489B] line-clamp-2 leading-snug">
                        {rel.title}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/70">
                      <span className="font-mono">{rel.wordCount.toLocaleString('vi-VN')} từ</span>
                      <span className="font-bold text-[#12489B] inline-flex items-center gap-1">
                        Xem cấu trúc <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* RIGHT SIDEBAR: Interactive TOC (Showing Locked Deep Sections) + Paper Summary + Pre-filled Order CTA */}
        <aside className="lg:col-span-3 space-y-5 lg:sticky lg:top-36">
          {/* Interactive Document TOC */}
          <div className="rounded-3xl bg-white border border-slate-200/90 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0B2559]">
                <ListTree className="w-4 h-4 text-[#12489B]" />
                <span>Cấu trúc bài ({article?.toc.length || 0} mục)</span>
              </div>
              {!isFullUnlocked && slicedPreview.lockedSectionCount > 0 && (
                <span className="text-[10.5px] font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  {slicedPreview.lockedSectionCount} mục khóa
                </span>
              )}
            </div>

            {loading ? (
              <div className="space-y-2 py-2">
                <div className="h-3.5 w-4/5 rounded bg-slate-100" />
                <div className="h-3.5 w-3/5 rounded bg-slate-100" />
                <div className="h-3.5 w-11/12 rounded bg-slate-100" />
              </div>
            ) : article && article.toc.length > 0 ? (
              <nav className="max-h-[42vh] overflow-y-auto space-y-1 pr-1">
                {article.toc.map((entry) => {
                  const isEntryUnlocked =
                    isFullUnlocked || slicedPreview.unlockedHeadingIds.has(entry.id);
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => scrollToAnchorOrGate(entry.id, isEntryUnlocked)}
                      className={`w-full text-left py-1.5 rounded-lg text-xs hover:bg-blue-50 hover:text-[#12489B] transition-colors flex items-center justify-between gap-2 ${
                        entry.level === 2
                          ? 'pl-5 pr-2.5 text-slate-600 font-medium'
                          : 'px-2.5 text-slate-800 font-semibold'
                      }`}
                    >
                      <span className="line-clamp-2">{entry.text}</span>
                      {!isEntryUnlocked && (
                        <Lock className="w-3 h-3 text-amber-600 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </nav>
            ) : (
              <p className="text-xs text-slate-500 leading-relaxed">
                Bài viết trình bày liền mạch theo chuẩn học thuật gốc. Xem phần mở đầu và nhận tư vấn bài mới bên dưới.
              </p>
            )}
          </div>

          {/* Paper Metadata Summary Card */}
          <div className="rounded-3xl bg-white border border-slate-200/90 p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0B2559]">
              <FileText className="w-4 h-4 text-[#12489B]" />
              <span>Hồ sơ học phần</span>
            </div>

            <dl className="space-y-2 text-xs">
              {currentMeta.courseCode && (
                <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100">
                  <dt className="text-slate-500 shrink-0">Mã môn</dt>
                  <dd className="font-mono font-bold text-[#0B2559] bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                    {currentMeta.courseCode}
                  </dd>
                </div>
              )}
              <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100">
                <dt className="text-slate-500 shrink-0">Trường</dt>
                <dd className="font-bold text-slate-900 text-right">{currentMeta.school}</dd>
              </div>
              <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100">
                <dt className="text-slate-500 shrink-0">Chuyên ngành</dt>
                <dd className="font-semibold text-[#12489B] text-right">{currentMeta.major}</dd>
              </div>
              {currentMeta.level && (
                <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100">
                  <dt className="text-slate-500 shrink-0">Bậc học</dt>
                  <dd className="font-semibold text-slate-800 text-right">{currentMeta.level}</dd>
                </div>
              )}
              {currentMeta.country && (
                <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100">
                  <dt className="text-slate-500 shrink-0">Quốc gia</dt>
                  <dd className="font-semibold text-slate-800 text-right">{currentMeta.country}</dd>
                </div>
              )}
              <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100">
                <dt className="text-slate-500 shrink-0">Cập nhật</dt>
                <dd className="font-mono text-slate-700 inline-flex items-center gap-1 tabular-nums">
                  <Clock className="w-3 h-3 text-slate-400" />
                  {currentMeta.publishedDate}
                </dd>
              </div>
              <div className="pt-1 flex flex-wrap gap-1.5">
                {currentMeta.tableCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold">
                    <Table2 className="w-3 h-3 text-[#12489B]" />
                    {currentMeta.tableCount} bảng
                  </span>
                )}
                {currentMeta.imageCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold">
                    <ImageIcon className="w-3 h-3 text-[#12489B]" />
                    {currentMeta.imageCount} hình
                  </span>
                )}
                {currentMeta.hasAppendix && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-[#12489B] text-[11px] font-semibold">
                    <FileSpreadsheet className="w-3 h-3" />
                    Appendix
                  </span>
                )}
              </div>
            </dl>
          </div>

          {/* Pre-filled Course Sniper Conversion CTA Card */}
          <div className="rounded-3xl bg-gradient-to-br from-[#071A42] via-[#0B2559] to-[#12489B] text-white p-5 space-y-3.5 shadow-md">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-amber-300">
              {currentMeta.courseCode
                ? `Đang học môn ${currentMeta.courseCode}?`
                : 'Cần bài chuẩn điểm cao môn này?'}
            </div>
            <h3 className="text-base font-bold leading-snug">
              Nhận bài viết mới độc bản kỳ hiện tại theo chuẩn {shortSchool}
            </h3>
            <p className="text-xs text-slate-200/90 leading-relaxed">
              Tự động điền sẵn mã môn <strong className="text-white">{courseBadgeText}</strong> vào phiếu đăng ký — cam kết không đụng hàng bài mẫu, kèm báo cáo Turnitin &amp; AI 0%.
            </p>
            <button
              type="button"
              onClick={handleTriggerPrefilledOrder}
              className="btn-press w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-[#F59E0B] to-[#EA580C] hover:from-[#D97706] hover:to-[#C2410C] text-white text-xs font-bold shadow-md whitespace-nowrap"
            >
              <span>Đặt bài môn {courseBadgeText}</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </aside>
      </div>

      {/* Portal Image Lightbox for zooming into embedded tables & charts */}
      {lightboxImage &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Phóng to hình ảnh bài mẫu"
            onClick={() => setLightboxImage(null)}
            className="modal-backdrop fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-xs p-4 sm:p-8 flex items-center justify-center"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="modal-panel relative max-w-5xl w-full max-h-[90vh] flex flex-col items-center gap-3"
            >
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                aria-label="Đóng hình phóng to"
                className="btn-press self-end w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center border border-white/20"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="bg-white rounded-2xl p-2 sm:p-3 shadow-2xl overflow-auto max-h-[80vh] w-full flex items-center justify-center">
                <img
                  src={lightboxImage.src}
                  alt={lightboxImage.alt}
                  className="max-w-full max-h-[75vh] object-contain"
                />
              </div>
              {lightboxImage.alt && (
                <p className="text-xs text-slate-200 text-center max-w-2xl line-clamp-2">
                  {lightboxImage.alt}
                </p>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
