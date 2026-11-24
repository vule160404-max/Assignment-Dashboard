import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Clock,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Hash,
  Image as ImageIcon,
  Layers,
  Loader2,
  Lock,
  RotateCcw,
  Search,
  Table2,
} from 'lucide-react';
import {
  SITE_ORIGIN,
  getSampleCanonicalPath,
  getSchoolHubPath,
  getSchoolHubUrl,
  parseSampleRouteFromLocation,
  syncDocumentSeoMeta,
  toSchoolSlug,
  type OrderPrefillData,
} from '../../lib/sampleSeo';
import {
  fetchSampleCatalog,
  getShortSchoolName,
  type SampleCatalogIndex,
  type SampleCatalogItem,
} from '../../services/sampleLibraryService';
import { SampleUniversityBadge } from './SampleUniversityBadge';
import { SampleReaderView } from './SampleReaderView';

interface SampleLibraryViewProps {
  isAdmin?: boolean;
  onOrderNow: (prefill?: OrderPrefillData) => void;
  onBackHome: () => void;
}

const ITEMS_PER_PAGE = 10;

type AttachmentFilter = 'all' | 'tables' | 'images' | 'appendix' | 'references';
type SortMode = 'default' | 'longest' | 'richest';

function buildPaginationWindow(current: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: Array<number | 'ellipsis'> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) pages.push('ellipsis');
  for (let p = start; p <= end; p++) {
    pages.push(p);
  }
  if (end < total - 1) pages.push('ellipsis');
  pages.push(total);
  return pages;
}

