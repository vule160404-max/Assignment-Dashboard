import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  FileCheck2,
  FileText,
  GraduationCap,
  Layers,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface HeroWorkspacePreviewProps {
  onOpenOrder: () => void;
  onOpenChecker: () => void;
  onOpenSamples: () => void;
}

type PreviewTabKey = 'editor' | 'turnitin' | 'samples';
type SampleLang = 'en' | 'vi';

interface WorkspaceSampleDoc {
  id: string;
  lang: SampleLang;
  fileName: string;
  docHeaderMeta: string[];
  rubricBadge: string;
  authorLabel: string;
  sectionHeading: string;
  beforeMark: string;
  markText: string;
  afterMark: string;
  citation: string;
  middleText: string;
  autocompleteText: string;
  footerMeta: string;
  orderCta: string;
  sourcesTitle: string;
  sourcesPill: string;
  sources: { code: string; title: string; meta: string }[];
  qcTitle: string;
  qcScore: string;
  qcMetrics: { name: string; score: string; color: string }[];
  qcGiftTitle: string;
  qcGiftDesc: string;
}

const WORKSPACE_TABS: { key: PreviewTabKey; label: string; shortLabel: string }[] = [
  { key: 'editor', label: 'Soạn thảo & Trích dẫn', shortLabel: 'Soạn thảo' },
  { key: 'turnitin', label: 'Kiểm định Turnitin & AI', shortLabel: 'Turnitin & AI' },
  { key: 'samples', label: 'Thư viện Bài mẫu', shortLabel: 'Bài mẫu' },
];

