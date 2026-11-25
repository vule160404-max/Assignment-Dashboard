import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChevronDown,
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
  SlidersHorizontal,
  Table2,
  X,
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
const FEATURED_SCHOOL_LIMIT = 7;

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
  const [showAllSchools, setShowAllSchools] = useState(false);

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
    const matchedIdx = schools.findIndex(
      (s) => toSchoolSlug(s.name) === pendingSchoolSlug.toLowerCase()
    );
    if (matchedIdx >= 0) {
      setSchoolFilter(schools[matchedIdx].name);
      if (matchedIdx >= FEATURED_SCHOOL_LIMIT) {
        setShowAllSchools(true);
      }
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
    if (window.location.pathname === '/dat-bai') return;

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
        'Thư Viện Bài Mẫu Đại Học Quốc Tế & Tra Cứu Mã Môn RMIT, Swinburne, Melbourne | AssignTrack',
      description:
        'Tra cứu bài mẫu Assignment, Report, Essay chuẩn High Distinction theo đúng mã môn học của 25 trường Đại học Quốc tế (RMIT, Swinburne, Deakin, Melbourne, Coventry...). Bóc tách Rubric & hỗ trợ viết bài mới độc bản 24/7.',
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

  const featuredSchools = useMemo(
    () => schools.slice(0, FEATURED_SCHOOL_LIMIT),
    [schools]
  );
  const extraSchools = useMemo(
    () => schools.slice(FEATURED_SCHOOL_LIMIT),
    [schools]
  );

  // Unique course-code sniper chips
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
    return result.slice(0, 16);
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
  };

  const handleChangePage = (page: number) => {
    setCurrentPage(page);
    document
      .getElementById('sample-catalog-results')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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
    <div className="bg-[#F6F8FC] min-h-[calc(100vh-4rem)] pb-20">
      {/* Split Editorial Academic Header — Deep Midnight Navy + Architectural 2x2 Ledger */}
      <section className="relative overflow-hidden bg-[#081C44] text-white border-b border-white/10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-28 right-1/4 w-[520px] h-[260px] rounded-full bg-[#1D4ED8]/25 blur-3xl"
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            {/* Left 7 Cols: Title + Copy + Integrated Command Search Bar */}
            <div className="lg:col-span-7 space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.08] border border-white/12 text-[11px] font-semibold tracking-wide text-sky-200">
                <GraduationCap className="w-3.5 h-3.5 text-amber-300" />
                <span>Kho lưu trữ học thuật &amp; Phân tích Marking Rubric</span>
              </div>

              <div className="space-y-2.5">
                <h1 className="text-2xl sm:text-4xl font-bold tracking-[-0.025em] text-white leading-[1.15]">
                  {schoolFilter !== 'all' ? (
                    <>
                      Bài mẫu &amp; Cấu trúc Rubric{' '}
                      <span className="text-sky-300">{schoolFilter}</span>
                    </>
                  ) : (
                    <>
                      Thư viện Bài mẫu &amp; Mã môn học{' '}
                      <span className="text-sky-300">Đại học Quốc tế</span>
                    </>
                  )}
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
                  Đối chiếu trực tiếp bố cục lập luận, bảng phân tích số liệu và danh mục trích dẫn đạt High Distinction tại 25 đại học Úc, Anh, Mỹ, Canada.
                </p>
              </div>

              {/* Clean Command Search Input */}
              <div className="relative max-w-2xl">
                <div className="flex items-center bg-white rounded-2xl p-1.5 shadow-[0_14px_34px_rgba(4,12,30,0.35)] ring-1 ring-white/20 focus-within:ring-2 focus-within:ring-sky-300 transition-shadow">
                  <Search className="w-4 h-4 text-slate-400 ml-3 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Nhập mã môn (BUSM2570, BAFI2094, MKTG2305...) hoặc tên trường..."
                    className="w-full px-3 py-2 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-none"
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setCurrentPage(1);
                      }}
                      aria-label="Xóa từ khóa"
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() =>
                      document
                        .getElementById('sample-catalog-results')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                    className="btn-press hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B2559] hover:bg-[#12489B] text-white text-xs font-semibold shrink-0 transition-colors"
                  >
                    <span>Tra cứu</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right 5 Cols: Unified 2x2 Architectural Metrics Frame */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl bg-white/[0.05] border border-white/12 backdrop-blur-xs grid grid-cols-2 divide-x divide-y divide-white/10 overflow-hidden">
                <div className="p-4 sm:p-5 space-y-1">
                  <div className="text-2xl sm:text-[26px] font-bold font-mono tabular-nums text-white tracking-tight">
                    {items.length || '79'}
                  </div>
                  <div className="text-xs font-medium text-slate-300">
                    Bài mẫu chuẩn HD / DI
                  </div>
                </div>
                <div className="p-4 sm:p-5 space-y-1">
                  <div className="text-2xl sm:text-[26px] font-bold font-mono tabular-nums text-amber-300 tracking-tight">
                    {schools.length || '25'}
                  </div>
                  <div className="text-xs font-medium text-slate-300">
                    Trường Đại học Quốc tế
                  </div>
                </div>
                <div className="p-4 sm:p-5 space-y-1 border-t border-white/10">
                  <div className="text-2xl sm:text-[26px] font-bold font-mono tabular-nums text-sky-300 tracking-tight">
                    {stats.totalWords > 0
                      ? `${Math.round(stats.totalWords / 1000)}K+`
                      : '185K+'}
                  </div>
                  <div className="text-xs font-medium text-slate-300">
                    Tổng từ vựng học thuật
                  </div>
                </div>
                <div className="p-4 sm:p-5 space-y-1 border-t border-white/10">
                  <div className="text-2xl sm:text-[26px] font-bold font-mono tabular-nums text-emerald-300 tracking-tight">
                    {stats.withTablesOrImages || '45+'}
                  </div>
                  <div className="text-xs font-medium text-slate-300">
                    Bài có Bảng số liệu &amp; Hình
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="sample-catalog"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 space-y-5"
      >
        {loading ? (
          <div className="py-20 bg-white rounded-2xl border border-slate-200/90 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-7 h-7 text-[#12489B] animate-spin" />
            <div className="text-xs sm:text-sm font-semibold text-slate-700">
              Đang tải danh mục trường đại học &amp; học phần...
            </div>
          </div>
        ) : error ? (
          <div className="py-16 px-6 bg-white rounded-2xl border border-red-200 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
            <div className="text-sm font-bold text-slate-900">{error}</div>
            <button
              type="button"
              onClick={() => setReloadNonce((n) => n + 1)}
              className="btn-press inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B2559] text-white text-xs font-bold"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Thử tải lại</span>
            </button>
          </div>
        ) : (
          <>
            {/* COMPACT ARCHITECTURAL UNIVERSITY SELECTOR + TRENDING COURSE CODES */}
            <div className="rounded-2xl bg-white border border-slate-200/90 shadow-[0_4px_20px_rgba(15,23,42,0.03)] overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
                      Lọc theo Trường Đại học
                    </h2>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono text-[11px] font-semibold tabular-nums">
                      {schools.length} trường
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
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
                        className="btn-press inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-[#12489B] text-xs font-semibold hover:bg-blue-100 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Bỏ lọc trường</span>
                      </a>
                    )}

                    {extraSchools.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowAllSchools((v) => !v)}
                        className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50/80 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors"
                      >
                        <span>
                          {showAllSchools
                            ? 'Thu gọn danh sách trường'
                            : `+${extraSchools.length} trường khác`}
                        </span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${
                            showAllSchools ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    )}
                  </div>
                </div>

                {/* Single Clean 4/8-Column Featured University Strip (Horizontal Pill Cards, Zero Empty Grid Holes) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
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
                    className={`btn-press rounded-xl border px-3 py-2.5 flex items-center gap-2.5 transition-colors ${
                      schoolFilter === 'all'
                        ? 'bg-[#0B2559] border-[#0B2559] text-white shadow-xs'
                        : 'bg-slate-50/60 border-slate-200/90 text-slate-800 hover:border-slate-300 hover:bg-white'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        schoolFilter === 'all'
                          ? 'bg-white/15 text-amber-300'
                          : 'bg-white border border-slate-200 text-[#0B2559]'
                      }`}
                    >
                      <Layers className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 text-left">
                      <div className="text-xs font-bold leading-tight truncate">
                        Tất cả
                      </div>
                      <div
                        className={`text-[10.5px] font-mono tabular-nums mt-0.5 ${
                          schoolFilter === 'all' ? 'text-sky-200' : 'text-slate-500'
                        }`}
                      >
                        {items.length} bài
                      </div>
                    </div>
                  </a>

                  {featuredSchools.map((uni) => {
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
                        className={`btn-press rounded-xl border px-3 py-2.5 flex items-center gap-2.5 transition-colors ${
                          isSelected
                            ? 'bg-blue-50/90 border-[#12489B] ring-1 ring-[#12489B]'
                            : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/60'
                        }`}
                      >
                        <SampleUniversityBadge
                          logoUrl={uni.logoUrl}
                          schoolName={uni.name}
                          size="xs"
                        />
                        <div className="min-w-0 text-left">
                          <div
                            className={`text-xs font-bold leading-tight truncate ${
                              isSelected ? 'text-[#0B2559]' : 'text-slate-900'
                            }`}
                          >
                            {getShortSchoolName(uni.name)}
                          </div>
                          <div className="text-[10.5px] font-mono tabular-nums text-slate-500 mt-0.5">
                            {uni.count} bài
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </div>

                {/* Expandable Secondary Universities Drawer */}
                {showAllSchools && extraSchools.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2">
                    {extraSchools.map((uni) => {
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
                          className={`btn-press rounded-xl border px-2.5 py-2 flex items-center gap-2 transition-colors ${
                            isSelected
                              ? 'bg-blue-50 border-[#12489B] text-[#0B2559]'
                              : 'bg-slate-50/50 border-slate-200/80 hover:bg-white hover:border-slate-300 text-slate-700'
                          }`}
                        >
                          <SampleUniversityBadge
                            logoUrl={uni.logoUrl}
                            schoolName={uni.name}
                            size="xs"
                            className="!w-7 !h-7 !rounded-md !p-0.5"
                          />
                          <span className="text-[11.5px] font-semibold truncate flex-1 text-left">
                            {getShortSchoolName(uni.name)}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 tabular-nums shrink-0">
                            {uni.count}
                          </span>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Integrated Trending Course Codes Strip */}
              {sniperCourseCodes.length > 0 && (
                <div className="px-4 sm:px-5 py-3 bg-slate-50/90 border-t border-slate-200/80 flex items-center gap-2.5 overflow-x-auto">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
                    <Hash className="w-3.5 h-3.5 text-[#12489B]" />
                    <span>Mã môn phổ biến:</span>
                  </span>
                  <div className="flex items-center gap-1.5 min-w-max">
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
                        className="btn-press inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-[#0B2559] border border-slate-200/90 hover:border-[#0B2559] text-[11.5px] font-mono font-semibold text-slate-800 hover:text-white transition-colors"
                      >
                        <span>{entry.code}</span>
                        <span className="text-[10px] font-sans text-slate-400">
                          {entry.school}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Secondary Facet Filter Toolbar */}
            <div
              id="sample-catalog-results"
              className="scroll-mt-24 flex flex-col lg:flex-row lg:items-center justify-between gap-3 py-1"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 mr-1">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Bộ lọc:</span>
                </span>

                <select
                  value={majorFilter}
                  onChange={(e) => {
                    setMajorFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 rounded-xl bg-white border border-slate-200/90 font-medium text-slate-700 focus:outline-none focus:border-[#12489B]"
                >
                  <option value="all">Chuyên ngành ({majors.length})</option>
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
                  className="px-3 py-2 rounded-xl bg-white border border-slate-200/90 font-medium text-slate-700 focus:outline-none focus:border-[#12489B]"
                >
                  <option value="all">Quốc gia đào tạo</option>
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
                  className="px-3 py-2 rounded-xl bg-white border border-slate-200/90 font-medium text-slate-700 focus:outline-none focus:border-[#12489B]"
                >
                  <option value="all">Cấu trúc dữ liệu</option>
                  <option value="tables">Có bảng số liệu (Tables)</option>
                  <option value="images">Có biểu đồ / mô hình</option>
                  <option value="appendix">Có Phụ lục (Appendix)</option>
                  <option value="references">Có References chuẩn</option>
                </select>

                <select
                  value={sortMode}
                  onChange={(e) => {
                    setSortMode(e.target.value as SortMode);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 rounded-xl bg-white border border-slate-200/90 font-medium text-slate-700 focus:outline-none focus:border-[#12489B]"
                >
                  <option value="default">Sắp xếp: Tiêu biểu</option>
                  <option value="longest">Quy mô từ cao nhất</option>
                  <option value="richest">Nhiều Bảng &amp; Hình nhất</option>
                </select>

                {hasActiveFilter && (
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-[#12489B] hover:bg-blue-50 transition-colors"
                  >
                    Đặt lại
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between lg:justify-end gap-3 text-xs shrink-0">
                <span className="font-semibold text-slate-700 tabular-nums">
                  Hiển thị <strong className="text-slate-900">{filteredSamples.length}</strong> bài mẫu
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200/90 font-mono text-[11px] font-semibold text-slate-600 tabular-nums">
                  Trang {safePage}/{totalPages}
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

            {/* 2-COLUMN EDITORIAL SAMPLE CARDS */}
            {filteredSamples.length === 0 ? (
              <div className="py-16 px-6 text-center bg-white rounded-2xl border border-slate-200/90 space-y-3">
                <BookOpen className="w-9 h-9 text-slate-300 mx-auto" />
                <div className="text-sm font-bold text-slate-900">
                  Chưa có bài mẫu công khai khớp từ khóa "{searchQuery.trim()}"
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Đội ngũ chuyên gia vẫn nhận viết mới độc bản 100% cho đúng mã môn và Rubric học kỳ này của bạn.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="btn-press px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold"
                  >
                    Xem toàn bộ bài mẫu
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
                    className="btn-press inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B2559] hover:bg-[#12489B] text-white text-xs font-semibold"
                  >
                    <span>Nhận báo giá riêng cho môn này</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                      className="card-interactive group cursor-pointer rounded-2xl bg-white border border-slate-200/90 hover:border-[#0B2559]/35 p-5 sm:p-6 flex flex-col justify-between shadow-[0_2px_12px_rgba(15,23,42,0.03)] text-left"
                    >
                      <div className="space-y-3.5">
                        <div className="flex items-start gap-3.5">
                          <SampleUniversityBadge
                            logoUrl={sample.logoUrl}
                            schoolName={sample.school}
                            size="md"
                          />

                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                              {sample.courseCode ? (
                                <span className="px-2 py-0.5 rounded-md bg-[#0B2559] text-white font-mono font-semibold">
                                  {sample.courseCode}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold">
                                  {getShortSchoolName(sample.school)}
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                                {sample.major}
                              </span>
                              {sample.gradeLabel && (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200/80 text-emerald-800 font-mono font-bold">
                                  {sample.gradeLabel}
                                </span>
                              )}
                            </div>

                            <h3 className="text-[15.5px] sm:text-base font-bold text-slate-900 group-hover:text-[#12489B] transition-colors leading-snug line-clamp-2">
                              {sample.title}
                            </h3>
                          </div>
                        </div>

                        <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed line-clamp-2">
                          {sample.excerpt}
                        </p>

                        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[11px] text-slate-500 font-medium">
                          <span className="inline-flex items-center gap-1 font-mono font-semibold text-slate-700 tabular-nums">
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                            {sample.wordCount.toLocaleString('vi-VN')} từ
                          </span>
                          {sample.tableCount > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <Table2 className="w-3.5 h-3.5 text-slate-400" />
                              {sample.tableCount} bảng
                            </span>
                          )}
                          {sample.imageCount > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
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
                            <span className="inline-flex items-center gap-1 text-slate-700 font-semibold">
                              <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600" />
                              Appendix
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0">
                          <span className="font-semibold text-slate-700 truncate">
                            {sample.school}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] tabular-nums shrink-0">
                            <Lock className="w-3 h-3 text-slate-400" />
                            Mở 35% &amp; Rubric
                          </span>
                        </div>

                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0B2559] group-hover:text-[#12489B] shrink-0 transition-colors">
                          <span>Chi tiết</span>
                          <ArrowRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </a>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <nav
                    aria-label="Phân trang thư viện bài mẫu"
                    className="flex items-center justify-center gap-1.5 pt-2 flex-wrap"
                  >
                    <button
                      type="button"
                      disabled={safePage <= 1}
                      onClick={() => handleChangePage(safePage - 1)}
                      className="btn-press inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:border-[#12489B] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
                          className={`btn-press w-9 h-9 rounded-xl text-xs font-bold font-mono tabular-nums transition-colors ${
                            entry === safePage
                              ? 'bg-[#0B2559] text-white'
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
                      className="btn-press inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:border-[#12489B] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
