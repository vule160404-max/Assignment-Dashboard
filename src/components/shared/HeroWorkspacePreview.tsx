import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  ExternalLink,
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

interface VerifiedReferenceEntry {
  id: string;
  tag: string;
  shortTitle: string;
  shortMeta: string;
  authorsYear: string;
  articleTitle: string;
  journalName: string;
  issuePages: string;
  doi: string;
}

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
  citation1: string;
  citation1RefId: string;
  sentence2Lead: string;
  citation2: string;
  citation2RefId: string;
  autocompleteLead: string;
  autocompleteText: string;
  referencesHeading: string;
  footerMeta: string;
  orderCta: string;
  sourcesTitle: string;
  sourcesPill: string;
  qcTitle: string;
  qcScore: string;
  qcMetrics: { name: string; score: string; color: string }[];
  qcGiftTitle: string;
  qcGiftDesc: string;
  references: VerifiedReferenceEntry[];
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
    fileName: 'BUSM2570 · Dynamic_Capabilities_HD.docx',
    docHeaderMeta: ['Academic English', 'Harvard Style', '2,500 words'],
    rubricBadge: 'Rubric Aligned',
    authorLabel: 'Written by MSc Business & Strategy',
    sectionHeading: '2.1 Dynamic Capabilities & Supply Chain Resilience',
    beforeMark:
      'The dynamic capabilities perspective emphasizes integrating, building, and reconfiguring internal and external competences to address ',
    markText: 'rapidly changing environments',
    afterMark: ' rather than relying solely on static resource ownership ',
    citation1: '(Teece, Pisano & Shuen, 1997)',
    citation1RefId: 'teece-1997',
    sentence2Lead:
      '. Building resilient supply networks similarly depends on systematic risk mitigation, structural flexibility, and end-to-end visibility across partner tiers ',
    citation2: '(Christopher & Peck, 2004)',
    citation2RefId: 'christopher-2004',
    autocompleteLead:
      '. Extending resource-based theory with empirical survey evidence,',
    autocompleteText:
      ' information sharing and supply chain visibility directly improve organizational resilience and robustness (Brandon-Jones et al., 2014).',
    referencesHeading: 'References',
    footerMeta: 'Similarity: 3% · AI: 0% · Times New Roman 12pt · DOI Verified',
    orderCta: 'Order Similar Paper',
    sourcesTitle: 'Verified Sources (3/15)',
    sourcesPill: 'DOI Checked',
    qcTitle: 'Quality Audit',
    qcScore: 'HD 88/100',
    qcMetrics: [
      { name: 'Marking Rubric Coverage', score: '96%', color: 'bg-[#12489B]' },
      { name: 'Critical Analysis Depth', score: '92%', color: 'bg-emerald-600' },
      { name: 'Verified DOI Citations', score: '100%', color: 'bg-emerald-600' },
    ],
    qcGiftTitle: 'Included Free:',
    qcGiftDesc: 'Official Non-Repository Turnitin Similarity & AI PDF Report.',
    references: [
      {
        id: 'teece-1997',
        tag: 'SMJ · 1997',
        shortTitle: 'Dynamic Capabilities and Strategic Management',
        shortMeta: 'Teece, Pisano & Shuen · Vol. 18(7)',
        authorsYear: 'Teece, D.J., Pisano, G. & Shuen, A. (1997) ',
        articleTitle: '‘Dynamic capabilities and strategic management’, ',
        journalName: 'Strategic Management Journal',
        issuePages: ', 18(7), pp. 509–533.',
        doi: '10.1002/(SICI)1097-0266(199708)18:7<509::AID-SMJ882>3.0.CO;2-Z',
      },
      {
        id: 'christopher-2004',
        tag: 'IJLM · 2004',
        shortTitle: 'Building the Resilient Supply Chain',
        shortMeta: 'Christopher & Peck · Vol. 15(2)',
        authorsYear: 'Christopher, M. & Peck, H. (2004) ',
        articleTitle: '‘Building the resilient supply chain’, ',
        journalName: 'The International Journal of Logistics Management',
        issuePages: ', 15(2), pp. 1–14.',
        doi: '10.1108/09574090410700275',
      },
      {
        id: 'brandon-jones-2014',
        tag: 'JSCM · 2014',
        shortTitle: 'A Contingent Resource-Based Perspective of Supply Chain Resilience and Robustness',
        shortMeta: 'Brandon-Jones et al. · Vol. 50(3)',
        authorsYear: 'Brandon-Jones, E., Squire, B., Autry, C.W. & Petersen, K.J. (2014) ',
        articleTitle:
          '‘A contingent resource-based perspective of supply chain resilience and robustness’, ',
        journalName: 'Journal of Supply Chain Management',
        issuePages: ', 50(3), pp. 55–73.',
        doi: '10.1111/jscm.12050',
      },
    ],
  },
  {
    id: 'en-finance',
    lang: 'en',
    fileName: 'BAFI2094 · Capital_Structure_HD.docx',
    docHeaderMeta: ['Academic English', 'APA 7th Edition', '2,616 words'],
    rubricBadge: 'Rubric Aligned',
    authorLabel: 'Written by MSc Finance & Econometrics',
    sectionHeading: '3.2 Capital Structure & Multi-Factor Valuation',
    beforeMark:
      'In corporate financing theory, firms weigh interest tax shields against asymmetric information costs and ',
    markText: 'expected financial distress',
    afterMark: ' when balancing debt and equity issuance ',
    citation1: '(Myers, 1984)',
    citation1RefId: 'myers-1984',
    sentence2Lead:
      '. Cross-country panel evidence across major industrial economies further indicates that leverage relates negatively to profitability and market-to-book ratios ',
    citation2: '(Rajan & Zingales, 1995)',
    citation2RefId: 'rajan-1995',
    autocompleteLead: '. Within asset pricing models evaluating firm risk,',
    autocompleteText:
      ' incorporating profitability and investment patterns alongside size and value explains average stock returns more accurately (Fama & French, 2015).',
    referencesHeading: 'References',
    footerMeta: 'Similarity: 2% · AI: 0% · Times New Roman 12pt · DOI Verified',
    orderCta: 'Order Similar Paper',
    sourcesTitle: 'Verified Sources (3/18)',
    sourcesPill: 'DOI Checked',
    qcTitle: 'Quality Audit',
    qcScore: 'H1 86/100',
    qcMetrics: [
      { name: 'Marking Rubric Coverage', score: '95%', color: 'bg-[#12489B]' },
      { name: 'Econometric Rigor', score: '94%', color: 'bg-emerald-600' },
      { name: 'Verified DOI Citations', score: '100%', color: 'bg-emerald-600' },
    ],
    qcGiftTitle: 'Included Free:',
    qcGiftDesc: 'Full Excel DCF Workbook, Stata Output & Turnitin AI Report.',
    references: [
      {
        id: 'myers-1984',
        tag: 'J. Finance · 1984',
        shortTitle: 'The Capital Structure Puzzle',
        shortMeta: 'Myers, S. C. · Vol. 39(3)',
        authorsYear: 'Myers, S. C. (1984). ',
        articleTitle: 'The capital structure puzzle. ',
        journalName: 'The Journal of Finance',
        issuePages: ', 39(3), 575–592.',
        doi: '10.1111/j.1540-6261.1984.tb03646.x',
      },
      {
        id: 'rajan-1995',
        tag: 'J. Finance · 1995',
        shortTitle: 'What Do We Know about Capital Structure? Some Evidence from International Data',
        shortMeta: 'Rajan & Zingales · Vol. 50(5)',
        authorsYear: 'Rajan, R. G., & Zingales, L. (1995). ',
        articleTitle:
          'What do we know about capital structure? Some evidence from international data. ',
        journalName: 'The Journal of Finance',
        issuePages: ', 50(5), 1421–1460.',
        doi: '10.1111/j.1540-6261.1995.tb05184.x',
      },
      {
        id: 'fama-2015',
        tag: 'JFE · 2015',
        shortTitle: 'A Five-Factor Asset Pricing Model',
        shortMeta: 'Fama & French · Vol. 116(1)',
        authorsYear: 'Fama, E. F., & French, K. R. (2015). ',
        articleTitle: 'A five-factor asset pricing model. ',
        journalName: 'Journal of Financial Economics',
        issuePages: ', 116(1), 1–22.',
        doi: '10.1016/j.jfineco.2014.10.010',
      },
    ],
  },
  {
    id: 'vi-strategy',
    lang: 'vi',
    fileName: 'LV_ThacSi_QTKD_UEH.docx',
    docHeaderMeta: ['Tiếng Việt học thuật', 'Chuẩn APA 7th', '12,000 từ'],
    rubricBadge: 'Chuẩn Đề cương',
    authorLabel: 'Biên soạn: ThS. Quản trị Kinh doanh',
    sectionHeading: '2.1 Năng lực động và Chuyển đổi số Doanh nghiệp',
    beforeMark:
      'Theo khung lý thuyết năng lực động, doanh nghiệp duy trì lợi thế cạnh tranh dài hạn thông qua việc tích hợp, xây dựng và ',
    markText: 'tái cấu trúc năng lực cốt lõi',
    afterMark: ' nhằm thích ứng với môi trường biến động nhanh ',
    citation1: '(Teece et al., 1997)',
    citation1RefId: 'teece-1997-vi',
    sentence2Lead:
      '. Bằng chứng thực nghiệm tại các doanh nghiệp nhỏ và vừa ở Việt Nam cho thấy chuyển đổi số nâng cao năng lực cạnh tranh thông qua vai trò trung gian của năng lực đổi mới ',
    citation2: '(Bùi, 2024)',
    citation2RefId: 'bui-2024',
    autocompleteLead:
      '. Tương đồng về mặt quản trị chuỗi cung ứng,',
    autocompleteText:
      ' khả năng phục hồi hệ thống phân phối đòi hỏi sự minh bạch thông tin và phối hợp quản trị rủi ro giữa các đối tác (Christopher & Peck, 2004).',
    referencesHeading: 'Tài liệu tham khảo',
    footerMeta: 'Tương đồng: 4% · AI: 0% · Times New Roman 12pt · Chuẩn DOI',
    orderCta: 'Đặt bài tương tự',
    sourcesTitle: 'Nguồn đối chiếu (3/22)',
    sourcesPill: 'Đã xác thực DOI',
    qcTitle: 'Kiểm định chất lượng',
    qcScore: '9.0 / 10',
    qcMetrics: [
      { name: 'Bám sát Đề cương & Rubric', score: '96%', color: 'bg-[#12489B]' },
      { name: 'Chiều sâu lập luận phản biện', score: '92%', color: 'bg-emerald-600' },
      { name: 'Trích dẫn tạp chí có DOI', score: '100%', color: 'bg-emerald-600' },
    ],
    qcGiftTitle: 'Tặng kèm:',
    qcGiftDesc: 'File kiểm định Turnitin chính hãng (Không lưu kho trường).',
    references: [
      {
        id: 'bui-2024',
        tag: 'KT&PT · 2024',
        shortTitle:
          'Vai trò trung gian của năng lực đổi mới trong chuyển đổi số doanh nghiệp vừa và nhỏ',
        shortMeta: 'Bùi Thành Khoa · Số 321(2)',
        authorsYear: 'Bùi, T. K. (2024). ',
        articleTitle:
          'Khám phá vai trò trung gian của năng lực đổi mới và định hướng sáng nghiệp trong ảnh hưởng của chuyển đổi số đối với năng lực cạnh tranh của doanh nghiệp nhỏ và vừa. ',
        journalName: 'Tạp chí Kinh tế và Phát triển',
        issuePages: ', 321(2), 70–78.',
        doi: '10.33301/JED.VI.1581',
      },
      {
        id: 'christopher-2004-vi',
        tag: 'IJLM · 2004',
        shortTitle: 'Building the Resilient Supply Chain',
        shortMeta: 'Christopher & Peck · Vol. 15(2)',
        authorsYear: 'Christopher, M., & Peck, H. (2004). ',
        articleTitle: 'Building the resilient supply chain. ',
        journalName: 'The International Journal of Logistics Management',
        issuePages: ', 15(2), 1–14.',
        doi: '10.1108/09574090410700275',
      },
      {
        id: 'teece-1997-vi',
        tag: 'SMJ · 1997',
        shortTitle: 'Dynamic Capabilities and Strategic Management',
        shortMeta: 'Teece, Pisano & Shuen · Vol. 18(7)',
        authorsYear: 'Teece, D. J., Pisano, G., & Shuen, A. (1997). ',
        articleTitle: 'Dynamic capabilities and strategic management. ',
        journalName: 'Strategic Management Journal',
        issuePages: ', 18(7), 509–533.',
        doi: '10.1002/(SICI)1097-0266(199708)18:7<509::AID-SMJ882>3.0.CO;2-Z',
      },
    ],
  },
  {
    id: 'vi-spss',
    lang: 'vi',
    fileName: 'KLTN_TaiChinh_FGLS_UFM.docx',
    docHeaderMeta: ['Tiếng Việt học thuật', 'Chuẩn APA 7th', '8,500 từ'],
    rubricBadge: 'Chuẩn Hội đồng',
    authorLabel: 'Biên soạn: ThS. Tài chính – Kinh tế lượng',
    sectionHeading: '3.2 Các yếu tố tác động đến Khả năng sinh lời (ROA & ROE)',
    beforeMark:
      'Phân tích mô hình FGLS trên dữ liệu bảng của 652 công ty niêm yết Việt Nam giai đoạn 2018–2022 cho thấy quy mô và vòng quay tài sản thúc đẩy sinh lời, trong khi ',
    markText: 'đòn bẩy tài chính',
    afterMark: ' tác động ngược chiều đến cả ROA và ROE ',
    citation1: '(Lê & Nguyễn, 2024)',
    citation1RefId: 'le-2024',
    sentence2Lead:
      '. Xét riêng tác động của chuyển đổi số tại khối doanh nghiệp tư nhân niêm yết, chi phí đầu tư hạ tầng ban đầu tạo ra độ trễ nhất định lên hiệu quả tài chính ngắn hạn ',
    citation2: '(Phan et al., 2023)',
    citation2RefId: 'phan-2023',
    autocompleteLead: '. Đối chiếu với bằng chứng thực nghiệm quốc tế,',
    autocompleteText:
      ' mối tương quan nghịch giữa đòn bẩy nợ và khả năng sinh lời phù hợp với kết quả kiểm định tại các nền kinh tế G7 (Rajan & Zingales, 1995).',
    referencesHeading: 'Tài liệu tham khảo',
    footerMeta: 'Tương đồng: 3% · AI: 0% · Times New Roman 12pt · Chuẩn DOI',
    orderCta: 'Đặt bài tương tự',
    sourcesTitle: 'Nguồn đối chiếu (3/20)',
    sourcesPill: 'Đã xác thực DOI',
    qcTitle: 'Kiểm định chất lượng',
    qcScore: '9.2 / 10',
    qcMetrics: [
      { name: 'Chuẩn mô hình Định lượng', score: '97%', color: 'bg-[#12489B]' },
      { name: 'Diễn giải FGLS / Stata / SPSS', score: '95%', color: 'bg-emerald-600' },
      { name: 'Trích dẫn tạp chí có DOI', score: '100%', color: 'bg-emerald-600' },
    ],
    qcGiftTitle: 'Tặng kèm:',
    qcGiftDesc: 'Toàn bộ file Data (.dta/.sav), Output & báo cáo Turnitin.',
    references: [
      {
        id: 'le-2024',
        tag: 'JFM · 2024',
        shortTitle:
          'Các yếu tố tác động đến khả năng sinh lời tại các công ty niêm yết trên thị trường chứng khoán Việt Nam',
        shortMeta: 'Lê Thị Bảo Như & Nguyễn Thị Thu Hậu · 15(6)',
        authorsYear: 'Lê, T. B. N., & Nguyễn, T. T. H. (2024). ',
        articleTitle:
          'Các yếu tố tác động đến khả năng sinh lời tại các công ty niêm yết trên thị trường chứng khoán Việt Nam. ',
        journalName: 'Tạp chí Nghiên cứu Tài chính – Marketing',
        issuePages: ', 15(6), 16–28.',
        doi: '10.52932/jfm.v15i6.456',
      },
      {
        id: 'phan-2023',
        tag: 'JFM · 2023',
        shortTitle:
          'Tác động của chuyển đổi số đến hiệu quả kinh doanh của các doanh nghiệp tư nhân Việt Nam',
        shortMeta: 'Phan Thị Hằng Nga et al. · 14(2)',
        authorsYear:
          'Phan, T. H. N., Thi, T. M. D., Nguyễn, T. H. N., Võ, H. N. H., Vương, T. V., & Trương, N. H. (2023). ',
        articleTitle:
          'Tác động của chuyển đổi số đến hiệu quả kinh doanh của các doanh nghiệp tư nhân Việt Nam. ',
        journalName: 'Tạp chí Nghiên cứu Tài chính – Marketing',
        issuePages: ', 14(2), 13–24.',
        doi: '10.52932/jfm.vi2.385',
      },
      {
        id: 'rajan-1995-vi',
        tag: 'J. Finance · 1995',
        shortTitle:
          'What Do We Know about Capital Structure? Some Evidence from International Data',
        shortMeta: 'Rajan & Zingales · Vol. 50(5)',
        authorsYear: 'Rajan, R. G., & Zingales, L. (1995). ',
        articleTitle:
          'What do we know about capital structure? Some evidence from international data. ',
        journalName: 'The Journal of Finance',
        issuePages: ', 50(5), 1421–1460.',
        doi: '10.1111/j.1540-6261.1995.tb05184.x',
      },
    ],
  },
];