const EDITOR_SAMPLES: WorkspaceSampleDoc[] = [
  {
    id: 'en-strategy',
    lang: 'en',
    fileName: 'BUSM2570 · Strategic_Retail_HD.docx',
    docHeaderMeta: ['Academic English', 'Harvard Style', '2,500 words'],
    rubricBadge: 'Rubric Aligned',
    authorLabel: 'Written by MSc Business & Strategy',
    sectionHeading: '2.1 Dynamic Capabilities & Retail Supply Resilience',
    beforeMark: 'Empirical research across omnichannel retailers indicates that deploying ',
    markText: 'agile inventory reconfiguration',
    afterMark: ' strengthens operational responsiveness during demand shocks ',
    citation: '(Porter & Kramer, 2019)',
    middleText:
      '. Longitudinal data from 42 APAC retail networks confirms that standardizing point-of-sale telemetry',
    autocompleteText:
      ' lowers holding costs by 18.4% while lifting service fulfillment to 4.7/5 (Teece et al., 2023).',
    footerMeta: 'Similarity: 3% · AI: 0% · Times New Roman 12pt',
    orderCta: 'Order Similar Paper',
    sourcesTitle: 'Academic Sources (15)',
    sourcesPill: 'DOI Verified',
    sources: [
      {
        code: 'Peer-Reviewed · 2024',
        title: 'Supply Chain Agility in Omnichannel Retail',
        meta: 'Porter, M. & Kramer · J. Strategy · DOI Verified',
      },
      {
        code: 'Q1 Journal · 2023',
        title: 'Dynamic Capabilities & Firm Performance',
        meta: 'Teece, D. & Peteraf · Strategic Mgmt J.',
      },
      {
        code: 'Empirical · 2023',
        title: 'Retail Telemetry Modeling in APAC Markets',
        meta: 'Nguyen, T. & Lee · Int. Business Review',
      },
    ],
    qcTitle: 'Quality Audit',
    qcScore: 'HD 88/100',
    qcMetrics: [
      { name: 'Marking Rubric Coverage', score: '96%', color: 'bg-[#12489B]' },
      { name: 'Critical Analysis Depth', score: '92%', color: 'bg-emerald-600' },
      { name: 'Peer-Reviewed Citations', score: '100%', color: 'bg-emerald-600' },
    ],
    qcGiftTitle: 'Included Free:',
    qcGiftDesc: 'Official Non-Repository Turnitin Similarity & AI PDF Report.',
  },
  {
    id: 'en-finance',
    lang: 'en',
    fileName: 'FNCE30010 · Corporate_Valuation_H1.docx',
    docHeaderMeta: ['Academic English', 'APA 7th Edition', '3,000 words'],
    rubricBadge: 'Rubric Aligned',
    authorLabel: 'Written by MSc Finance & Econometrics',
    sectionHeading: '3.2 Capital Structure & Weighted Cost of Capital',
    beforeMark: 'Under dynamic trade-off theory, listed enterprises balance tax shields against ',
    markText: 'marginal financial distress costs',
    afterMark: ' when calibrating long-term target leverage ratios ',
    citation: '(Modigliani & Miller, 2020)',
    middleText:
      '. Fixed-effects panel regression on ASX-200 constituents demonstrates that optimal debt discipline',
    autocompleteText:
      ' reduces firm WACC by 115 bps across capital-intensive utilities (Fama & French, 2022).',
    footerMeta: 'Similarity: 2% · AI: 0% · Times New Roman 12pt',
    orderCta: 'Order Similar Paper',
    sourcesTitle: 'Academic Sources (18)',
    sourcesPill: 'DOI Verified',
    sources: [
      {
        code: 'Q1 Finance · 2023',
        title: 'Dynamic Capital Structure & Debt Capacity',
        meta: 'Graham, J. & Leary · J. Financial Economics',
      },
      {
        code: 'Econometrics · 2022',
        title: 'Cost of Equity & Multi-Factor Asset Pricing',
        meta: 'Fama, E. & French · Review of Finance',
      },
      {
        code: 'Empirical · 2024',
        title: 'ASX-200 Leverage Sensitivity Analysis',
        meta: 'Chen, W. & Patel · Corporate Finance Rev.',
      },
    ],
    qcTitle: 'Quality Audit',
    qcScore: 'H1 86/100',
    qcMetrics: [
      { name: 'Marking Rubric Coverage', score: '95%', color: 'bg-[#12489B]' },
      { name: 'Econometric Rigor', score: '94%', color: 'bg-emerald-600' },
      { name: 'Peer-Reviewed Citations', score: '100%', color: 'bg-emerald-600' },
    ],
    qcGiftTitle: 'Included Free:',
    qcGiftDesc: 'Full Excel DCF Workbook, Stata Output & Turnitin AI Report.',
  },
  {
    id: 'vi-strategy',
    lang: 'vi',
    fileName: 'LV_ThacSi_QTKD_UEH.docx',
    docHeaderMeta: ['Tiếng Việt học thuật', 'Chuẩn APA 7th', '12,000 từ'],
    rubricBadge: 'Chuẩn Đề cương',
    authorLabel: 'Biên soạn: ThS. Quản trị Kinh doanh',
    sectionHeading: '2.1 Năng lực động và Khả năng phục hồi Chuỗi cung ứng',
    beforeMark: 'Kết quả phân tích chuỗi giá trị cho thấy doanh nghiệp bán lẻ áp dụng mô hình ',
    markText: 'tái cấu trúc tồn kho linh hoạt',
    afterMark: ' duy trì hiệu suất vượt trội trong giai đoạn biến động cầu ',
    citation: '(Nguyễn & Trần, 2023)',
    middleText:
      '. Thực nghiệm tại 42 chuỗi bán lẻ khu vực phía Nam chứng minh việc chuẩn hóa dữ liệu điểm bán',
    autocompleteText:
      ' giúp giảm 18,4% chi phí lưu kho và nâng tỷ lệ đáp ứng đơn hàng lên 96,2% (Lê, 2024).',
    footerMeta: 'Tương đồng: 4% · AI: 0% · Times New Roman 12pt',
    orderCta: 'Đặt bài tương tự',
    sourcesTitle: 'Nguồn học thuật (22)',
    sourcesPill: 'Tạp chí uy tín',
    sources: [
      {
        code: 'Tạp chí KT&PT · 2024',
        title: 'Chuỗi cung ứng linh hoạt trong ngành Bán lẻ',
        meta: 'Nguyễn Văn Minh & Trần · Tạp chí Kinh tế & PT',
      },
      {
        code: 'Hội thảo QG · 2023',
        title: 'Năng lực động và Năng lực cạnh tranh Doanh nghiệp',
        meta: 'Lê Hoàng Nam · ĐH Kinh tế TP.HCM',
      },
      {
        code: 'Thực nghiệm · 2024',
        title: 'Mô hình hóa dữ liệu bán lẻ đa kênh tại Việt Nam',
        meta: 'Phạm Quỳnh Anh · Nghiên cứu Kinh tế',
      },
    ],
    qcTitle: 'Kiểm định chất lượng',
    qcScore: '9.0 / 10',
    qcMetrics: [
      { name: 'Bám sát Đề cương & Rubric', score: '96%', color: 'bg-[#12489B]' },
      { name: 'Chiều sâu lập luận phản biện', score: '92%', color: 'bg-emerald-600' },
      { name: 'Trích dẫn khoa học hợp lệ', score: '100%', color: 'bg-emerald-600' },
    ],
    qcGiftTitle: 'Tặng kèm:',
    qcGiftDesc: 'File kiểm định Turnitin chính hãng (Không lưu kho trường).',
  },
  {
    id: 'vi-spss',
    lang: 'vi',
    fileName: 'KLTN_TaiChinh_SPSS_NEU.docx',
    docHeaderMeta: ['Tiếng Việt học thuật', 'Chuẩn APA 7th', '8,500 từ'],
    rubricBadge: 'Chuẩn Hội đồng',
    authorLabel: 'Biên soạn: ThS. Tài chính – Kinh tế lượng',
    sectionHeading: '3.2 Kiểm định Mô hình Hồi quy Tuyến tính Đa biến (OLS)',
    beforeMark: 'Hệ số phóng đại phương sai VIF đều nhỏ hơn 2,0 khẳng định mô hình không xuất hiện ',
    markText: 'hiện tượng đa cộng tuyến',
    afterMark: ' giữa các biến độc lập giải thích tỷ suất sinh lời ',
    citation: '(Phạm & Hoàng, 2024)',
    middleText:
      '. Kết quả phân tích SPSS 26 trên mẫu khảo sát 315 doanh nghiệp niêm yết cho thấy biến chuyển đổi số',
    autocompleteText:
      ' tác động cùng chiều lên ROA với mức ý nghĩa thống kê p < 0,01 (Đặng, 2023).',
    footerMeta: 'Tương đồng: 3% · AI: 0% · Times New Roman 12pt',
    orderCta: 'Đặt bài tương tự',
    sourcesTitle: 'Nguồn học thuật (20)',
    sourcesPill: 'Tạp chí uy tín',
    sources: [
      {
        code: 'Tài chính · 2024',
        title: 'Chuyển đổi số và Hiệu quả Tài chính Doanh nghiệp',
        meta: 'Phạm Đức Mạnh & Hoàng · Tạp chí Tài chính',
      },
      {
        code: 'Kinh tế lượng · 2023',
        title: 'Ứng dụng Hồi quy Đa biến SPSS trong Nghiên cứu',
        meta: 'Đặng Thị Thu Hà · ĐH Kinh tế Quốc dân',
      },
      {
        code: 'Thực nghiệm · 2024',
        title: 'Quản trị Vốn lưu động và Tỷ suất Sinh lời ROA',
        meta: 'Bùi Xuân Trường · Tạp chí Ngân hàng',
      },
    ],
    qcTitle: 'Kiểm định chất lượng',
    qcScore: '9.2 / 10',
    qcMetrics: [
      { name: 'Chuẩn mô hình Định lượng', score: '97%', color: 'bg-[#12489B]' },
      { name: 'Diễn giải Output SPSS/SmartPLS', score: '95%', color: 'bg-emerald-600' },
      { name: 'Trích dẫn khoa học hợp lệ', score: '100%', color: 'bg-emerald-600' },
    ],
    qcGiftTitle: 'Tặng kèm:',
    qcGiftDesc: 'Toàn bộ file Data (.sav), Output SPSS & báo cáo Turnitin.',
  },
];

