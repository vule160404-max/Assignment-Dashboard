import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Award,
  BookOpen,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  FileCheck2,
  FileText,
  Globe,
  GraduationCap,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  SAMPLE_LIBRARY_ITEMS,
  SamplePaperItem,
} from '../../data/sampleLibraryData';

interface SampleLibraryViewProps {
  onOrderNow: () => void;
  onBackHome: () => void;
}

export function SampleLibraryView({
  onOrderNow,
  onBackHome,
}: SampleLibraryViewProps) {
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [disciplineFilter, setDisciplineFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [docTypeFilter, setDocTypeFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');

  // Reader utility states
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [readerFontScale, setReaderFontScale] = useState(100);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const disciplines = useMemo(
    () => Array.from(new Set(SAMPLE_LIBRARY_ITEMS.map((i) => i.discipline))),
    []
  );
  const levels = useMemo(
    () => Array.from(new Set(SAMPLE_LIBRARY_ITEMS.map((i) => i.level))),
    []
  );
  const docTypes = useMemo(
    () => Array.from(new Set(SAMPLE_LIBRARY_ITEMS.map((i) => i.docType))),
    []
  );
  const countries = useMemo(
    () => Array.from(new Set(SAMPLE_LIBRARY_ITEMS.map((i) => i.country))),
    []
  );

  const filteredSamples = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return SAMPLE_LIBRARY_ITEMS.filter((item) => {
      if (disciplineFilter !== 'all' && item.discipline !== disciplineFilter) {
        return false;
      }
      if (levelFilter !== 'all' && item.level !== levelFilter) {
        return false;
      }
      if (docTypeFilter !== 'all' && item.docType !== docTypeFilter) {
        return false;
      }
      if (countryFilter !== 'all' && item.country !== countryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.courseCode.toLowerCase().includes(q) ||
        item.discipline.toLowerCase().includes(q) ||
        item.institution.toLowerCase().includes(q) ||
        item.excerpt.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [
    searchQuery,
    disciplineFilter,
    levelFilter,
    docTypeFilter,
    countryFilter,
  ]);

  const activeSample: SamplePaperItem | null = useMemo(
    () =>
      selectedSampleId
        ? SAMPLE_LIBRARY_ITEMS.find((s) => s.id === selectedSampleId) || null
        : null,
    [selectedSampleId]
  );

  const handleOpenSample = (id: string) => {
    setSelectedSampleId(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCopySampleLink = (sample: SamplePaperItem) => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?sample=${encodeURIComponent(
      sample.id
    )}`;
    void navigator.clipboard?.writeText(shareUrl).catch(() => {});
    setCopiedId(sample.id);
    window.setTimeout(() => setCopiedId(null), 1800);
  };

  // =========================================================================
  // 3-COLUMN KNOWLEDGE-BASE READER VIEW (SAMPLE DETAIL)
  // =========================================================================
  if (activeSample) {
    return (
      <div className="py-6 sm:py-8 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto">
        <div className="mb-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSelectedSampleId(null)}
            className="btn-press inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#12489B]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Quay lại Thư viện Bài mẫu ({SAMPLE_LIBRARY_ITEMS.length})</span>
          </button>

          <button
            type="button"
            onClick={onBackHome}
            className="btn-press text-xs font-semibold text-zinc-500 hover:text-slate-900"
          >
            Về trang chủ
          </button>
        </div>

        {/* Rounded 3-Column Workspace Shell */}
        <div className="rounded-3xl border border-zinc-200/90 bg-white shadow-[0_14px_45px_rgba(15,23,42,0.06)] overflow-hidden flex flex-col lg:flex-row min-h-[760px]">
          {/* LEFT SIDEBAR: Dark Navy Sample Navigation */}
          {sidebarOpen && (
            <aside className="lg:w-[260px] shrink-0 bg-[#0B2559] text-white p-4 flex flex-col justify-between gap-6 border-b lg:border-b-0 lg:border-r border-[#163B82]">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-sky-400/20 border border-sky-300/30 flex items-center justify-center text-sky-300 shrink-0">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">
                        Sample Library
                      </div>
                      <div className="text-[10px] text-sky-200/80">
                        AssignTrack Studio
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(false)}
                    title="Thu gọn thanh bên"
                    className="p-1.5 rounded-lg text-sky-200/70 hover:text-white hover:bg-white/10"
                  >
                    <PanelLeftClose className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-sky-200/70 px-2">
                    Bài mẫu nổi bật
                  </div>
                  <div className="space-y-1 max-h-[380px] overflow-y-auto pr-0.5">
                    {SAMPLE_LIBRARY_ITEMS.map((item) => {
                      const isCurrent = item.id === activeSample.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleOpenSample(item.id)}
                          className={`w-full text-left px-2.5 py-2 rounded-xl text-xs transition-colors flex items-start gap-2 ${
                            isCurrent
                              ? 'bg-white/15 border border-sky-300/35 text-white font-semibold'
                              : 'text-slate-300 hover:bg-white/8 hover:text-white'
                          }`}
                        >
                          <FileText className="w-3.5 h-3.5 text-sky-300 shrink-0 mt-0.5" />
                          <span className="line-clamp-2 leading-snug">
                            {item.courseCode} · {item.discipline}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedSampleId(null)}
                  className="w-full px-3 py-2 rounded-xl bg-white/8 hover:bg-white/15 text-xs font-semibold text-sky-200 inline-flex items-center justify-between transition-colors"
                >
                  <span>Tất cả bài mẫu</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Sticky Sidebar Conversion Card */}
              <div className="rounded-2xl bg-white/10 border border-white/15 p-4 space-y-3">
                <div className="text-xs font-bold text-white leading-snug">
                  Cần hỗ trợ bài của riêng bạn?
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Gửi đề bài &amp; Rubric để nhận tư vấn và báo giá chi tiết chỉ trong 15 phút.
                </p>
                <button
                  type="button"
                  onClick={onOrderNow}
                  className="btn-press w-full py-2 px-3 rounded-full bg-gradient-to-r from-[#F59E0B] to-[#EA580C] hover:from-[#D97706] hover:to-[#C2410C] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <span>Order Now</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </aside>
          )}

          {/* CENTER DOCUMENT READER */}
          <main className="flex-1 min-w-0 p-5 sm:p-7 space-y-6 bg-white">
            {/* Top Utility Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-200/80">
              <div className="flex items-center gap-2">
                {!sidebarOpen && (
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    title="Mở thanh danh sách bài mẫu"
                    className="btn-press p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-slate-700"
                  >
                    <PanelLeftOpen className="w-4 h-4" />
                  </button>
                )}
                <span className="px-2.5 py-1 rounded-full bg-[#0B2559] text-white text-[11px] font-bold">
                  Free Sample
                </span>
                <span className="px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-[#12489B] text-[11px] font-semibold">
                  {activeSample.discipline}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setReaderFontScale((s) => Math.max(85, s - 10))
                  }
                  className="btn-press px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-xs font-bold text-slate-700"
                  title="Giảm cỡ chữ"
                >
                  A−
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setReaderFontScale((s) => Math.min(130, s + 10))
                  }
                  className="btn-press px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-xs font-bold text-slate-700"
                  title="Tăng cỡ chữ"
                >
                  A+
                </button>
                <button
                  type="button"
                  onClick={() => handleCopySampleLink(activeSample)}
                  className="btn-press inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-xs font-semibold text-slate-700"
                >
                  {copiedId === activeSample.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Đã sao chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy link</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Document Title & Breadcrumb */}
            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 leading-snug">
                {activeSample.title}
              </h1>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                <span>
                  {activeSample.institution} · {activeSample.country} ·{' '}
                  {activeSample.level}
                </span>
                <span className="inline-flex items-center gap-1 font-mono">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{activeSample.publishedDate}</span>
                </span>
              </div>
            </div>

            {/* Visual Grade & Turnitin Proof Attachment Card */}
            <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-br from-[#F4F7FB] to-white p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-[#0B2559]">
                  <Award className="w-4 h-4 text-amber-500" />
                  <span>Kết quả chấm điểm &amp; Báo cáo kiểm định mẫu</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
                  Chỉ dùng để tham khảo
                </span>
              </div>

              {activeSample.previewImageUrl ? (
                <img
                  src={activeSample.previewImageUrl}
                  alt={activeSample.title}
                  className="w-full rounded-xl border border-zinc-200 shadow-2xs object-cover max-h-80"
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl bg-[#0B2559] text-white p-3.5 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-sky-200/80 font-semibold">
                        Điểm đạt được
                      </div>
                      <div className="text-2xl font-black font-mono text-sky-300 mt-0.5">
                        {activeSample.gradeScore}
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-sky-400/20 border border-sky-300/30 text-sky-200 text-xs font-black font-mono">
                      {activeSample.gradeLabel}
                    </span>
                  </div>

                  <div className="rounded-xl bg-white border border-zinc-200 p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-semibold">
                      <span className="text-zinc-500">Turnitin Similarity</span>
                      <span className="font-mono font-bold text-emerald-700">
                        {activeSample.turnitinPercent}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{
                          width: `${Math.max(8, activeSample.turnitinPercent * 3)}%`,
                        }}
                      />
                    </div>
                    <div className="text-[10px] text-zinc-400">
                      An toàn (&lt; 10% ngưỡng chuẩn)
                    </div>
                  </div>

                  <div className="rounded-xl bg-white border border-zinc-200 p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-semibold">
                      <span className="text-zinc-500">AI Detection</span>
                      <span className="font-mono font-bold text-[#12489B]">
                        {activeSample.aiPercent}% AI
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                      <div className="h-full rounded-full bg-[#12489B] w-[5%]" />
                    </div>
                    <div className="text-[10px] text-zinc-400">
                      Văn phong học thuật tự nhiên
                    </div>
                  </div>
                </div>
              )}

              {/* Rubric Breakdown Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {activeSample.rubricHighlights.map((r) => (
                  <div
                    key={r.criterion}
                    className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-white border border-zinc-200/80 text-[11.5px]"
                  >
                    <span className="text-slate-700 truncate">{r.criterion}</span>
                    <span className="font-mono font-bold text-[#12489B] shrink-0">
                      {r.score}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Formatted Academic Sample Content */}
            <article
              style={{ fontSize: `${readerFontScale}%` }}
              className="rounded-2xl border border-zinc-200/90 bg-white p-5 sm:p-7 space-y-6 leading-relaxed text-slate-800"
            >
              {activeSample.sections.map((sec) => (
                <section key={sec.heading} className="space-y-3">
                  <h2 className="text-[1.12em] font-bold text-slate-900">
                    {sec.heading}
                  </h2>
                  {sec.paragraphs.map((p, idx) => (
                    <p
                      key={idx}
                      className="text-[0.94em] text-slate-700 leading-[1.75]"
                    >
                      {p}
                    </p>
                  ))}
                  {sec.bullets && sec.bullets.length > 0 && (
                    <ul className="list-disc pl-5 space-y-1.5 text-[0.93em] text-slate-700">
                      {sec.bullets.map((b, idx) => (
                        <li key={idx}>{b}</li>
                      ))}
                    </ul>
                  )}
                  {sec.table && (
                    <div className="my-4 space-y-1.5">
                      <div className="text-[0.82em] font-bold text-slate-800">
                        {sec.table.caption}
                      </div>
                      <div className="overflow-x-auto rounded-xl border border-zinc-200">
                        <table className="w-full text-left border-collapse text-[0.84em]">
                          <thead className="bg-[#F4F7FB] text-slate-900">
                            <tr>
                              {sec.table.headers.map((h) => (
                                <th
                                  key={h}
                                  className="px-3 py-2 font-bold border-b border-zinc-200"
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100">
                            {sec.table.rows.map((row, rIdx) => (
                              <tr
                                key={rIdx}
                                className={
                                  rIdx === sec.table!.rows.length - 1
                                    ? 'bg-blue-50/40 font-semibold'
                                    : ''
                                }
                              >
                                {row.map((cell, cIdx) => (
                                  <td
                                    key={cIdx}
                                    className="px-3 py-2 text-slate-700"
                                  >
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {sec.table.sourceNote && (
                        <p className="text-[0.78em] italic text-zinc-500">
                          {sec.table.sourceNote}
                        </p>
                      )}
                    </div>
                  )}
                </section>
              ))}

              {/* Sample References */}
              <section className="pt-4 border-t border-zinc-200 space-y-2.5">
                <h2 className="text-[1.08em] font-bold text-slate-900">
                  References ({activeSample.citationStyle})
                </h2>
                <div className="space-y-2 text-[0.88em] text-slate-700">
                  {activeSample.references.map((ref, idx) => (
                    <p key={idx} className="pl-5 -indent-5 leading-relaxed">
                      {ref}
                    </p>
                  ))}
                </div>
              </section>
            </article>

            {/* Hashtags & Bottom Utility Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex flex-wrap gap-1.5">
                {activeSample.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 rounded-full bg-[#F4F7FB] border border-zinc-200 text-[11px] font-semibold text-slate-600"
                  >
                    # {tag}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-500">
                <button
                  type="button"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="btn-press inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-100 hover:bg-zinc-200 text-slate-700 font-semibold"
                >
                  <ArrowUp className="w-3 h-3" />
                  <span>Lên đầu bài</span>
                </button>
                <span className="font-mono font-semibold text-slate-700">
                  {activeSample.wordCount.toLocaleString('vi-VN')} từ
                </span>
              </div>
            </div>

            {/* Bottom Reader Conversion Bar */}
            <div className="rounded-2xl bg-[#F4F7FB] border border-zinc-200/90 p-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-zinc-600 max-w-md">
                Bài mẫu chỉ mang tính tham khảo cấu trúc &amp; phong cách học thuật. Cần bài viết mới 100% bám sát đề bài của bạn?
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedSampleId(null)}
                  className="btn-press px-3.5 py-2 rounded-full bg-white border border-zinc-200 hover:bg-zinc-50 text-xs font-semibold text-slate-700"
                >
                  Xem thêm bài mẫu
                </button>
                <button
                  type="button"
                  onClick={onOrderNow}
                  className="btn-press inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-[#F59E0B] to-[#EA580C] hover:from-[#D97706] hover:to-[#C2410C] text-white text-xs font-bold shadow-sm"
                >
                  <span>Order Now · Đặt bài tương tự</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </main>

          {/* RIGHT STICKY METADATA PANEL */}
          <aside className="lg:w-[270px] shrink-0 bg-[#F4F7FB] p-5 border-t lg:border-t-0 lg:border-l border-zinc-200/80 space-y-4">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-[#0B2559]">
              <Eye className="w-4 h-4 text-[#12489B]" />
              <span>Thông tin bài mẫu</span>
            </div>

            <div className="space-y-2.5">
              {[
                {
                  icon: FileText,
                  label: 'Thể loại bài',
                  value: activeSample.docType,
                },
                {
                  icon: Globe,
                  label: 'Quốc gia',
                  value: activeSample.country,
                },
                {
                  icon: Building2,
                  label: 'Trường / Chương trình',
                  value: activeSample.institution,
                },
                {
                  icon: GraduationCap,
                  label: 'Độ dài & Chuẩn trích dẫn',
                  value: `${activeSample.wordCount.toLocaleString('vi-VN')} từ · ${activeSample.citationStyle}`,
                },
              ].map((meta) => {
                const Icon = meta.icon;
                return (
                  <div
                    key={meta.label}
                    className="rounded-xl bg-white border border-zinc-200/90 p-3.5 space-y-1"
                  >
                    <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-zinc-500">
                      <Icon className="w-3.5 h-3.5 text-[#12489B]" />
                      <span>{meta.label}</span>
                    </div>
                    <div className="text-xs font-bold text-slate-900">
                      {meta.value}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl bg-blue-50/70 border border-blue-200/70 p-3.5 text-[11px] text-slate-600 leading-relaxed flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-[#12489B] shrink-0 mt-0.5" />
              <span>
                Tài liệu mẫu dùng để tham khảo cách lập luận, trình bày bảng biểu và chuẩn trích dẫn. Vui lòng không sao chép trực tiếp để nộp bài.
              </span>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  // =========================================================================
  // SAMPLE LIBRARY INDEX VIEW
  // =========================================================================
  return (
    <div>
      {/* Dark Navy Compact Hero */}
      <section className="relative overflow-hidden bg-[#0B2559] text-white py-14 sm:py-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #93C5FD 1px, transparent 1px), linear-gradient(to bottom, #93C5FD 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-200">
            <span className="w-2 h-2 rounded-full bg-sky-300" />
            <span>AssignTrack · Thư viện Bài mẫu Học thuật</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-[-0.03em] leading-tight">
            FREE <span className="text-sky-300">SAMPLE LIBRARY</span>
          </h1>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold text-slate-200">
            <span className="inline-flex items-center gap-1.5">
              <FileCheck2 className="w-4 h-4 text-sky-300" />
              <span>Plagiarism Checked</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-sky-300" />
              <span>Distinction &amp; HD Quality</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Peer-Reviewed References</span>
            </span>
          </div>

          <div className="pt-1 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#sample-catalog"
              className="btn-press inline-flex items-center gap-2 pl-5 pr-2 py-2 rounded-full bg-white text-[#0B2559] text-xs font-bold shadow-md"
            >
              <span>Xem bài mẫu</span>
              <span className="w-7 h-7 rounded-full bg-blue-50 text-[#12489B] flex items-center justify-center">
                <ArrowDown className="w-3.5 h-3.5" />
              </span>
            </a>
            <button
              type="button"
              onClick={onOrderNow}
              className="btn-press inline-flex items-center gap-2 pl-5 pr-2 py-2 rounded-full bg-gradient-to-r from-[#F59E0B] to-[#EA580C] hover:from-[#D97706] hover:to-[#C2410C] text-white text-xs font-bold shadow-md"
            >
              <span>Order Now — Đặt bài ngay</span>
              <span className="w-7 h-7 rounded-full bg-white text-[#EA580C] flex items-center justify-center">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </button>
          </div>

          <p className="text-[11.5px] text-slate-300/85 max-w-xl mx-auto">
            Các bài mẫu dưới đây được biên soạn chuẩn học thuật giúp sinh viên tham khảo bố cục, cách phân tích phản biện và định dạng trích dẫn.
          </p>
        </div>
      </section>

      {/* Search & Multi-Facet Filter Bar */}
      <section
        id="sample-catalog"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8"
      >
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Primary Search Pill */}
          <div className="relative flex items-center rounded-full bg-white border-2 border-blue-200/80 shadow-[0_8px_28px_rgba(18,72,155,0.08)] p-1.5">
            <Search className="w-4 h-4 text-[#12489B] ml-3.5 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo mã môn (VD: BUSM2570, FINA3012), tên ngành, trường hoặc từ khóa..."
              className="flex-1 px-3 py-2 text-xs sm:text-sm bg-transparent focus:outline-none text-slate-900 placeholder:text-zinc-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="px-2.5 py-1 text-xs font-semibold text-zinc-400 hover:text-slate-700"
              >
                Xóa
              </button>
            )}
            <span className="w-9 h-9 rounded-full bg-[#0B2559] text-white flex items-center justify-center shrink-0">
              <Search className="w-4 h-4" />
            </span>
          </div>

          {/* 4-Facet Filter Row */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 text-xs">
            <span className="font-bold text-slate-600">Lọc theo:</span>

            <select
              value={disciplineFilter}
              onChange={(e) => setDisciplineFilter(e.target.value)}
              className="px-3.5 py-2 rounded-full bg-white border border-zinc-200 font-semibold text-slate-700 focus:outline-none focus:border-[#12489B]"
            >
              <option value="all">Tất cả Ngành ({disciplines.length})</option>
              {disciplines.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="px-3.5 py-2 rounded-full bg-white border border-zinc-200 font-semibold text-slate-700 focus:outline-none focus:border-[#12489B]"
            >
              <option value="all">Tất cả Cấp bậc</option>
              {levels.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>

            <select
              value={docTypeFilter}
              onChange={(e) => setDocTypeFilter(e.target.value)}
              className="px-3.5 py-2 rounded-full bg-white border border-zinc-200 font-semibold text-slate-700 focus:outline-none focus:border-[#12489B]"
            >
              <option value="all">Tất cả Thể loại bài</option>
              {docTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="px-3.5 py-2 rounded-full bg-white border border-zinc-200 font-semibold text-slate-700 focus:outline-none focus:border-[#12489B]"
            >
              <option value="all">Tất cả Quốc gia</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Results Meta Bar */}
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-zinc-200/80 text-xs">
          <div className="inline-flex items-center gap-2 font-bold text-slate-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{filteredSamples.length} bài mẫu phù hợp</span>
          </div>
          <button
            type="button"
            onClick={onBackHome}
            className="text-xs font-semibold text-[#12489B] hover:underline"
          >
            ← Quay lại Trang chủ
          </button>
        </div>

        {/* 2-Column Sample Card Grid */}
        {filteredSamples.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-3xl border border-zinc-200 space-y-3">
            <BookOpen className="w-10 h-10 text-zinc-300 mx-auto" />
            <div className="text-sm font-bold text-slate-800">
              Không tìm thấy bài mẫu khớp bộ lọc hiện tại
            </div>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setDisciplineFilter('all');
                setLevelFilter('all');
                setDocTypeFilter('all');
                setCountryFilter('all');
              }}
              className="btn-press px-4 py-2 rounded-full bg-[#0B2559] text-white text-xs font-bold"
            >
              Đặt lại bộ lọc
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredSamples.map((sample) => (
              <div
                key={sample.id}
                onClick={() => handleOpenSample(sample.id)}
                className="group cursor-pointer rounded-3xl bg-white border border-zinc-200/90 hover:border-[#12489B]/50 p-6 shadow-[0_8px_28px_rgba(15,23,42,0.03)] hover:shadow-[0_14px_36px_rgba(18,72,155,0.09)] transition-all flex flex-col justify-between gap-5"
              >
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    {/* Left Square Institution Emblem Slot */}
                    <div className="w-16 h-16 rounded-2xl bg-[#F4F7FB] border border-zinc-200/90 flex flex-col items-center justify-center shrink-0 text-center px-1">
                      <span className="text-[11px] font-black font-mono text-[#0B2559] leading-tight">
                        {sample.institutionShort}
                      </span>
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md mt-1">
                        {sample.gradeLabel} · {sample.gradeScore.split('/')[0]}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2.5 py-0.5 rounded-full bg-[#0B2559] text-white text-[10.5px] font-bold">
                          Free Sample
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200/80 text-[#12489B] text-[10.5px] font-semibold">
                          {sample.discipline}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-[10px] font-mono font-bold">
                          Turnitin {sample.turnitinPercent}% · 0% AI
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-slate-900 group-hover:text-[#12489B] transition-colors leading-snug line-clamp-2">
                        {sample.title}
                      </h3>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-600 leading-relaxed line-clamp-3">
                    {sample.excerpt}
                  </p>
                </div>

                {/* Dashed Divider + Footer */}
                <div className="pt-4 border-t border-dashed border-zinc-200 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 text-[11px] text-zinc-500 font-mono">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{sample.publishedDate}</span>
                    </span>
                    <span>· {sample.wordCount.toLocaleString('vi-VN')} từ</span>
                    <span>· {sample.citationStyle}</span>
                  </div>

                  <span className="inline-flex items-center gap-2 text-xs font-bold text-[#0B2559] group-hover:text-[#12489B]">
                    <span>Đọc thêm</span>
                    <span className="w-7 h-7 rounded-full bg-[#0B2559] group-hover:bg-[#12489B] text-white flex items-center justify-center transition-colors">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bottom Conversion Banner */}
        <div className="rounded-3xl bg-gradient-to-r from-[#071A42] via-[#0B2559] to-[#12489B] text-white p-7 sm:p-9 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-lg">
          <div className="space-y-1.5 max-w-xl">
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-sky-300">
              AssignTrack Academic Support
            </div>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight">
              Chưa tìm thấy Sample đúng môn học của bạn?
            </h3>
            <p className="text-xs sm:text-sm text-slate-200/85">
              Gửi ngay đề bài &amp; Rubric của môn bạn đang học để đội ngũ chuyên gia tư vấn cấu trúc và báo giá trong 15 phút.
            </p>
          </div>

          <button
            type="button"
            onClick={onOrderNow}
            className="btn-press shrink-0 inline-flex items-center gap-2.5 pl-6 pr-2 py-2.5 rounded-full bg-gradient-to-r from-[#F59E0B] to-[#EA580C] hover:from-[#D97706] hover:to-[#C2410C] text-white text-sm font-bold shadow-lg"
          >
            <span>Order Now · Nhận hỗ trợ ngay</span>
            <span className="w-8 h-8 rounded-full bg-white text-[#EA580C] flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}