export function SampleLibraryView({
  isAdmin = false,
  onOrderNow,
  onBackHome,
}: SampleLibraryViewProps) {
  const [catalog, setCatalog] = useState<SampleCatalogIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const initialRoute = useMemo(() => {
    if (typeof window === 'undefined') {
      return {
        isSamplesRoute: true,
        sampleSlug: null,
        courseCodeSlug: null,
        schoolSlug: null,
      };
    }
    return parseSampleRouteFromLocation(window.location);
  }, []);

  const [selectedSlug, setSelectedSlug] = useState<string | null>(
    initialRoute.sampleSlug
  );
  const [pendingCourseCode, setPendingCourseCode] = useState<string | null>(
    initialRoute.courseCodeSlug
  );
  const [pendingSchoolSlug, setPendingSchoolSlug] = useState<string | null>(
    initialRoute.schoolSlug
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [schoolFilter, setSchoolFilter] = useState<string>('all');
  const [majorFilter, setMajorFilter] = useState<string>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [attachmentFilter, setAttachmentFilter] = useState<AttachmentFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('default');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchSampleCatalog(reloadNonce > 0)
      .then((data) => {
        if (!cancelled) {
          setCatalog(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Không thể tải thư viện bài mẫu.');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  const rawItems = catalog?.items ?? [];
  // Deduplicate identical slugs from WordPress taxonomy multi-mapping so cards & SEO URLs are 100% unique
  const items = useMemo(() => {
    const seen = new Set<string>();
    return rawItems.filter((it) => {
      if (!it.slug || seen.has(it.slug)) return false;
      seen.add(it.slug);
      return true;
    });
  }, [rawItems]);
  const schools = catalog?.schools ?? [];

  // Resolve initial /course/<COURSE_CODE> short link once catalog items load
  useEffect(() => {
    if (!pendingCourseCode || items.length === 0) return;
    const upper = pendingCourseCode.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const matched = items.find(
      (i) => i.courseCode.replace(/[^A-Z0-9]/gi, '').toUpperCase() === upper
    );
    if (matched) {
      setSelectedSlug(matched.slug);
    } else {
      setSearchQuery(pendingCourseCode);
    }
    setPendingCourseCode(null);
  }, [pendingCourseCode, items]);

  // Resolve initial /uni/<school-slug> once catalog schools load
  useEffect(() => {
    if (!pendingSchoolSlug || schools.length === 0) return;
    const matched = schools.find(
      (s) => toSchoolSlug(s.name) === pendingSchoolSlug.toLowerCase()
    );
    if (matched) {
      setSchoolFilter(matched.name);
    }
    setPendingSchoolSlug(null);
  }, [pendingSchoolSlug, schools]);

  // Listen to browser Back/Forward inside SampleLibraryView
  useEffect(() => {
    const onPopState = () => {
      const route = parseSampleRouteFromLocation(window.location);
      setSelectedSlug(route.sampleSlug);
      if (route.schoolSlug && schools.length > 0) {
        const matched = schools.find(
          (s) => toSchoolSlug(s.name) === route.schoolSlug?.toLowerCase()
        );
        setSchoolFilter(matched ? matched.name : 'all');
      } else if (!route.sampleSlug) {
        setSchoolFilter('all');
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [schools]);

  const activeItem: SampleCatalogItem | null = useMemo(() => {
    if (!selectedSlug || items.length === 0) return null;
    return (
      items.find(
        (item) => item.slug === selectedSlug || item.id === selectedSlug
      ) || null
    );
  }, [items, selectedSlug]);

  // Synchronize clean SEO URLs (/samples/<slug>, /uni/<school-slug>, /samples) + dynamic <head> SEO tags
  useEffect(() => {
    if (typeof window === 'undefined' || loading) return;

    if (activeItem) {
      const targetPath = getSampleCanonicalPath(activeItem.slug);
      if (window.location.pathname !== targetPath || window.location.search) {
        window.history.replaceState({}, '', targetPath);
      }
      return;
    }

    if (schoolFilter !== 'all') {
      const targetPath = getSchoolHubPath(schoolFilter);
      if (window.location.pathname !== targetPath || window.location.search) {
        window.history.replaceState({}, '', targetPath);
      }
      const shortUni = getShortSchoolName(schoolFilter);
      const uniCount = items.filter((i) => i.school === schoolFilter).length;
      const uniCodes = Array.from(
        new Set(
          items
            .filter((i) => i.school === schoolFilter && i.courseCode)
            .map((i) => i.courseCode)
        )
      ).slice(0, 6);
      syncDocumentSeoMeta({
        title: `Bài Mẫu Assignment ${schoolFilter} (${shortUni}) — ${uniCount} Mã Môn Chuẩn HD | AssignTrack`,
        description: `Tổng hợp ${uniCount} bài mẫu Assignment, Essay, Report đạt HD/DI tại ${schoolFilter}${
          uniCodes.length > 0 ? ` (gồm mã môn ${uniCodes.join(', ')})` : ''
        }. Xem phân tích Rubric và đặt bài viết mới độc bản 0% Turnitin & AI.`,
        canonicalUrl: getSchoolHubUrl(schoolFilter),
      });
      return;
    }

    if (window.location.pathname !== '/samples' || window.location.search) {
      window.history.replaceState({}, '', '/samples');
    }
    syncDocumentSeoMeta({
      title:
        'Kho 122+ Bài Mẫu Assignment Đại Học Quốc Tế & Tra Cứu Mã Môn RMIT, Swinburne, Melbourne | AssignTrack',
      description:
        'Tra cứu 122+ bài mẫu Assignment, Report, Essay chuẩn High Distinction theo đúng mã môn học của 25 trường Đại học Quốc tế (RMIT, Swinburne, Deakin, Melbourne, Coventry...). Bóc tách Rubric & hỗ trợ viết bài mới độc bản 24/7.',
      canonicalUrl: `${SITE_ORIGIN}/samples`,
    });
  }, [activeItem, schoolFilter, items, loading]);

  const stats = useMemo(() => {
    let totalWords = 0;
    let withCourseCodes = 0;
    let withTablesOrImages = 0;
    for (const item of items) {
      totalWords += item.wordCount || 0;
      if (item.courseCode) withCourseCodes++;
      if (item.tableCount > 0 || item.imageCount > 0) withTablesOrImages++;
    }
    return {
      totalWords,
      withCourseCodes,
      withTablesOrImages,
    };
  }, [items]);

  // Unique course-code sniper chips (filtered dynamically when a school is chosen)
  const sniperCourseCodes = useMemo(() => {
    const seen = new Set<string>();
    const result: Array<{ code: string; slug: string; school: string; title: string }> = [];
    for (const item of items) {
      if (!item.courseCode) continue;
      if (schoolFilter !== 'all' && item.school !== schoolFilter) continue;
      const upper = item.courseCode.toUpperCase();
      if (seen.has(upper)) continue;
      seen.add(upper);
      result.push({
        code: item.courseCode,
        slug: item.slug,
        school: getShortSchoolName(item.school),
        title: item.title,
      });
    }
    return result.slice(0, 24);
  }, [items, schoolFilter]);

  const majors = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      if (item.major) {
        counts.set(item.major, (counts.get(item.major) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [items]);

  const countries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      if (item.country) {
        counts.set(item.country, (counts.get(item.country) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [items]);

  const filteredSamples = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = items.filter((item) => {
      if (schoolFilter !== 'all' && item.school !== schoolFilter) return false;
      if (majorFilter !== 'all' && item.major !== majorFilter) return false;
      if (countryFilter !== 'all' && item.country !== countryFilter) return false;
      if (attachmentFilter === 'tables' && item.tableCount === 0) return false;
      if (attachmentFilter === 'images' && item.imageCount === 0) return false;
      if (attachmentFilter === 'appendix' && !item.hasAppendix) return false;
      if (attachmentFilter === 'references' && !item.hasReferences) return false;

      if (!q) return true;
      const haystack = [
        item.title,
        item.courseCode,
        item.school,
        item.major,
        item.country,
        item.excerpt,
        ...item.subjects,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });

    if (sortMode === 'longest') {
      return [...list].sort((a, b) => b.wordCount - a.wordCount);
    }
    if (sortMode === 'richest') {
      return [...list].sort(
        (a, b) =>
          b.tableCount * 3 +
          b.imageCount * 2 +
          (b.hasAppendix ? 2 : 0) -
          (a.tableCount * 3 + a.imageCount * 2 + (a.hasAppendix ? 2 : 0))
      );
    }
    return list;
  }, [
    items,
    searchQuery,
    schoolFilter,
    majorFilter,
    countryFilter,
    attachmentFilter,
    sortMode,
  ]);

  const hasActiveFilter =
    searchQuery.trim() !== '' ||
    schoolFilter !== 'all' ||
    majorFilter !== 'all' ||
    countryFilter !== 'all' ||
    attachmentFilter !== 'all' ||
    sortMode !== 'default';

  const resetAllFilters = () => {
    setSearchQuery('');
    setSchoolFilter('all');
    setMajorFilter('all');
    setCountryFilter('all');
    setAttachmentFilter('all');
    setSortMode('default');
    setCurrentPage(1);
    window.history.pushState({}, '', '/samples');
  };

  const totalPages = Math.max(1, Math.ceil(filteredSamples.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedSamples = useMemo(() => {
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return filteredSamples.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredSamples, safePage]);

  const paginationItems = useMemo(
    () => buildPaginationWindow(safePage, totalPages),
    [safePage, totalPages]
  );

  const handleOpenSample = (slug: string) => {
    window.history.pushState({}, '', getSampleCanonicalPath(slug));
    setSelectedSlug(slug);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectSchool = (schoolName: string) => {
    const next = schoolName === schoolFilter ? 'all' : schoolName;
    setSelectedSlug(null);
    setSchoolFilter(next);
    setCurrentPage(1);
    window.history.pushState(
      {},
      '',
      next === 'all' ? '/samples' : getSchoolHubPath(next)
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleChangePage = (page: number) => {
    setCurrentPage(page);
    document
      .getElementById('sample-catalog-results')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Render full 3-column Scholarly Sniper Reader View when a sample is active
  if (activeItem) {
    return (
      <SampleReaderView
        activeItem={activeItem}
        allItems={items}
        isAdmin={isAdmin}
        onSelectSample={handleOpenSample}
        onSelectSchool={(uniName) => {
          setSelectedSlug(null);
          setSchoolFilter(uniName);
          setCurrentPage(1);
          window.history.pushState({}, '', getSchoolHubPath(uniName));
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onBackToList={() => {
          setSelectedSlug(null);
          window.history.pushState(
            {},
            '',
            schoolFilter !== 'all' ? getSchoolHubPath(schoolFilter) : '/samples'
          );
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOrderNow={onOrderNow}
      />
    );
  }

  return (
    <div className="bg-[#F4F7FB] min-h-[calc(100vh-4rem)] pb-16">
      {/* Dark Deep Academic Navy Hero */}
      <section className="relative overflow-hidden bg-[#0B2559] text-white pt-10 pb-12 sm:pt-12 sm:pb-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #93C5FD 1px, transparent 1px), linear-gradient(to bottom, #93C5FD 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="max-w-2xl space-y-2.5">
              <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-amber-300">
                <GraduationCap className="w-4 h-4" />
                <span>AssignTrack Course-Code &amp; Rubric Library</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-white leading-[1.15]">
                {schoolFilter !== 'all' ? (
                  <>
                    Kho Bài Mẫu &amp; Phân Tích Rubric{' '}
                    <span className="text-sky-300">{schoolFilter}</span>
                  </>
                ) : (
                  <>
                    Tra Cứu Mã Môn Học &amp; Bài Mẫu{' '}
                    <span className="text-sky-300">Đại Học Quốc Tế Chuẩn HD</span>
                  </>
                )}
              </h1>
              <p className="text-xs sm:text-sm text-slate-200/85 leading-relaxed">
                Phân tích tiêu chí ăn điểm Marking Rubric, mở đọc 35% bố cục mở đầu chuẩn High Distinction của 25 trường Đại học Quốc tế (RMIT, Swinburne, Melbourne, Deakin, Coventry...) và hỗ trợ triển khai bài viết mới độc bản 100% cho kỳ học hiện tại.
              </p>
            </div>

            {/* Compact Live Library Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
              <div className="rounded-2xl bg-white/10 border border-white/15 px-3.5 py-2.5">
                <div className="text-lg font-bold font-mono tabular-nums text-white">
                  {items.length || '122'}
                </div>
                <div className="text-[11px] text-sky-200">Bài mẫu chuẩn HD/DI</div>
              </div>
              <div className="rounded-2xl bg-white/10 border border-white/15 px-3.5 py-2.5">
                <div className="text-lg font-bold font-mono tabular-nums text-amber-300">
                  {stats.withCourseCodes || '107'}
                </div>
                <div className="text-[11px] text-sky-200">Mã môn định danh</div>
              </div>
              <div className="rounded-2xl bg-white/10 border border-white/15 px-3.5 py-2.5">
                <div className="text-lg font-bold font-mono tabular-nums text-white">
                  {schools.length || '25'}
                </div>
                <div className="text-[11px] text-sky-200">Trường Quốc tế</div>
              </div>
              <div className="rounded-2xl bg-white/10 border border-white/15 px-3.5 py-2.5">
                <div className="text-lg font-bold font-mono tabular-nums text-emerald-300">
                  {stats.withTablesOrImages || '65+'}
                </div>
                <div className="text-[11px] text-sky-200">Bài có Bảng / Hình</div>
              </div>
            </div>
          </div>

          {/* Search Input inside Hero */}
          <div className="max-w-3xl">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Nhập thẳng mã môn đang cần tìm (VD: BUSM2570, BAFI2094, MKTG2305, ACC80008...) hoặc tên trường..."
                className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-white text-slate-900 placeholder:text-slate-400 text-xs sm:text-sm font-medium shadow-lg focus:outline-none focus:ring-2 focus:ring-[#F5B700]"
              />
            </div>
          </div>
        </div>
      </section>

      <section
        id="sample-catalog"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6"
      >
        {loading ? (
          <div className="py-20 bg-white rounded-3xl border border-slate-200 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 text-[#12489B] animate-spin" />
            <div className="text-sm font-semibold text-slate-700">
              Đang tải danh mục mã môn học &amp; logo các trường đại học...
            </div>
          </div>
        ) : error ? (
          <div className="py-16 px-6 bg-white rounded-3xl border border-red-200 text-center space-y-3">
            <AlertCircle className="w-9 h-9 text-red-500 mx-auto" />
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
            {/* OUTSIDE UNIVERSITY LOGO SHOWCASE & SEO HUB LINKS (ALL 25 UNIVERSITIES) */}
            <div className="rounded-3xl bg-white border border-slate-200/90 p-5 sm:p-6 shadow-[0_6px_24px_rgba(11,37,89,0.04)] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-[#0B2559]">
                    Chọn Trường Đại học ({schools.length} trường · {items.length} bài mẫu)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Mỗi trường có trang danh mục mã môn riêng chuẩn hóa cho tra cứu học phần
                  </p>
                </div>
                {schoolFilter !== 'all' && (
                  <a
                    href="/samples"
                    onClick={(e) => {
                      if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
                        e.preventDefault();
                        setSchoolFilter('all');
                        setCurrentPage(1);
                        window.history.pushState({}, '', '/samples');
                      }
                    }}
                    className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-[#12489B] text-xs font-bold hover:bg-blue-100 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Xem tất cả {schools.length} trường</span>
                  </a>
                )}
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-9 gap-2.5">
                <a
                  href="/samples"
                  onClick={(e) => {
                    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
                      e.preventDefault();
                      setSchoolFilter('all');
                      setCurrentPage(1);
                      window.history.pushState({}, '', '/samples');
                    }
                  }}
                  className={`btn-press rounded-2xl border p-2.5 flex flex-col items-center justify-center gap-1.5 text-center transition-colors ${
                    schoolFilter === 'all'
                      ? 'bg-[#0B2559] border-[#0B2559] text-white shadow-sm'
                      : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:border-[#12489B]/50 hover:bg-white'
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      schoolFilter === 'all'
                        ? 'bg-white/15 text-amber-300'
                        : 'bg-white border border-slate-200 text-[#0B2559]'
                    }`}
                  >
                    <Layers className="w-5 h-5" />
                  </div>
                  <div className="text-[11px] font-bold leading-tight">Tất cả</div>
                  <div
                    className={`text-[10px] font-mono tabular-nums ${
                      schoolFilter === 'all' ? 'text-sky-200' : 'text-slate-500'
                    }`}
                  >
                    {items.length} bài
                  </div>
                </a>

                {schools.map((uni) => {
                  const isSelected = schoolFilter === uni.name;
                  return (
                    <a
                      key={uni.name}
                      href={getSchoolHubPath(uni.name)}
                      onClick={(e) => {
                        if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
                          e.preventDefault();
                          handleSelectSchool(uni.name);
                        }
                      }}
                      title={`${uni.name} (${uni.count} bài mẫu)`}
                      className={`btn-press rounded-2xl border p-2.5 flex flex-col items-center justify-center gap-1.5 text-center transition-colors ${
                        isSelected
                          ? 'bg-blue-50/90 border-[#12489B] ring-1 ring-[#12489B] shadow-xs'
                          : 'bg-slate-50/60 border-slate-200 hover:border-[#12489B]/50 hover:bg-white'
                      }`}
                    >
                      <SampleUniversityBadge
                        logoUrl={uni.logoUrl}
                        schoolName={uni.name}
                        size="sm"
                      />
                      <div
                        className={`text-[11px] font-bold leading-tight line-clamp-1 w-full ${
                          isSelected ? 'text-[#0B2559]' : 'text-slate-800'
                        }`}
                      >
                        {getShortSchoolName(uni.name)}
                      </div>
                      <div className="text-[10px] font-mono tabular-nums text-slate-500">
                        {uni.count} bài
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>

            {/* COURSE-CODE SNIPER QUICK-JUMP BAR */}
            {sniperCourseCodes.length > 0 && (
              <div className="rounded-3xl bg-white border border-slate-200/90 p-4 sm:p-5 shadow-[0_6px_24px_rgba(11,37,89,0.03)] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0B2559]">
                    <Hash className="w-4 h-4 text-[#D97706]" />
                    <span>
                      Mã môn học tra cứu nhiều nhất
                      {schoolFilter !== 'all' ? ` tại ${getShortSchoolName(schoolFilter)}` : ''}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Nhấn thẳng vào mã môn để xem phân tích Rubric &amp; trích đoạn HD
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {sniperCourseCodes.map((entry) => (
                    <a
                      key={entry.slug}
                      href={getSampleCanonicalPath(entry.slug)}
                      onClick={(e) => {
                        if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
                          e.preventDefault();
                          handleOpenSample(entry.slug);
                        }
                      }}
                      title={`${entry.code} — ${entry.title}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 hover:bg-[#0B2559] border border-slate-200 hover:border-[#0B2559] text-xs font-mono font-bold text-slate-800 hover:text-white transition-colors"
                    >
                      <span>{entry.code}</span>
                      <span className="text-[10px] font-sans font-medium text-slate-400">
                        {entry.school}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Secondary Facet Filter Row + Results Summary */}
            <div
              id="sample-catalog-results"
              className="scroll-mt-24 flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200/90"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  value={majorFilter}
                  onChange={(e) => {
                    setMajorFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3.5 py-2 rounded-full bg-white border border-slate-200 font-semibold text-slate-700 focus:outline-none focus:border-[#12489B]"
                >
                  <option value="all">Tất cả Chuyên ngành ({majors.length})</option>
                  {majors.map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.name} ({m.count})
                    </option>
                  ))}
                </select>

                <select
                  value={countryFilter}
                  onChange={(e) => {
                    setCountryFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3.5 py-2 rounded-full bg-white border border-slate-200 font-semibold text-slate-700 focus:outline-none focus:border-[#12489B]"
                >
                  <option value="all">Tất cả Quốc gia</option>
                  {countries.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.count})
                    </option>
                  ))}
                </select>

                <select
                  value={attachmentFilter}
                  onChange={(e) => {
                    setAttachmentFilter(e.target.value as AttachmentFilter);
                    setCurrentPage(1);
                  }}
                  className="px-3.5 py-2 rounded-full bg-white border border-slate-200 font-semibold text-slate-700 focus:outline-none focus:border-[#12489B]"
                >
                  <option value="all">Tất cả thành phần</option>
                  <option value="tables">Có bảng dữ liệu (Tables)</option>
                  <option value="images">Có hình ảnh &amp; biểu đồ</option>
                  <option value="appendix">Có Phụ lục (Appendix)</option>
                  <option value="references">Có Tài liệu tham khảo</option>
                </select>

                <select
                  value={sortMode}
                  onChange={(e) => {
                    setSortMode(e.target.value as SortMode);
                    setCurrentPage(1);
                  }}
                  className="px-3.5 py-2 rounded-full bg-white border border-slate-200 font-semibold text-slate-700 focus:outline-none focus:border-[#12489B]"
                >
                  <option value="default">Sắp xếp: Mới nhất</option>
                  <option value="longest">Dài nhất trước (Nhiều từ)</option>
                  <option value="richest">Nhiều Bảng &amp; Hình nhất</option>
                </select>

                {hasActiveFilter && (
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="px-3 py-2 rounded-full text-xs font-bold text-[#12489B] hover:bg-blue-50 transition-colors"
                  >
                    Xóa bộ lọc
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between lg:justify-end gap-3 text-xs shrink-0">
                <span className="font-bold text-slate-800 tabular-nums">
                  {filteredSamples.length} bài mẫu
                </span>
                <span className="px-3 py-1 rounded-full bg-white border border-slate-200 font-semibold text-slate-600 tabular-nums">
                  Trang {safePage} / {totalPages}
                </span>
                <a
                  href="/"
                  onClick={(e) => {
                    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
                      e.preventDefault();
                      onBackHome();
                    }
                  }}
                  className="text-xs font-semibold text-[#12489B] hover:underline whitespace-nowrap"
                >
                  ← Trang chủ
                </a>
              </div>
            </div>

            {/* 2-COLUMN SAMPLE CARD GRID (Crawlable Clean SEO Links + Course Code Pills) */}
            {filteredSamples.length === 0 ? (
              <div className="py-16 text-center bg-white rounded-3xl border border-slate-200 space-y-3">
                <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
                <div className="text-sm font-bold text-slate-800">
                  Không tìm thấy mã môn khớp bộ lọc hiện tại
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="btn-press px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold"
                  >
                    Đặt lại bộ lọc
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onOrderNow(
                        searchQuery.trim()
                          ? {
                              subject: searchQuery.trim().toUpperCase(),
                              topic: `Đặt viết bài mới độc bản cho học phần: ${searchQuery.trim()}`,
                              sourceBadge: `Yêu cầu mã môn: ${searchQuery.trim().toUpperCase()}`,
                            }
                          : undefined
                      )
                    }
                    className="btn-press px-4 py-2 rounded-full bg-[#EA580C] text-white text-xs font-bold"
                  >
                    Đặt viết mới riêng cho mã môn "{searchQuery.trim() || 'của bạn'}" →
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {paginatedSamples.map((sample) => (
                    <a
                      key={sample.slug}
                      href={getSampleCanonicalPath(sample.slug)}
                      onClick={(e) => {
                        if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
                          e.preventDefault();
                          handleOpenSample(sample.slug);
                        }
                      }}
                      className="card-interactive group cursor-pointer rounded-3xl bg-white border border-slate-200/90 p-5 sm:p-6 flex flex-col justify-between shadow-[0_6px_24px_rgba(11,37,89,0.04)] text-left"
                    >
                      <div className="space-y-4">
                        {/* Top row: Official University Logo Box + Course Code + Pills + Title */}
                        <div className="flex items-start gap-4">
                          <SampleUniversityBadge
                            logoUrl={sample.logoUrl}
                            schoolName={sample.school}
                            size="md"
                          />

                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                              {sample.courseCode ? (
                                <span className="px-2.5 py-0.5 rounded-full bg-[#0B2559] text-amber-300 font-mono font-bold">
                                  {sample.courseCode}
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-full bg-[#0B2559] text-white font-bold">
                                  {getShortSchoolName(sample.school)}
                                </span>
                              )}
                              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-[#12489B] font-semibold">
                                {sample.major}
                              </span>
                              {sample.gradeLabel && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono font-bold">
                                  {sample.gradeLabel}
                                </span>
                              )}
                            </div>

                            <h3 className="text-base sm:text-[17px] font-bold text-slate-900 group-hover:text-[#12489B] transition-colors leading-snug line-clamp-2">
                              {sample.title}
                            </h3>
                          </div>
                        </div>

                        {/* Excerpt */}
                        <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed line-clamp-3">
                          {sample.excerpt}
                        </p>

                        {/* Compact Academic Depth Badges */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-slate-500 font-medium">
                          <span className="inline-flex items-center gap-1 font-mono font-semibold text-slate-700 tabular-nums">
                            <FileText className="w-3.5 h-3.5 text-[#12489B]" />
                            {sample.wordCount.toLocaleString('vi-VN')} từ
                          </span>
                          {sample.tableCount > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <Table2 className="w-3.5 h-3.5 text-[#12489B]" />
                              {sample.tableCount} bảng
                            </span>
                          )}
                          {sample.imageCount > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <ImageIcon className="w-3.5 h-3.5 text-[#12489B]" />
                              {sample.imageCount} hình
                            </span>
                          )}
                          {sample.hasReferences && (
                            <span className="inline-flex items-center gap-1">
                              <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />
                              References
                            </span>
                          )}
                          {sample.hasAppendix && (
                            <span className="inline-flex items-center gap-1 text-[#0B2559] font-semibold">
                              <FileSpreadsheet className="w-3.5 h-3.5 text-[#D97706]" />
                              Appendix
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                            <Lock className="w-3 h-3" />
                            Mở 35% + Phân tích Rubric
                          </span>
                        </div>
                      </div>

                      {/* Dashed Footer Row */}
                      <div className="mt-5 pt-4 border-t border-dashed border-slate-200 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0">
                          <span className="inline-flex items-center gap-1 font-mono tabular-nums shrink-0">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {sample.publishedDate}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="truncate font-semibold text-slate-600">
                            {getShortSchoolName(sample.school)}
                          </span>
                        </div>

                        <div className="inline-flex items-center gap-2.5 shrink-0">
                          <span className="text-xs font-bold text-slate-900 group-hover:text-[#12489B] transition-colors">
                            Xem Rubric &amp; Bài mẫu
                          </span>
                          <span className="w-9 h-9 rounded-full bg-[#0B2559] group-hover:bg-[#12489B] text-white flex items-center justify-center transition-colors shadow-xs">
                            <ArrowRight className="w-4 h-4" />
                          </span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>

                {/* Smart Windowed Pagination */}
                {totalPages > 1 && (
                  <nav
                    aria-label="Phân trang thư viện bài mẫu"
                    className="flex items-center justify-center gap-1.5 pt-2 flex-wrap"
                  >
                    <button
                      type="button"
                      disabled={safePage <= 1}
                      onClick={() => handleChangePage(safePage - 1)}
                      className="btn-press inline-flex items-center gap-1 px-3.5 py-2 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:border-[#12489B] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Trước</span>
                    </button>

                    {paginationItems.map((entry, idx) =>
                      entry === 'ellipsis' ? (
                        <span
                          key={`ellipsis-${idx}`}
                          className="px-2 text-xs font-bold text-slate-400 select-none"
                        >
                          ...
                        </span>
                      ) : (
                        <button
                          key={entry}
                          type="button"
                          onClick={() => handleChangePage(entry)}
                          className={`btn-press w-9 h-9 rounded-full text-xs font-bold font-mono tabular-nums transition-colors ${
                            entry === safePage
                              ? 'bg-[#0B2559] text-white shadow-sm'
                              : 'bg-white border border-slate-200 text-slate-700 hover:border-[#12489B] hover:text-[#12489B]'
                          }`}
                        >
                          {entry}
                        </button>
                      )
                    )}

                    <button
                      type="button"
                      disabled={safePage >= totalPages}
                      onClick={() => handleChangePage(safePage + 1)}
                      className="btn-press inline-flex items-center gap-1 px-3.5 py-2 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:border-[#12489B] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <span>Sau</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </nav>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