const TURNITIN_CHECKS = [
  { label: 'Biên soạn 100% bởi Thạc sĩ chuyên ngành', value: 'Human Written', tone: 'emerald' as const },
  { label: 'Trích dẫn chuẩn DOI / Peer-Reviewed', value: '15 / 15 đạt', tone: 'emerald' as const },
  { label: 'Tỷ lệ tương đồng Turnitin (Non-repository)', value: '4% An toàn', tone: 'emerald' as const },
  { label: 'AI Detection (Turnitin AI Module)', value: '0% Human', tone: 'blue' as const },
];

const SAMPLE_CARDS = [
  {
    code: 'BUSM2570',
    school: 'RMIT University',
    title: 'Business Decision Making – Strategic Retail Expansion',
    score: '88% HD',
    meta: '2,500 words · Harvard · Turnitin 3%',
  },
  {
    code: 'FNCE30010',
    school: 'University of Melbourne',
    title: 'Corporate Valuation & WACC Sensitivity Modeling',
    score: '84% H1',
    meta: '3,000 words · APA 7th · SPSS & Excel',
  },
  {
    code: 'MKT20025',
    school: 'Swinburne University',
    title: 'Omnichannel Consumer Journey & Attribution Audit',
    score: '86% HD',
    meta: '2,200 words · Harvard · Full Data Tables',
  },
];

