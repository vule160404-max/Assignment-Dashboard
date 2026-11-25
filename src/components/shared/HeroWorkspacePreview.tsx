import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  FileCheck2,
  FileText,
  Layers,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface HeroWorkspacePreviewProps {
  onOpenOrder: () => void;
  onOpenChecker: () => void;
  onOpenSamples: () => void;
}

type PreviewTabKey = 'editor' | 'turnitin' | 'samples';

const WORKSPACE_TABS: { key: PreviewTabKey; label: string; shortLabel: string }[] = [
  { key: 'editor', label: 'Soạn thảo & Trích dẫn', shortLabel: 'Soạn thảo' },
  { key: 'turnitin', label: 'Kiểm định Turnitin & AI', shortLabel: 'Turnitin & AI' },
  { key: 'samples', label: 'Thư viện Bài mẫu', shortLabel: 'Bài mẫu' },
];

const SOURCE_ITEMS = [
  {
    code: 'Peer-Reviewed · 2024',
    title: 'Supply Chain Agility in Omnichannel Retail',
    meta: 'Porter, M. & Kramer · J. Strategy · DOI Verified',
  },
  {
    code: 'Q1 Journal · 2023',
    title: 'Dynamic Capabilities & Firm Performance',
    meta: 'Teece, D., Peteraf · Strategic Mgmt J. · Harvard',
  },
  {
    code: 'Empirical · 2023',
    title: 'SPSS Regression Modeling in ASEAN Markets',
    meta: 'Nguyen, T. & Lee · Int. Business Review',
  },
];

const TURNITIN_CHECKS = [
  { label: 'Trích dẫn chuẩn DOI / Peer-Reviewed', value: '15 / 15 đạt', tone: 'emerald' as const },
  { label: 'Tỷ lệ tương đồng Turnitin (Non-repository)', value: '4% An toàn', tone: 'emerald' as const },
  { label: 'AI Detection (Turnitin AI Module)', value: '0% Human', tone: 'emerald' as const },
  { label: 'Độ phủ tiêu chí Rubric (Critical Analysis)', value: '96% HD Band', tone: 'blue' as const },
];

const SAMPLE_CARDS = [
  {
    code: 'BUSM2570',
    school: 'RMIT University',
    title: 'Business Decision Making – Strategic Retail Expansion',
    score: '88% HD',
    meta: '2,500 từ · Harvard · Turnitin 3%',
  },
  {
    code: 'FNCE30010',
    school: 'University of Melbourne',
    title: 'Corporate Valuation & WACC Sensitivity Modeling',
    score: '84% H1',
    meta: '3,000 từ · APA 7th · SPSS & Excel',
  },
  {
    code: 'MKT20025',
    school: 'Swinburne University',
    title: 'Omnichannel Consumer Journey & Attribution Audit',
    score: '86% HD',
    meta: '2,200 từ · Harvard · Kèm bảng dữ liệu',
  },
];

const AUTOCOMPLETE_SNIPPET =
  ' giúp giảm 18.4% chi phí tồn kho và nâng điểm hài lòng khách hàng lên 4.7/5 (Teece et al., 2023).';