const TURNITIN_CHECKS = [
  { label: 'Biên soạn 100% bởi Thạc sĩ chuyên ngành', value: 'Human Written', tone: 'emerald' as const },
  { label: 'Trích dẫn chuẩn DOI / Peer-Reviewed', value: '100% Có thật', tone: 'emerald' as const },
  { label: 'Tỷ lệ tương đồng Turnitin (Non-repository)', value: '4% An toàn', tone: 'emerald' as const },
  { label: 'AI Detection (Turnitin AI Module)', value: '0% Human', tone: 'blue' as const },
];

const SAMPLE_CARDS = [
  {
    code: 'BUSM2570',
    school: 'RMIT University',
    title: 'Business Decision Making – BUSM2570 – Sample DI',
    score: 'DI',
    meta: '1,813 words · Assignment/Essay/Report',
  },
  {
    code: 'BAFI2094',
    school: 'RMIT University',
    title: 'Corporate Finance – BAFI2094 Sample HD',
    score: 'HD',
    meta: '2,616 words · Finance & Banking',
  },
  {
    code: 'FIN80005',
    school: 'Swinburne University',
    title: 'FIN80005 – Corporate Financial Management',
    score: 'HD',
    meta: '1,516 words · 4 Data Tables',
  },
];

export function HeroWorkspacePreview({
  onOpenOrder,
  onOpenChecker,
  onOpenSamples,
}: HeroWorkspacePreviewProps) {
  const [activeTab, setActiveTab] = useState<PreviewTabKey>('editor');
  const [sampleIdx, setSampleIdx] = useState(0);
  const [highlightedRefId, setHighlightedRefId] = useState<string | null>(null);
  const [typedLen, setTypedLen] = useState(48);
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
        prev >= fullAutocomplete.length ? 20 : prev + 1
      );
    }, 55);

    return () => window.clearInterval(interval);
  }, [paused, activeTab, fullAutocomplete.length]);

  const handleSelectLanguage = (targetLang: SampleLang) => {
    const firstMatchIdx = EDITOR_SAMPLES.findIndex((s) => s.lang === targetLang);
    if (firstMatchIdx !== -1) {
      setSampleIdx(firstMatchIdx);
      setHighlightedRefId(null);
      setTypedLen(28);
    }
  };

  const handleSwitchNextSample = () => {
    const sameLangSamples = EDITOR_SAMPLES
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => item.lang === currentSample.lang);

    setHighlightedRefId(null);
    if (sameLangSamples.length > 1) {
      const curPos = sameLangSamples.findIndex((entry) => entry.idx === sampleIdx);
      const nextEntry = sameLangSamples[(curPos + 1) % sameLangSamples.length];
      setSampleIdx(nextEntry.idx);
      setTypedLen(24);
    } else {
      setSampleIdx((prev) => (prev + 1) % EDITOR_SAMPLES.length);
      setTypedLen(24);
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
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[460px] divide-y lg:divide-y-0 lg:divide-x divide-slate-200/80">
          {/* Left Pane: Verified Real DOI Sources */}
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
              {currentSample.references.map((ref) => {
                const isSelected = highlightedRefId === ref.id;
                return (
                  <button
                    key={ref.id}
                    type="button"
                    onClick={() =>
                      setHighlightedRefId((prev) => (prev === ref.id ? null : ref.id))
                    }
                    className={`w-full text-left p-2.5 rounded-xl border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/70 border-[#12489B] shadow-2xs'
                        : 'bg-white border-slate-200/80 hover:border-blue-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 text-[10px] font-semibold text-[#12489B]">
                      <span>{ref.tag}</span>
                      <span className="font-mono text-[9.5px] text-slate-400">
                        DOI ✓
                      </span>
                    </div>
                    <div className="text-[11.5px] font-semibold text-slate-900 leading-snug mt-0.5 line-clamp-2">
                      {ref.shortTitle}
                    </div>
                    <div className="text-[10.5px] text-slate-500 mt-1 truncate">
                      {ref.shortMeta}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Center Pane: Live Academic Paper + Extended Verified References Section */}
          <div className="lg:col-span-6 p-5 sm:p-6 bg-white flex flex-col justify-between gap-5">
            <div className="space-y-4">
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

              {/* Body Prose with Clickable Verified Citations */}
              <div className="space-y-2.5">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  {currentSample.sectionHeading}
                </h3>

                <p className="text-[13px] sm:text-[13.5px] leading-[1.72] text-slate-700">
                  {currentSample.beforeMark}
                  <mark className="bg-amber-100/85 text-slate-900 px-1 rounded">
                    {currentSample.markText}
                  </mark>
                  {currentSample.afterMark}
                  <button
                    type="button"
                    onClick={() => setHighlightedRefId(currentSample.citation1RefId)}
                    className="text-[#12489B] font-medium hover:underline cursor-pointer"
                  >
                    {currentSample.citation1}
                  </button>
                  {currentSample.sentence2Lead}
                  <button
                    type="button"
                    onClick={() => setHighlightedRefId(currentSample.citation2RefId)}
                    className="text-[#12489B] font-medium hover:underline cursor-pointer"
                  >
                    {currentSample.citation2}
                  </button>
                  {currentSample.autocompleteLead}
                  <span className="text-slate-400 transition-opacity">
                    {fullAutocomplete.slice(0, typedLen)}
                  </span>
                  <span
                    aria-hidden="true"
                    className="jenni-caret inline-block w-[2px] h-3.5 bg-[#12489B] align-middle ml-0.5"
                  />
                </p>
              </div>

              {/* Extended Verified References Section (Exact DOI & Journal Citations) */}
              <div className="pt-4 border-t border-slate-200/80 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                    {currentSample.referencesHeading}
                  </h4>
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                    {currentSample.lang === 'vi' ? 'Đã đối chiếu DOI' : 'DOI Cross-Checked'}
                  </span>
                </div>

                <div className="space-y-2">
                  {currentSample.references.map((ref) => {
                    const isHighlighted = highlightedRefId === ref.id;
                    return (
                      <p
                        key={ref.id}
                        className={`pl-5 -indent-5 text-[11.5px] sm:text-[12px] leading-[1.55] rounded-lg px-2 py-1 transition-colors ${
                          isHighlighted
                            ? 'bg-blue-50/90 text-slate-900 ring-1 ring-blue-200'
                            : 'text-slate-600'
                        }`}
                      >
                        <span>{ref.authorsYear}</span>
                        <span>{ref.articleTitle}</span>
                        <em className="italic">{ref.journalName}</em>
                        <span>{ref.issuePages} </span>
                        <a
                          href={`https://doi.org/${encodeURI(ref.doi)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#12489B] hover:underline break-all"
                        >
                          https://doi.org/{ref.doi}
                          <ExternalLink className="w-2.5 h-2.5 inline-block ml-1 -mt-0.5 align-middle" />
                        </a>
                      </p>
                    );
                  })}
                </div>
              </div>
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

          {/* Right Pane: Rubric & QC Inspector */}
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
        <div className="p-5 sm:p-8 bg-white grid grid-cols-1 lg:grid-cols-12 gap-6 items-center min-h-[460px]">
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
        <div className="p-5 sm:p-8 bg-white space-y-5 min-h-[460px] flex flex-col justify-between">
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
