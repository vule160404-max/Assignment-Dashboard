import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import DOMPurify from 'dompurify';
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Check,
  Clock,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Link2,
  ListTree,
  Loader2,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  Table2,
  X,
  ZoomIn,
} from 'lucide-react';
import {
  fetchSampleArticle,
  getShortSchoolName,
  type SampleArticleDetail,
  type SampleCatalogItem,
} from '../../services/sampleLibraryService';
import { SampleUniversityBadge } from './SampleUniversityBadge';

interface SampleReaderViewProps {
  activeItem: SampleCatalogItem;
  allItems: SampleCatalogItem[];
  onSelectSample: (slug: string) => void;
  onBackToList: () => void;
  onOrderNow: () => void;
}

interface LightboxImage {
  src: string;
  alt: string;
}

export function SampleReaderView({
  activeItem,
  allItems,
  onSelectSample,
  onBackToList,
  onOrderNow,
}: SampleReaderViewProps) {
  const [article, setArticle] = useState<SampleArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const [fontScale, setFontScale] = useState<'sm' | 'md' | 'lg'>('md');
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [sidebarQuery, setSidebarQuery] = useState('');
  const [lightboxImage, setLightboxImage] = useState<LightboxImage | null>(null);

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

  const sidebarItems = useMemo(() => {
    const q = sidebarQuery.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter((item) => {
      const hay = `${item.title} ${item.school} ${item.major} ${item.courseCode}`.toLowerCase();
      return hay.includes(q);
    });
  }, [allItems, sidebarQuery]);

  const handleCopySampleLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?sample=${encodeURIComponent(
      activeItem.slug
    )}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedSlug(activeItem.slug);
    window.setTimeout(() => setCopiedSlug(null), 2000);
  };

  const scrollToAnchor = (anchorId: string) => {
    document.getElementById(anchorId)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
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

  const currentMeta = article || activeItem;
  const readingMinutes = Math.max(1, Math.round(currentMeta.wordCount / 220));

  return (
    <div className="bg-[#F4F7FB] min-h-[calc(100vh-4rem)] pb-16">
      {/* Top Reader Breadcrumb & Controls Bar */}
      <div className="bg-white border-b border-slate-200/90 sticky top-16 z-20">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBackToList}
            className="btn-press inline-flex items-center gap-2 text-xs font-bold text-[#0B2559] hover:text-[#12489B] whitespace-nowrap shrink-0 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Thư viện Bài mẫu ({allItems.length})</span>
          </button>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 min-w-0">
            <span className="font-semibold text-slate-800 shrink-0">
              {currentMeta.school}
            </span>
            <span>/</span>
            <span className="truncate font-medium text-[#12489B]">
              {currentMeta.major}
            </span>
            {currentMeta.courseCode && (
              <>
                <span>/</span>
                <span className="font-mono font-bold text-slate-700 shrink-0">
                  {currentMeta.courseCode}
                </span>
              </>
            )}
          </div>

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
              className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:border-[#12489B] text-xs font-semibold text-slate-700 whitespace-nowrap transition-colors"
            >
              {copiedSlug === activeItem.slug ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Đã chép</span>
                </>
              ) : (
                <>
                  <Link2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Chia sẻ</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="btn-press hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:border-[#12489B] text-xs font-semibold text-slate-700 whitespace-nowrap transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In / PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3-Column Academic Reader Layout */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT SIDEBAR: Dark Navy Searchable University Sample Navigator */}
        <aside className="hidden lg:block lg:col-span-3 sticky top-36">
          <div className="rounded-3xl bg-[#0B2559] text-white overflow-hidden shadow-md border border-[#163B82]">
            <div className="px-4 py-3.5 border-b border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-sky-300">
                    AssignTrack Library
                  </div>
                  <div className="text-sm font-bold text-white">
                    Bài mẫu ({sidebarItems.length}/{allItems.length})
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
                  placeholder="Lọc nhanh trường, mã môn..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-xs text-white placeholder:text-sky-200/60 focus:outline-none focus:border-[#F5B700]"
                />
              </div>
            </div>

            <div className="max-h-[calc(100vh-19rem)] overflow-y-auto divide-y divide-white/10">
              {sidebarItems.map((item) => {
                const isCurrent = item.slug === activeItem.slug;
                return (
                  <button
                    key={item.slug}
                    type="button"
                    onClick={() => onSelectSample(item.slug)}
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
                  </button>
                );
              })}
              {sidebarItems.length === 0 && (
                <div className="p-5 text-center text-xs text-sky-200/75">
                  Không có bài mẫu khớp từ khóa.
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* CENTER: Full-Length Scholarly Paper Sheet */}
        <article className="lg:col-span-6 bg-white rounded-3xl border border-slate-200/90 shadow-[0_10px_34px_rgba(11,37,89,0.05)] overflow-hidden">
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
                  <span className="px-2.5 py-0.5 rounded-full bg-[#0B2559] text-white font-bold">
                    Free sample
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[#12489B] font-semibold">
                    {currentMeta.major}
                  </span>
                  {currentMeta.gradeLabel && (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 font-mono font-bold">
                      {currentMeta.gradeLabel}
                    </span>
                  )}
                </div>

                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 leading-snug">
                  {currentMeta.title}
                </h1>

                <p className="text-xs text-slate-600 font-medium">
                  {currentMeta.school}
                  {currentMeta.country ? ` (${currentMeta.country})` : ''}
                  {currentMeta.courseCode ? (
                    <>
                      {' '}
                      · Mã môn:{' '}
                      <span className="font-mono font-bold text-slate-800">
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
                  Độ dài nguyên văn
                </div>
                <div className="text-xs font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                  {currentMeta.wordCount.toLocaleString('vi-VN')} từ
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200/80 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Thời gian đọc
                </div>
                <div className="text-xs font-bold font-mono tabular-nums text-[#12489B] mt-0.5">
                  ~{readingMinutes} phút
                </div>
              </div>

              <div className="rounded-xl bg-blue-50/60 border border-blue-200/70 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#12489B]">
                  Bảng &amp; Hình ảnh
                </div>
                <div className="text-xs font-bold text-[#0B2559] mt-0.5 tabular-nums">
                  {currentMeta.tableCount} Bảng · {currentMeta.imageCount} Hình
                </div>
              </div>

              <div className="rounded-xl bg-emerald-50/70 border border-emerald-200/80 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                  Cấu trúc học thuật
                </div>
                <div className="text-xs font-bold text-emerald-800 mt-0.5 truncate">
                  {currentMeta.hasAppendix
                    ? 'Full + Appendix'
                    : currentMeta.hasReferences
                    ? 'Full + References'
                    : 'Full Paper'}
                </div>
              </div>
            </div>
          </header>

          {/* Full Academic Body Content */}
          <div className="p-6 sm:p-8 space-y-6">
            {currentMeta.imageCount > 0 && !loading && !error && (
              <div className="rounded-xl bg-slate-50 border border-slate-200/80 px-3.5 py-2 text-[11.5px] text-slate-600 flex items-center gap-2">
                <ZoomIn className="w-3.5 h-3.5 text-[#12489B] shrink-0" />
                <span>
                  Mẹo đọc: Nhấn trực tiếp vào bất kỳ hình ảnh bảng dữ liệu hoặc biểu đồ nào trong bài để phóng to toàn màn hình.
                </span>
              </div>
            )}

            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
                <Loader2 className="w-7 h-7 text-[#12489B] animate-spin" />
                <p className="text-xs font-medium">
                  Đang tải toàn văn bài mẫu ({activeItem.wordCount.toLocaleString('vi-VN')} từ)...
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
              <div
                onClick={handleProseClick}
                className={`sample-article-prose ${bodyTextClass}`}
                dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
              />
            )}

            {/* Academic Integrity Footnote */}
            <div className="rounded-2xl bg-blue-50/70 border border-blue-200/80 p-4 text-xs text-slate-700 leading-relaxed flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-[#12489B] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-[#0B2559]">
                  Lưu ý tham khảo học thuật:
                </span>{' '}
                Bài mẫu nguyên văn trên dùng để minh họa bố cục, lập luận, bảng dữ liệu, hình ảnh phân tích, danh mục tài liệu tham khảo và phụ lục đạt chuẩn đại học quốc tế. Không sao chép trực tiếp khi nộp bài Turnitin.
              </div>
            </div>
          </div>
        </article>

        {/* RIGHT SIDEBAR: Interactive TOC + Paper Summary + Order CTA */}
        <aside className="lg:col-span-3 space-y-5 lg:sticky lg:top-36">
          {/* Interactive Document TOC */}
          <div className="rounded-3xl bg-white border border-slate-200/90 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0B2559]">
                <ListTree className="w-4 h-4 text-[#12489B]" />
                <span>Mục lục bài viết</span>
              </div>
              {article && article.toc.length > 0 && (
                <span className="text-[11px] font-mono font-bold text-slate-400 tabular-nums">
                  {article.toc.length} mục
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
                {article.toc.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => scrollToAnchor(entry.id)}
                    className={`w-full text-left py-1.5 rounded-lg text-xs hover:bg-blue-50 hover:text-[#12489B] transition-colors line-clamp-2 ${
                      entry.level === 2
                        ? 'pl-5 pr-2.5 text-slate-600 font-medium'
                        : 'px-2.5 text-slate-800 font-semibold'
                    }`}
                  >
                    {entry.text}
                  </button>
                ))}
              </nav>
            ) : (
              <p className="text-xs text-slate-500 leading-relaxed">
                Bài viết trình bày liền mạch theo chuẩn học thuật gốc. Cuộn xuống để đọc toàn văn.
              </p>
            )}
          </div>

          {/* Paper Metadata Summary Card */}
          <div className="rounded-3xl bg-white border border-slate-200/90 p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0B2559]">
              <FileText className="w-4 h-4 text-[#12489B]" />
              <span>Thông tin học thuật</span>
            </div>

            <dl className="space-y-2 text-xs">
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
                <dt className="text-slate-500 shrink-0">Ngày đăng</dt>
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

          {/* Conversion CTA Card */}
          <div className="rounded-3xl bg-gradient-to-br from-[#071A42] via-[#0B2559] to-[#12489B] text-white p-5 space-y-3.5 shadow-md">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-amber-300">
              Cần bài chuẩn điểm cao môn này?
            </div>
            <h3 className="text-base font-bold leading-snug">
              Đặt viết bài theo đúng Rubric &amp; chuẩn {getShortSchoolName(currentMeta.school)}
            </h3>
            <p className="text-xs text-slate-200/90 leading-relaxed">
              Đầy đủ phân tích định lượng, bảng dữ liệu, hình ảnh biểu đồ, nguồn học thuật thật và báo cáo Turnitin + AI 0%.
            </p>
            <button
              type="button"
              onClick={onOrderNow}
              className="btn-press w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-[#F59E0B] to-[#EA580C] hover:from-[#D97706] hover:to-[#C2410C] text-white text-xs font-bold shadow-md whitespace-nowrap"
            >
              <span>Order Now · Tư vấn ngay</span>
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
