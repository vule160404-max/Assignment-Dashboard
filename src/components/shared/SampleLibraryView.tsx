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
  Image as ImageIcon,
  Layers,
  Loader2,
  RotateCcw,
  Search,
  Table2,
} from 'lucide-react';
import {
  fetchSampleCatalog,
  getShortSchoolName,
  type SampleCatalogIndex,
  type SampleCatalogItem,
} from '../../services/sampleLibraryService';
import { SampleUniversityBadge } from './SampleUniversityBadge';
import { SampleReaderView } from './SampleReaderView';

interface SampleLibraryViewProps {
  onOrderNow: () => void;
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
  onOrderNow,
  onBackHome,
}: SampleLibraryViewProps) {
  const [catalog, setCatalog] = useState<SampleCatalogIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const [selectedSlug, setSelectedSlug] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('sample');
  });

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

  const items = catalog?.items ?? [];
  const schools = catalog?.schools ?? [];

  const activeItem: SampleCatalogItem | null = useMemo(() => {
    if (!selectedSlug || items.length === 0) return null;
    return items.find((item) => item.slug === selectedSlug || item.id === selectedSlug) || null;
  }, [items, selectedSlug]);

  // Synchronize ?sample=<slug> query parameter cleanly
  useEffect(() => {
    if (typeof window === 'undefined' || loading) return;
    const url = new URL(window.location.href);
    if (activeItem) {
      url.searchParams.set('sample', activeItem.slug);
    } else {
      url.searchParams.delete('sample');
    }
    window.history.replaceState({}, '', url.toString());
  }, [activeItem, loading]);

  const stats = useMemo(() => {
    let totalWords = 0;
    let withTablesOrImages = 0;
    let withAppendix = 0;
    for (const item of items) {
      totalWords += item.wordCount || 0;
      if (item.tableCount > 0 || item.imageCount > 0) withTablesOrImages++;
      if (item.hasAppendix) withAppendix++;
    }
    return {
      totalWords,
      withTablesOrImages,
      withAppendix,
    };
  }, [items]);

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
    setSelectedSlug(slug);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleChangePage = (page: number) => {
    setCurrentPage(page);
    document
      .getElementById('sample-catalog-results')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Render full 3-column Scholarly Reader View when a sample is active
  if (activeItem) {
    return (
      <SampleReaderView
        activeItem={activeItem}
        allItems={items}
        onSelectSample={handleOpenSample}
        onBackToList={() => {
          setSelectedSlug(null);
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
                <span>AssignTrack Academic Sample Library</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-white leading-[1.15]">
                Thư viện Bài mẫu Đại học Quốc tế{' '}
                <span className="text-sky-300">Toàn văn đầy đủ</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-200/85 leading-relaxed">
                Trọn bộ bài mẫu nguyên văn dài hàng nghìn từ của các trường Đại học Úc, Anh, Mỹ, Canada &amp; Quốc tế — giữ nguyên đầy đủ bảng dữ liệu, hình ảnh biểu đồ, danh mục nguồn trích dẫn (References) và Phụ lục (Appendix).
              </p>
            </div>

            {/* Compact Live Library Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
              <div className="rounded-2xl bg-white/10 border border-white/15 px-3.5 py-2.5">
                <div className="text-lg font-bold font-mono tabular-nums text-white">
                  {items.length || '122'}
                </div>
                <div className="text-[11px] text-sky-200">Bài mẫu toàn văn</div>
              </div>
              <div className="rounded-2xl bg-white/10 border border-white/15 px-3.5 py-2.5">
                <div className="text-lg font-bold font-mono tabular-nums text-amber-300">
                  {schools.length || '25'}
                </div>
                <div className="text-[11px] text-sky-200">Trường Đại học</div>
              </div>
              <div className="rounded-2xl bg-white/10 border border-white/15 px-3.5 py-2.5">
                <div className="text-lg font-bold font-mono tabular-nums text-white">
                  {stats.totalWords > 0
                    ? `${Math.round(stats.totalWords / 1000)}K+`
                    : '245K+'}
                </div>
                <div className="text-[11px] text-sky-200">Tổng từ học thuật</div>
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
                placeholder="Tìm theo tên môn, mã môn (BUSM2570, MKTG1205, OMGT...), tên trường (RMIT, Northampton, Melbourne...) hoặc chủ đề..."
                className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-white text-slate-900 placeholder:text-slate-400 text-xs sm:text-sm font-medium shadow-lg focus:outline-none focus:ring-2 focus:ring-[#F5B700]"
              />
            </div>
          </div>
        </div>
      </section>

      <section
        id="sample-catalog"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-7"
      >
        {loading ? (
          <div className="py-20 bg-white rounded-3xl border border-slate-200 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 text-[#12489B] animate-spin" />
            <div className="text-sm font-semibold text-slate-700">
              Đang tải danh mục bài mẫu &amp; logo các trường đại học...
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
            {/* OUTSIDE UNIVERSITY LOGO SHOWCASE & QUICK-FILTER GRID (ALL 25 UNIVERSITIES) */}
            <div className="rounded-3xl bg-white border border-slate-200/90 p-5 sm:p-6 shadow-[0_6px_24px_rgba(11,37,89,0.04)] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-[#0B2559]">
                    Logo các Trường Đại học ({schools.length} trường · {items.length} bài mẫu)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Nhấn trực tiếp vào logo trường bên dưới để lọc nhanh toàn bộ bài mẫu của trường đó
                  </p>
                </div>
                {schoolFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => {
                      setSchoolFilter('all');
                      setCurrentPage(1);
                    }}
                    className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-[#12489B] text-xs font-bold hover:bg-blue-100 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Xem tất cả {schools.length} trường</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-9 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setSchoolFilter('all');
                    setCurrentPage(1);
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
                </button>

                {schools.map((uni) => {
                  const isSelected = schoolFilter === uni.name;
                  return (
                    <button
                      key={uni.name}
                      type="button"
                      onClick={() => {
                        setSchoolFilter(isSelected ? 'all' : uni.name);
                        setCurrentPage(1);
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
                    </button>
                  );
                })}
              </div>
            </div>

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
                <button
                  type="button"
                  onClick={onBackHome}
                  className="text-xs font-semibold text-[#12489B] hover:underline whitespace-nowrap"
                >
                  ← Trang chủ
                </button>
              </div>
            </div>

            {/* 2-COLUMN SAMPLE CARD GRID (Crisp White University Logo Cards) */}
            {filteredSamples.length === 0 ? (
              <div className="py-16 text-center bg-white rounded-3xl border border-slate-200 space-y-3">
                <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
                <div className="text-sm font-bold text-slate-800">
                  Không tìm thấy bài mẫu khớp bộ lọc hiện tại
                </div>
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="btn-press px-4 py-2 rounded-full bg-[#0B2559] text-white text-xs font-bold"
                >
                  Đặt lại toàn bộ bộ lọc
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {paginatedSamples.map((sample) => (
                    <article
                      key={sample.slug}
                      onClick={() => handleOpenSample(sample.slug)}
                      className="card-interactive group cursor-pointer rounded-3xl bg-white border border-slate-200/90 p-5 sm:p-6 flex flex-col justify-between shadow-[0_6px_24px_rgba(11,37,89,0.04)]"
                    >
                      <div className="space-y-4">
                        {/* Top row: Official University Logo Box + Pills + Title */}
                        <div className="flex items-start gap-4">
                          <SampleUniversityBadge
                            logoUrl={sample.logoUrl}
                            schoolName={sample.school}
                            size="md"
                          />

                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                              <span className="px-2.5 py-0.5 rounded-full bg-[#0B2559] text-white font-bold">
                                Free sample
                              </span>
                              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-[#12489B] font-semibold">
                                {sample.major}
                              </span>
                              {sample.gradeLabel && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 font-mono font-bold">
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
                        </div>
                      </div>

                      {/* Dashed Footer Row matching reference layout */}
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
                            Đọc thêm
                          </span>
                          <span className="w-9 h-9 rounded-full bg-[#0B2559] group-hover:bg-[#12489B] text-white flex items-center justify-center transition-colors shadow-xs">
                            <ArrowRight className="w-4 h-4" />
                          </span>
                        </div>
                      </div>
                    </article>
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