export function HeroWorkspacePreview({
  onOpenOrder,
  onOpenChecker,
  onOpenSamples,
}: HeroWorkspacePreviewProps) {
  const [activeTab, setActiveTab] = useState<PreviewTabKey>('editor');
  const [typedLen, setTypedLen] = useState(42);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (
      paused ||
      activeTab !== 'editor' ||
      (typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      setTypedLen((prev) =>
        prev >= AUTOCOMPLETE_SNIPPET.length ? 18 : prev + 1
      );
    }, 55);

    return () => window.clearInterval(interval);
  }, [paused, activeTab]);

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="hero-reveal hero-delay-3 mx-auto max-w-6xl mt-10 sm:mt-12 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/90 shadow-[0_24px_70px_-18px_rgba(11,37,89,0.14)] overflow-hidden text-left"
    >
      {/* Clean macOS + Mode Switcher Bar */}
      <div className="px-4 sm:px-5 py-3 bg-[#F8FAFC] border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0" aria-hidden="true">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400/90" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400/90" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/90" />
          </div>
          <span className="hidden md:inline-block h-3.5 w-px bg-slate-200" />
          <span className="text-[12px] font-medium text-slate-600 truncate font-mono">
            BUSM2570 · Strategic_Retail_HD.docx
          </span>
        </div>

        {/* Interactive Mode Switcher */}
        <div
          role="tablist"
          aria-label="Xem trước tính năng AssignTrack"
          className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200/80 overflow-x-auto no-scrollbar max-w-full"
        >
          {WORKSPACE_TABS.map((tab) => {
            const selected = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveTab(tab.key)}
                className={`shrink-0 whitespace-nowrap px-2.5 sm:px-3 py-1.5 sm:py-1 rounded-lg text-[11px] sm:text-[11.5px] font-semibold transition-all cursor-pointer ${
                  selected
                    ? 'bg-[#0B2559] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span className="sm:hidden">{tab.shortLabel}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive Workspace Body */}
      {activeTab === 'editor' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[340px] divide-y lg:divide-y-0 lg:divide-x divide-slate-200/80">
          {/* Left Pane: Verified Sources */}
          <div className="lg:col-span-3 p-4 bg-[#FCFCFF] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Nguồn học thuật (15)
              </span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200/80">
                DOI Thật
              </span>
            </div>

            <div className="space-y-2">
              {SOURCE_ITEMS.map((src, idx) => (
                <div
                  key={src.title}
                  className={`p-2.5 rounded-xl border transition-colors ${
                    idx === 0
                      ? 'bg-white border-blue-200 shadow-2xs'
                      : 'bg-white/70 border-slate-200/70'
                  }`}
                >
                  <div className="text-[10px] font-semibold text-[#12489B]">
                    {src.code}
                  </div>
                  <div className="text-[12px] font-semibold text-slate-900 leading-snug mt-0.5 line-clamp-2">
                    {src.title}
                  </div>
                  <div className="text-[10.5px] text-slate-500 mt-1 truncate">
                    {src.meta}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Center Pane: Live Paper Editor */}
          <div className="lg:col-span-6 p-5 sm:p-6 bg-white flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 text-[11px] text-slate-500">
                <div className="flex items-center gap-3 font-medium">
                  <span className="text-slate-900 font-semibold">Tiếng Anh học thuật</span>
                  <span>Harvard Style</span>
                  <span>2,500 từ</span>
                </div>
                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Bám sát Rubric
                </span>
              </div>

              <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                2.1 Dynamic Capabilities &amp; Retail Supply Resilience
              </h3>

              <p className="text-[13px] sm:text-[13.5px] leading-[1.75] text-slate-700">
                Phân tích chuỗi giá trị cho thấy các doanh nghiệp bán lẻ áp dụng mô hình{' '}
                <mark className="bg-amber-100/85 text-slate-900 px-1 rounded">
                  tái cấu trúc tồn kho linh hoạt
                </mark>{' '}
                đạt hiệu quả vượt trội trong giai đoạn biến động cầu{' '}
                <span className="text-[#12489B] font-medium">
                  (Porter &amp; Kramer, 2019)
                </span>
                . Thực nghiệm tại 42 chuỗi bán lẻ khu vực APAC chứng minh việc chuẩn hóa dữ liệu điểm bán
                <span className="text-slate-400 transition-opacity">
                  {AUTOCOMPLETE_SNIPPET.slice(0, typedLen)}
                </span>
                <span
                  aria-hidden="true"
                  className="jenni-caret inline-block w-[2px] h-3.5 bg-[#12489B] align-middle ml-0.5"
                />
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
              <span className="font-mono">Similarity: 4% · AI: 0% · Chuẩn chữ Times New Roman 12pt</span>
              <button
                type="button"
                onClick={onOpenOrder}
                className="inline-flex items-center gap-1 font-semibold text-[#12489B] hover:text-[#0B2559] cursor-pointer"
              >
                <span>Đặt bài tương tự</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right Pane: Rubric & QC Inspector */}
          <div className="lg:col-span-3 p-4 bg-[#FCFCFF] flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Kiểm định chất lượng
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#0B2559] text-white text-[10px] font-bold font-mono">
                  HD 88/100
                </span>
              </div>

              <div className="space-y-2">
                {[
                  { name: 'Bám sát Rubric đề bài', score: '96%', color: 'bg-[#12489B]' },
                  { name: 'Lập luận phản biện (Critical)', score: '91%', color: 'bg-emerald-600' },
                  { name: 'Trích dẫn Peer-Reviewed', score: '100%', color: 'bg-emerald-600' },
                ].map((metric) => (
                  <div
                    key={metric.name}
                    className="p-2.5 rounded-xl bg-white border border-slate-200/80 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-slate-700">{metric.name}</span>
                      <span className="font-mono font-bold text-slate-900">
                        {metric.score}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${metric.color}`}
                        style={{ width: metric.score }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#0B2559]/[0.04] border border-[#0B2559]/10 text-[11px] text-slate-600 leading-relaxed">
              <span className="font-semibold text-[#0B2559]">Tặng kèm:</span> File PDF Turnitin chính hãng (không lưu kho trường).
            </div>
          </div>
        </div>
      )}

      {activeTab === 'turnitin' && (
        <div className="p-5 sm:p-8 bg-white grid grid-cols-1 lg:grid-cols-12 gap-6 items-center min-h-[340px]">
          <div className="lg:col-span-5 space-y-4">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-[11px] font-bold text-[#12489B]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Kiểm định độc lập trước bàn giao</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Cam kết AI 0% &amp; Turnitin an toàn tuyệt đối
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Mỗi bài viết đều được rà soát từng câu, đối chiếu DOI nguồn thật và xuất báo cáo Turnitin không lưu dữ liệu.
            </p>
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={onOpenChecker}
                className="btn-press inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B2559] hover:bg-[#12489B] text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <span>Thử Check AI Free ngay</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onOpenOrder}
                className="btn-press inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                <span>Đặt giảm AI / Đạo văn</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TURNITIN_CHECKS.map((item) => (
              <div
                key={item.label}
                className="p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200/80 flex items-start gap-3"
              >
                <span
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    item.tone === 'emerald'
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                      : 'bg-blue-50 text-[#12489B] border border-blue-200'
                  }`}
                >
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                </span>
                <div>
                  <div className="text-xs font-medium text-slate-500">{item.label}</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5 font-mono">
                    {item.value}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'samples' && (
        <div className="p-5 sm:p-8 bg-white space-y-5 min-h-[340px] flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#12489B]">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Thư viện toàn văn · 122+ bài mẫu · 25 trường</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Đọc nguyên văn bài điểm High Distinction trước khi đặt
              </h3>
            </div>
            <button
              type="button"
              onClick={onOpenSamples}
              className="btn-press inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B2559] hover:bg-[#12489B] text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <span>Mở toàn bộ Thư viện</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SAMPLE_CARDS.map((card) => (
              <button
                key={card.code}
                type="button"
                onClick={onOpenSamples}
                className="group text-left p-4 rounded-2xl bg-[#F8FAFC] hover:bg-white border border-slate-200/85 hover:border-[#12489B]/40 transition-all cursor-pointer flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-bold text-[#12489B] bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      {card.code}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10.5px] font-bold font-mono">
                      {card.score}
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-500">
                    {card.school}
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 group-hover:text-[#12489B] transition-colors leading-snug line-clamp-2">
                    {card.title}
                  </h4>
                </div>
                <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px] text-slate-500">
                  <span>{card.meta}</span>
                  <FileText className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#12489B]" />
                </div>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-5 text-[11.5px] text-slate-500 pt-1">
            <span className="inline-flex items-center gap-1.5">
              <FileCheck2 className="w-3.5 h-3.5 text-[#12489B]" />
              <span>Giữ nguyên bảng số liệu &amp; biểu đồ</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#12489B]" />
              <span>Đầy đủ mục lục &amp; References chuẩn trường</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#D97706]" />
              <span>Xem trước miễn phí · Hỗ trợ đặt viết mới độc bản</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