export function HeroWorkspacePreview({
  onOpenOrder,
  onOpenChecker,
  onOpenSamples,
}: HeroWorkspacePreviewProps) {
  const [activeTab, setActiveTab] = useState<PreviewTabKey>('editor');
  const [sampleIdx, setSampleIdx] = useState(0);
  const [typedLen, setTypedLen] = useState(38);
  const [paused, setPaused] = useState(false);

  const currentSample = EDITOR_SAMPLES[sampleIdx];
  const fullAutocomplete = currentSample.autocompleteText;

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
        prev >= fullAutocomplete.length ? 16 : prev + 1
      );
    }, 55);

    return () => window.clearInterval(interval);
  }, [paused, activeTab, fullAutocomplete.length]);

  const handleSelectLanguage = (targetLang: SampleLang) => {
    const firstMatchIdx = EDITOR_SAMPLES.findIndex((s) => s.lang === targetLang);
    if (firstMatchIdx !== -1) {
      setSampleIdx(firstMatchIdx);
      setTypedLen(20);
    }
  };

  const handleSwitchNextSample = () => {
    const sameLangSamples = EDITOR_SAMPLES
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => item.lang === currentSample.lang);

    if (sameLangSamples.length > 1) {
      const curPos = sameLangSamples.findIndex((entry) => entry.idx === sampleIdx);
      const nextEntry = sameLangSamples[(curPos + 1) % sameLangSamples.length];
      setSampleIdx(nextEntry.idx);
      setTypedLen(18);
    } else {
      setSampleIdx((prev) => (prev + 1) % EDITOR_SAMPLES.length);
      setTypedLen(18);
    }
  };

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
            {currentSample.fileName}
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
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[360px] divide-y lg:divide-y-0 lg:divide-x divide-slate-200/80">
          {/* Left Pane: Verified Sources (Strictly matches sample language) */}
          <div className="lg:col-span-3 p-4 bg-[#FCFCFF] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {currentSample.sourcesTitle}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200/80 shrink-0">
                {currentSample.sourcesPill}
              </span>
            </div>

            <div className="space-y-2">
              {currentSample.sources.map((src, idx) => (
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

          {/* Center Pane: Live Paper Editor + Language & Sample Switcher */}
          <div className="lg:col-span-6 p-5 sm:p-6 bg-white flex flex-col justify-between gap-4">
            <div className="space-y-3">
              {/* Sample Language & Article Switcher Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  {currentSample.docHeaderMeta.map((item, i) => (
                    <span
                      key={item}
                      className={i === 0 ? 'text-slate-900 font-semibold' : ''}
                    >
                      {item}
                    </span>
                  ))}
                  <span className="hidden sm:inline-flex items-center gap-1 text-emerald-700 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {currentSample.rubricBadge}
                  </span>
                </div>

                {/* Language Switch + Cycle Another Sample Button */}
                <div className="flex items-center gap-1.5">
                  <div
                    className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200/80"
                    role="group"
                    aria-label="Chọn ngôn ngữ bài mẫu"
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectLanguage('en')}
                      className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold transition-colors cursor-pointer ${
                        currentSample.lang === 'en'
                          ? 'bg-white text-[#0B2559] shadow-2xs'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      English
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectLanguage('vi')}
                      className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold transition-colors cursor-pointer ${
                        currentSample.lang === 'vi'
                          ? 'bg-white text-[#0B2559] shadow-2xs'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      Tiếng Việt
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleSwitchNextSample}
                    title="Chuyển bài mẫu khác"
                    className="btn-press inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0B2559]/[0.06] hover:bg-[#0B2559] text-[#0B2559] hover:text-white border border-[#0B2559]/15 text-[10.5px] font-semibold transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Đổi bài mẫu</span>
                  </button>
                </div>
              </div>

              {/* Human MSc Author Badge */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50/80 border border-blue-200/70 text-[10.5px] font-semibold text-[#12489B]">
                <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                <span>{currentSample.authorLabel}</span>
              </div>

              <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                {currentSample.sectionHeading}
              </h3>

              <p className="text-[13px] sm:text-[13.5px] leading-[1.75] text-slate-700">
                {currentSample.beforeMark}
                <mark className="bg-amber-100/85 text-slate-900 px-1 rounded">
                  {currentSample.markText}
                </mark>
                {currentSample.afterMark}
                <span className="text-[#12489B] font-medium">
                  {currentSample.citation}
                </span>
                {currentSample.middleText}
                <span className="text-slate-400 transition-opacity">
                  {fullAutocomplete.slice(0, typedLen)}
                </span>
                <span
                  aria-hidden="true"
                  className="jenni-caret inline-block w-[2px] h-3.5 bg-[#12489B] align-middle ml-0.5"
                />
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
              <span className="font-mono">{currentSample.footerMeta}</span>
              <button
                type="button"
                onClick={onOpenOrder}
                className="inline-flex items-center gap-1 font-semibold text-[#12489B] hover:text-[#0B2559] cursor-pointer"
              >
                <span>{currentSample.orderCta}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right Pane: Rubric & QC Inspector (Strictly matches sample language) */}
          <div className="lg:col-span-3 p-4 bg-[#FCFCFF] flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {currentSample.qcTitle}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#0B2559] text-white text-[10px] font-bold font-mono">
                  {currentSample.qcScore}
                </span>
              </div>

              <div className="space-y-2">
                {currentSample.qcMetrics.map((metric) => (
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
              <span className="font-semibold text-[#0B2559]">{currentSample.qcGiftTitle}</span>{' '}
              {currentSample.qcGiftDesc}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'turnitin' && (
        <div className="p-5 sm:p-8 bg-white grid grid-cols-1 lg:grid-cols-12 gap-6 items-center min-h-[360px]">
          <div className="lg:col-span-5 space-y-4">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-[11px] font-bold text-[#12489B]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Kiểm định độc lập trước bàn giao</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Thạc sĩ trực tiếp viết — AI 0% &amp; Turnitin an toàn
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Mỗi bài làm do đội ngũ Thạc sĩ chuyên ngành biên soạn trực tiếp, đối chiếu DOI thật và tặng báo cáo Turnitin không lưu kho.
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
        <div className="p-5 sm:p-8 bg-white space-y-5 min-h-[360px] flex flex-col justify-between">
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
