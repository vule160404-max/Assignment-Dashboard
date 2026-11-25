import { useEffect, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Check,
  ChevronDown,
  FileText,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import {
  parseSampleRouteFromLocation,
  syncDocumentSeoMeta,
  type OrderPrefillData,
} from '../../lib/sampleSeo';
import { LiveConversionFomoDock } from './LiveConversionFomoDock';
import { PolicyModal, PolicyTabKey } from './PolicyModal';
import { PublicTopNav } from './PublicTopNav';
import { RevealOnScroll } from './RevealOnScroll';
import { HeroWorkspacePreview } from './HeroWorkspacePreview';
import { ClientIntentHubView } from '../client/ClientIntentHubView';
import { SampleLibraryView } from './SampleLibraryView';

export interface ClientPortalLaunchOptions {
  code?: string;
  tab?: 'lookup' | 'order' | 'checker';
  serviceType?: string;
  orderPrefill?: OrderPrefillData;
}

interface RoleSelectionGateProps {
  initialPage?: 'home' | 'samples';
  isAdmin?: boolean;
  onPageChange?: (page: 'home' | 'samples') => void;
  onSelectClient: (options?: ClientPortalLaunchOptions) => void;
  onSelectAdmin: () => void;
}

const UNI_MARQUEE_LOGOS = [
  { name: 'RMIT University', logoUrl: '/samples/logos/7e93cf874f1abb.png' },
  { name: 'University of Melbourne', logoUrl: '/samples/logos/12e6745e9470dc.png' },
  { name: 'Swinburne University', logoUrl: '/samples/logos/e804455ef3b6c4.png' },
  { name: 'Deakin University', logoUrl: '/samples/logos/f384bbef370542.png' },
  { name: 'La Trobe University', logoUrl: '/samples/logos/fe8e012088bada.png' },
  { name: 'Coventry University', logoUrl: '/samples/logos/7fd8829c8b8c09.png' },
  { name: 'University of Northampton', logoUrl: '/samples/logos/cf6f40573978d0.png' },
  { name: 'Torrens University', logoUrl: '/samples/logos/902f6dab52bd75.png' },
  { name: 'University of South Australia', logoUrl: '/samples/logos/696d32ea8099d2.png' },
  { name: 'Kaplan Business School', logoUrl: '/samples/logos/4f053d55325e5a.png' },
];

const PROCESS_STEPS = [
  {
    num: '01',
    title: 'Gửi đề bài & Rubric',
    desc: 'Điền yêu cầu trong 60 giây — nhận báo giá minh bạch theo mốc điểm sau 15 phút.',
  },
  {
    num: '02',
    title: 'Theo dõi 6 mốc tiến độ',
    desc: 'Xem trước bản nháp, đối chiếu tiến độ và trao đổi trực tiếp qua mã Passcode bảo mật.',
  },
  {
    num: '03',
    title: 'Nhận Final & Turnitin',
    desc: 'Tải file Word chuẩn APA/Harvard/IEEE kèm báo cáo Turnitin chính hãng không lưu kho.',
  },
];

const COMPARISON_ASSIGNTRACK = [
  '100% do đội ngũ Thạc sĩ chuyên ngành trực tiếp viết — KHÔNG dùng AI viết bài',
  'Phủ đủ đa dạng ngành: Kinh tế, Tài chính, Marketing, CNTT/Dữ liệu, Luật, Y sinh',
  'Nguồn học thuật DOI / peer-reviewed có thật, bám sát Marking Rubric từng môn',
  'Kiểm định Turnitin không lưu kho, AI 0% & bảo hành chỉnh sửa miễn phí',
];

const MASTER_WRITER_DISCIPLINES = [
  { field: 'Kinh tế & Tài chính', degree: 'ThS. Finance / Economics' },
  { field: 'Quản trị & Marketing', degree: 'ThS. MBA / Strategic Mgmt' },
  { field: 'CNTT & Dữ liệu (SPSS/R)', degree: 'ThS. Data Science / CS' },
  { field: 'Luật & Xã hội học', degree: 'ThS. LL.M / Social Sciences' },
  { field: 'Kỹ thuật & Y sinh', degree: 'ThS. Engineering / Biomedical' },
  { field: 'Giáo dục & Ngôn ngữ', degree: 'ThS. TESOL / Education' },
];

const COMPARISON_GENERIC_AI = [
  'Dễ tự bịa tên tác giả, năm xuất bản và đường dẫn DOI không tồn tại',
  'Câu văn máy móc, lập luận hời hợt — thường dính 60–100% cờ AI Detector',
  'Không phân tích đúng trọng số Rubric hay định dạng bảng biểu theo chuẩn trường',
  'Không có đội ngũ chuyên môn bảo hành khi giảng viên yêu cầu giải trình',
];

const PACKAGES = [
  {
    name: 'Standard',
    badge: 'Tiêu chuẩn',
    score: '65% – 74%',
    gradeLabel: 'Pass / Credit',
    tagline: 'Đúng trọng tâm đề bài, cấu trúc mạch lạc và nguồn trích dẫn hợp lệ.',
    serviceType: 'Viết mới Assignment / Essay / Report',
    features: [
      'Bám sát Marking Rubric cơ bản của môn học',
      'Nguồn học thuật chuẩn APA / Harvard / IEEE',
      'Kèm báo cáo Turnitin & chỉnh sửa miễn phí 1 lần',
    ],
    featured: false,
    warm: false,
  },
  {
    name: 'Premium',
    badge: 'Phổ biến nhất',
    score: '75% – 84%',
    gradeLabel: 'Distinction Target',
    tagline: 'Phân tích phản biện sâu (Critical Analysis) và dẫn chứng học thuật Q1/Q2.',
    serviceType: 'Viết mới Assignment / Essay / Report',
    features: [
      'Writer chuyên ngành lập luận phản biện đa chiều',
      'Tích hợp bảng số liệu, mô hình thực tế & DOI mới nhất',
      'Cam kết Turnitin < 10%, AI 0% & bảo hành theo feedback',
    ],
    featured: true,
    warm: false,
  },
  {
    name: 'Ultra Premium',
    badge: 'Cứu gấp 24h · HD',
    score: '85%+',
    gradeLabel: 'High Distinction',
    tagline: 'Chuyên gia đầu ngành trực tiếp triển khai hoặc xử lý ca gấp sát giờ nộp.',
    serviceType: 'Luận văn / Dissertation / Khóa luận',
    features: [
      'Ưu tiên ghép Writer Top-tier hoàn thành đúng deadline gấp',
      'Chạy định lượng SPSS / R / SmartPLS & giải thích chuyên sâu',
      'Hỗ trợ 1-1 xuyên suốt cho tới khi giảng viên chấm điểm xong',
    ],
    featured: false,
    warm: true,
  },
];

const SERVICES = [
  {
    code: '01',
    icon: FileText,
    title: 'Tiểu luận & Case Study Quốc tế',
    desc: 'Viết mới 100% Essay, Report, Reflective Journal chuẩn văn phong Anh–Úc–Mỹ.',
    serviceType: 'Viết mới Assignment / Essay / Report',
    tags: ['RMIT · Swinburne', 'Harvard · APA 7th', 'Tiếng Anh / Tiếng Việt'],
  },
  {
    code: '02',
    icon: GraduationCap,
    title: 'Khóa luận & Luận văn Thạc sĩ',
    desc: 'Triển khai trọn bộ từ Proposal, Literature Review đến hoàn thiện chương thảo luận.',
    serviceType: 'Luận văn / Dissertation / Khóa luận',
    tags: ['Proposal · Capstone', 'Master Thesis', 'Chuẩn định dạng trường'],
  },
  {
    code: '03',
    icon: BarChart3,
    title: 'Phân tích Dữ liệu SPSS · R · SmartPLS',
    desc: 'Làm sạch dữ liệu, chạy hồi quy OLS, SEM, EFA/CFA và xuất bảng phân tích chuẩn.',
    serviceType: 'Luận văn / Dissertation / Khóa luận',
    tags: ['SPSS · Stata · R', 'SmartPLS · SEM', 'Kèm file Output gốc'],
  },
  {
    code: '04',
    icon: ShieldCheck,
    title: 'Giảm AI & Kiểm định Turnitin',
    desc: 'Biên tập thủ công câu chữ tự nhiên, hạ tỷ lệ AI/Similarity mà không làm biến nghĩa.',
    serviceType: 'Giảm tỷ lệ đạo văn & AI (Humanize)',
    tags: ['AI 0% Turnitin', 'Non-repository', 'Trả kết quả sau 5 phút'],
  },
];

const FAQS = [
  {
    q: 'Thông tin đặt bài có được bảo mật tuyệt đối không?',
    a: 'Có. Bạn không cần tạo tài khoản hay để lại họ tên thật — mọi trao đổi và file bài làm chỉ gắn với mã đơn Passcode bảo mật trên máy của bạn.',
  },
  {
    q: 'Check Turnitin có làm bài bị lưu vào kho dữ liệu trường không?',
    a: 'Không bao giờ. AssignTrack sử dụng tài khoản kiểm tra Non-repository chính hãng nên tuyệt đối không lưu vết bài làm vào hệ thống đối chiếu toàn cầu.',
  },
  {
    q: 'Mất bao lâu để nhận báo giá và bản nháp đầu tiên?',
    a: 'Sau khi gửi đề bài qua Phiếu đặt nhanh, đội ngũ học thuật sẽ xem Rubric và phản hồi báo giá trong vòng 15 phút. Tiến độ chuẩn 3–7 ngày hoặc hỗ trợ gấp 12h–24h.',
  },
  {
    q: 'Nếu giảng viên góp ý thì có được chỉnh sửa thêm không?',
    a: 'Tất cả đơn hàng đều được bảo hành chỉnh sửa miễn phí theo phạm vi Rubric ban đầu — bạn gửi nhận xét trực tiếp ngay trong Cổng theo dõi đơn.',
  },
  {
    q: 'Nguồn tài liệu tham khảo có đảm bảo có thật 100% không?',
    a: 'Mọi bài làm đều trích xuất từ cơ sở dữ liệu học thuật thật (ScienceDirect, Emerald, IEEE, Scopus) kèm đầy đủ DOI / liên kết đối chiếu.',
  },
  {
    q: 'Tôi muốn xem trước bài mẫu hoặc dùng công cụ Check AI thử trước được không?',
    a: 'Hoàn toàn được. Bạn có thể đọc miễn phí 122+ bài mẫu từ 25 trường Đại học hoặc quét thử câu chữ ngay bằng công cụ Check AI Free ở đầu trang.',
  },
];

const HOME_SEO_TITLE =
  'AssignTrack — Hỗ trợ Assignment, Essay & Luận văn Đại học Quốc tế chuẩn High Distinction';
const HOME_SEO_DESC =
  'Viết bài Assignment, Essay, Report & Luận văn đúng chuyên ngành, bám sát Rubric RMIT, Swinburne, Melbourne, UK/Úc/Mỹ. Cam kết 100% nguồn trích dẫn thật, tặng báo cáo Turnitin & AI 0%.';

export function RoleSelectionGate({
  initialPage = 'home',
  isAdmin = false,
  onPageChange,
  onSelectClient,
  onSelectAdmin,
}: RoleSelectionGateProps) {
  const [activePage, setActivePage] = useState<'home' | 'samples'>(() => {
    if (typeof window !== 'undefined') {
      return parseSampleRouteFromLocation(window.location).isSamplesRoute
        ? 'samples'
        : initialPage;
    }
    return initialPage;
  });
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);
  const [activePolicyTab, setActivePolicyTab] = useState<PolicyTabKey | null>(null);

  useEffect(() => {
    if (activePage !== 'home') return;
    syncDocumentSeoMeta({
      title: HOME_SEO_TITLE,
      description: HOME_SEO_DESC,
      canonicalUrl: 'https://assigntrack.site/',
    });
  }, [activePage]);

  const openSampleLibrary = () => {
    setActivePage('samples');
    onPageChange?.('samples');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openHomePage = () => {
    setActivePage('home');
    onPageChange?.('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOrderNow = () => onSelectClient({ tab: 'order' });

  const handleOrderWithPrefill = (prefill?: OrderPrefillData) =>
    onSelectClient({
      tab: 'order',
      serviceType: prefill?.serviceType,
      orderPrefill: prefill,
    });

  return (
    <div className="min-h-screen bg-white text-[#0F172A] flex flex-col">
      <PublicTopNav
        activeNav={activePage === 'samples' ? 'samples' : 'home'}
        onGoHome={openHomePage}
        onOpenOrder={handleOrderNow}
        onOpenLookup={() => onSelectClient({ tab: 'lookup' })}
        onOpenChecker={() => onSelectClient({ tab: 'checker' })}
        onOpenSamples={openSampleLibrary}
        onSelectAdmin={onSelectAdmin}
      />

      <main className="flex-1">
        {activePage === 'samples' ? (
          <SampleLibraryView
            isAdmin={isAdmin}
            onOrderNow={handleOrderWithPrefill}
            onBackHome={openHomePage}
          />
        ) : (
          <>
            {/* 1. CLEAN LIGHT ACADEMIC HERO + INTERACTIVE LIVE WORKSPACE */}
            <section className="relative overflow-hidden bg-white pt-12 pb-16 sm:pt-16 sm:pb-20">
              {/* Whisper-soft top ambient paper spotlight matching Royal Navy hue */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
                style={{
                  background:
                    'radial-gradient(68% 52% at 50% 0%, rgba(18, 72, 155, 0.065) 0%, rgba(255, 255, 255, 0) 100%)',
                }}
              />

              <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto text-center space-y-5">
                  <div className="hero-reveal inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F8FAFC] border border-slate-200/90 text-[11px] sm:text-[11.5px] font-semibold text-[#12489B] whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#12489B]" />
                    <span>Bảo mật 100%</span>
                  </div>

                  <h1 className="hero-reveal hero-delay-1 text-[30px] sm:text-[42px] lg:text-[52px] font-semibold tracking-[-0.03em] leading-[1.12] text-[#0F172A] text-balance">
                    Hỗ trợ Assignment chuẩn học thuật{' '}
                    <span className="whitespace-nowrap">quốc tế.</span>{' '}
                    <span className="text-[#12489B] inline-block">
                      No Plagiarism · AI Free
                    </span>
                  </h1>

                  <p className="hero-reveal hero-delay-2 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
                    Gửi đề bài &amp; Rubric để nhận bài hoàn chỉnh 100% nguồn thật DOI, kèm báo cáo Turnitin không lưu kho.
                  </p>

                  {/* Focused Action Cluster */}
                  <div className="hero-reveal hero-delay-2 flex flex-wrap items-center justify-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={handleOrderNow}
                      className="btn-press inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0B2559] hover:bg-[#12489B] text-white text-sm font-semibold shadow-[0_6px_20px_rgba(11,37,89,0.2)] transition-colors cursor-pointer"
                    >
                      <span>Đặt bài ngay</span>
                      <span className="text-sky-200/90 font-normal hidden sm:inline">
                        — Báo giá 15p
                      </span>
                      <ArrowUpRight className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={openSampleLibrary}
                      className="btn-press inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-slate-300 text-slate-800 text-sm font-semibold transition-colors cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4 text-[#12489B]" />
                      <span>122+ Bài mẫu HD</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectClient({ tab: 'lookup' })}
                      className="inline-flex items-center gap-1 px-3 py-2 text-xs sm:text-[13px] font-semibold text-slate-600 hover:text-[#12489B] transition-colors cursor-pointer"
                    >
                      <span>Tra cứu Passcode</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Minimal Social Proof Line (Jenni avatar cluster style) */}
                  <div className="hero-reveal hero-delay-3 pt-1 flex items-center justify-center gap-2.5 text-xs text-slate-500">
                    <div className="flex -space-x-2" aria-hidden="true">
                      {['RM', 'UM', 'SW', 'UE'].map((code, i) => (
                        <span
                          key={code}
                          className={`w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold ${
                            i === 0
                              ? 'bg-[#0B2559] text-white'
                              : i === 1
                              ? 'bg-[#12489B] text-white'
                              : i === 2
                              ? 'bg-sky-100 text-[#0B2559]'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {code}
                        </span>
                      ))}
                    </div>
                    <span>
                      Tin dùng bởi <strong className="text-slate-800">5.200+ sinh viên</strong> Úc, Anh, Mỹ &amp; Việt Nam
                    </span>
                  </div>
                </div>

                {/* Live Interactive 3-Pane Academic Workspace Mockup */}
                <HeroWorkspacePreview
                  onOpenOrder={handleOrderNow}
                  onOpenChecker={() => onSelectClient({ tab: 'checker' })}
                  onOpenSamples={openSampleLibrary}
                />
              </div>
            </section>

            {/* 2. UNIVERSITY LOGO MARQUEE STRIP */}
            <section
              aria-label="Các trường Đại học tiêu biểu"
              className="py-10 sm:py-12 bg-[#FCFCFF] border-y border-slate-200/70"
            >
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
                <p className="text-center text-xs sm:text-sm font-medium text-slate-500">
                  Bài mẫu &amp; chuẩn Rubric được đối chiếu theo 25+ trường Đại học Quốc tế
                </p>

                <div className="logo-marquee-wrap logo-marquee-mask overflow-hidden">
                  <div className="logo-marquee-track items-center gap-6 sm:gap-9 py-1">
                    {[...UNI_MARQUEE_LOGOS, ...UNI_MARQUEE_LOGOS].map((uni, idx) => (
                      <button
                        key={`${uni.name}-${idx}`}
                        type="button"
                        onClick={openSampleLibrary}
                        title={`Xem bài mẫu ${uni.name}`}
                        className="group shrink-0 inline-flex items-center gap-3.5 px-3.5 py-2 rounded-2xl bg-white/80 hover:bg-white border border-slate-200/75 hover:border-[#12489B]/35 shadow-[0_1px_4px_rgba(15,23,42,0.03)] hover:shadow-[0_6px_16px_rgba(11,37,89,0.07)] opacity-90 hover:opacity-100 transition-all cursor-pointer"
                      >
                        <span className="w-14 h-12 sm:w-16 sm:h-14 rounded-xl bg-white border border-slate-100 p-1.5 flex items-center justify-center shrink-0">
                          <img
                            src={uni.logoUrl}
                            alt={uni.name}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-105"
                          />
                        </span>
                        <span className="text-[13px] sm:text-sm font-semibold text-slate-800 whitespace-nowrap pr-1">
                          {uni.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* 3. HOW IT WORKS — 3 MINIMALIST INDEX CARDS */}
            <section id="quy-trinh" className="py-16 sm:py-20 bg-white">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
                <div className="max-w-xl space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#12489B]">
                    Quy trình 3 bước
                  </div>
                  <h2 className="text-2xl sm:text-4xl font-semibold tracking-[-0.025em] text-slate-900">
                    Từ đề bài đến bản Final chuẩn chỉnh
                  </h2>
                </div>

                <RevealOnScroll>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {PROCESS_STEPS.map((step) => (
                      <div
                        key={step.num}
                        className="motion-card-lift rounded-2xl bg-[#FCFCFF] border border-slate-200/85 p-6 sm:p-7 space-y-4 shadow-[0_1px_8px_rgba(15,23,42,0.02)]"
                      >
                        <div className="text-4xl font-mono font-bold tracking-tight text-slate-200 select-none">
                          {step.num}
                        </div>
                        <div className="space-y-1.5">
                          <h3 className="text-base font-semibold text-slate-900">
                            {step.title}
                          </h3>
                          <p className="text-xs sm:text-[13.5px] text-slate-600 leading-relaxed">
                            {step.desc}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </RevealOnScroll>
              </div>
            </section>

            {/* 4. UNIFIED QUICK ACTION HUB */}
            <section
              id="dich-vu-nhanh"
              className="py-16 sm:py-20 bg-[#FCFCFF] border-y border-slate-200/75"
            >
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <ClientIntentHubView
                  onSelectOrder={(svc) =>
                    onSelectClient({ tab: 'order', serviceType: svc })
                  }
                  onSelectLookup={() => onSelectClient({ tab: 'lookup' })}
                  onSelectChecker={() => onSelectClient({ tab: 'checker' })}
                />
              </div>
            </section>

            {/* 5. WHY ASSIGNTRACK COMPARISON (Jenni Side-by-Side Card) */}
            <section className="py-16 sm:py-20 bg-white">
              <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
                <div className="text-center max-w-xl mx-auto space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#12489B]">
                    Vì sao chọn AssignTrack
                  </div>
                  <h2 className="text-2xl sm:text-4xl font-semibold tracking-[-0.025em] text-slate-900">
                    Đội ngũ Thạc sĩ trực tiếp viết — Không phải AI
                  </h2>
                  <p className="text-sm text-slate-600">
                    Mỗi bài làm do Thạc sĩ đúng chuyên ngành chấp bút, nghiên cứu nguồn thật và bám sát Rubric.
                  </p>
                </div>

                <RevealOnScroll>
                  <div className="space-y-6">
                    <div className="rounded-3xl border border-slate-200/90 bg-white p-2 sm:p-3 shadow-[0_12px_40px_-16px_rgba(11,37,89,0.1)] grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* AssignTrack Solid Navy Column */}
                      <div className="rounded-2xl bg-[#0B2559] text-white p-6 sm:p-7 space-y-5">
                        <div className="flex items-center justify-between">
                          <span className="text-base font-bold tracking-tight">
                            Assign<span className="text-amber-400">Track</span>
                          </span>
                          <span className="text-[10.5px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/10 text-sky-200">
                            Thạc sĩ chuyên ngành
                          </span>
                        </div>
                        <ul className="divide-y divide-white/10">
                          {COMPARISON_ASSIGNTRACK.map((item) => (
                            <li
                              key={item}
                              className="py-3 first:pt-0 last:pb-0 flex items-start gap-2.5 text-xs sm:text-[13px] text-slate-100 leading-relaxed"
                            >
                              <Check className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Generic AI Muted Column */}
                      <div className="rounded-2xl bg-[#FCFCFF] text-slate-700 p-6 sm:p-7 space-y-5">
                        <div className="flex items-center justify-between">
                          <span className="text-base font-semibold text-slate-800">
                            AI Chatbot đại trà
                          </span>
                          <span className="text-[10.5px] font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                            Rủi ro cao
                          </span>
                        </div>
                        <ul className="divide-y divide-slate-200/75">
                          {COMPARISON_GENERIC_AI.map((item) => (
                            <li
                              key={item}
                              className="py-3 first:pt-0 last:pb-0 flex items-start gap-2.5 text-xs sm:text-[13px] text-slate-500 leading-relaxed"
                            >
                              <X className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Multidisciplinary Master-Degree Writer Roster Strip */}
                    <div className="rounded-2xl bg-[#FCFCFF] border border-slate-200/85 p-5 sm:p-6 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs sm:text-[13px] font-semibold text-slate-900">
                          <GraduationCap className="w-4 h-4 text-[#12489B]" />
                          <span>Đội ngũ Thạc sĩ đa dạng chuyên ngành (100% Người viết thật)</span>
                        </div>
                        <span className="text-[11px] text-slate-500">
                          Ghép đúng người viết có bằng cấp cùng ngành học
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {MASTER_WRITER_DISCIPLINES.map((item) => (
                          <div
                            key={item.field}
                            className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between gap-2"
                          >
                            <span className="text-xs font-semibold text-slate-800">
                              {item.field}
                            </span>
                            <span className="text-[10.5px] font-mono font-medium text-[#12489B] shrink-0">
                              {item.degree}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </RevealOnScroll>
              </div>
            </section>

            {/* 6. 3 GRADE-COMMITMENT PACKAGES */}
            <section
              id="cam-ket"
              className="py-16 sm:py-20 bg-[#FCFCFF] border-y border-slate-200/75"
            >
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
                <div className="text-center max-w-xl mx-auto space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#12489B]">
                    Gói cam kết đầu ra
                  </div>
                  <h2 className="text-2xl sm:text-4xl font-semibold tracking-[-0.025em] text-slate-900">
                    Chọn mốc điểm theo Rubric
                  </h2>
                  <p className="text-sm text-slate-600">
                    Mọi gói đều đảm bảo đúng hạn, bảo mật danh tính và gửi kèm báo cáo Turnitin.
                  </p>
                </div>

                <RevealOnScroll>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
                    {PACKAGES.map((pkg) => (
                      <div
                        key={pkg.name}
                        className={`motion-card-lift rounded-2xl p-6 sm:p-7 flex flex-col justify-between gap-6 border ${
                          pkg.featured
                            ? 'bg-[#0B2559] text-white border-[#163B82] shadow-[0_18px_46px_-14px_rgba(11,37,89,0.28)]'
                            : 'bg-white text-slate-900 border-slate-200/90 shadow-[0_1px_8px_rgba(15,23,42,0.03)]'
                        }`}
                      >
                        <div className="space-y-5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold">{pkg.name}</span>
                            <span
                              className={`text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full ${
                                pkg.featured
                                  ? 'bg-sky-400/20 text-sky-200 border border-sky-300/30'
                                  : pkg.warm
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {pkg.badge}
                            </span>
                          </div>

                          <div className="flex items-baseline gap-2.5">
                            <span
                              className={`text-4xl font-bold font-mono tracking-tight ${
                                pkg.featured
                                  ? 'text-sky-300'
                                  : pkg.warm
                                  ? 'text-[#D97706]'
                                  : 'text-[#0B2559]'
                              }`}
                            >
                              {pkg.score}
                            </span>
                            <span
                              className={`text-xs font-medium ${
                                pkg.featured ? 'text-slate-300' : 'text-slate-500'
                              }`}
                            >
                              {pkg.gradeLabel}
                            </span>
                          </div>

                          <p
                            className={`text-xs sm:text-[13px] leading-relaxed ${
                              pkg.featured ? 'text-slate-300' : 'text-slate-600'
                            }`}
                          >
                            {pkg.tagline}
                          </p>

                          <ul className="space-y-2.5 pt-3 border-t border-current/10">
                            {pkg.features.map((feat) => (
                              <li
                                key={feat}
                                className="flex items-start gap-2.5 text-xs leading-relaxed"
                              >
                                <Check
                                  className={`w-4 h-4 shrink-0 mt-0.5 ${
                                    pkg.featured
                                      ? 'text-sky-300'
                                      : pkg.warm
                                      ? 'text-[#D97706]'
                                      : 'text-[#12489B]'
                                  }`}
                                />
                                <span
                                  className={
                                    pkg.featured ? 'text-slate-100' : 'text-slate-700'
                                  }
                                >
                                  {feat}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            handleOrderWithPrefill({
                              serviceType: pkg.serviceType,
                              notes: `Mục tiêu gói: ${pkg.name} (${pkg.score} - ${pkg.gradeLabel})`,
                            })
                          }
                          className={`btn-press w-full py-2.5 px-4 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                            pkg.featured
                              ? 'bg-white hover:bg-sky-50 text-[#0B2559]'
                              : pkg.warm
                              ? 'bg-[#D97706] hover:bg-[#B45309] text-white'
                              : 'bg-[#0B2559] hover:bg-[#12489B] text-white'
                          }`}
                        >
                          <span>Chọn gói {pkg.name}</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </RevealOnScroll>
              </div>
            </section>

            {/* 7. COMPACT 2x2 SERVICE CATALOG */}
            <section id="dich-vu" className="py-16 sm:py-20 bg-white">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div className="space-y-2 max-w-xl">
                    <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#12489B]">
                      Danh mục hỗ trợ
                    </div>
                    <h2 className="text-2xl sm:text-4xl font-semibold tracking-[-0.025em] text-slate-900">
                      Trọn gói cho mọi môn học
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={handleOrderNow}
                    className="btn-press self-start sm:self-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 hover:border-[#12489B] bg-white text-slate-800 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <span>Tư vấn &amp; báo giá nhanh</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#12489B]" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {SERVICES.map((srv) => {
                    const Icon = srv.icon;
                    return (
                      <div
                        key={srv.code}
                        className="group rounded-2xl bg-[#FCFCFF] hover:bg-white border border-slate-200/85 hover:border-[#12489B]/40 p-6 flex flex-col justify-between gap-5 transition-all"
                      >
                        <div className="space-y-3.5">
                          <div className="flex items-center justify-between">
                            <span className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-[#0B2559] flex items-center justify-center shadow-2xs">
                              <Icon className="w-4 h-4" />
                            </span>
                            <span className="font-mono text-xs font-semibold text-slate-400">
                              {srv.code}
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            <h3 className="text-base sm:text-lg font-semibold text-slate-900">
                              {srv.title}
                            </h3>
                            <p className="text-xs sm:text-[13.5px] text-slate-600 leading-relaxed">
                              {srv.desc}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {srv.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2.5 py-0.5 rounded-full bg-white border border-slate-200/80 text-[11px] font-medium text-slate-600"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            handleOrderWithPrefill({ serviceType: srv.serviceType })
                          }
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#12489B] group-hover:gap-2 transition-all self-start cursor-pointer"
                        >
                          <span>Đặt dịch vụ này</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* 8. FAQ ACCORDION */}
            <section
              id="faq"
              className="py-16 sm:py-20 bg-[#FCFCFF] border-t border-slate-200/75"
            >
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-4 space-y-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#12489B]">
                    Giải đáp nhanh
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-semibold tracking-[-0.025em] text-slate-900">
                    Câu hỏi thường gặp
                  </h2>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Cần báo giá riêng theo Rubric hoặc deadline gấp trong ngày? Gửi đề bài ngay để được phản hồi sau 15 phút.
                  </p>
                  <button
                    type="button"
                    onClick={handleOrderNow}
                    className="btn-press inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0B2559] hover:bg-[#12489B] text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <span>Đặt bài ngay</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="lg:col-span-8 space-y-2.5">
                  {FAQS.map((item, idx) => {
                    const isOpen = openFaqIdx === idx;
                    return (
                      <div
                        key={item.q}
                        className="rounded-2xl bg-white border border-slate-200/85 overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                          aria-expanded={isOpen}
                          className="w-full px-5 sm:px-6 py-4 text-left flex items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors cursor-pointer"
                        >
                          <span className="text-sm font-semibold text-slate-900">
                            {item.q}
                          </span>
                          <ChevronDown
                            className={`w-4 h-4 text-slate-500 shrink-0 transition-transform duration-200 ${
                              isOpen ? 'rotate-180 text-[#12489B]' : ''
                            }`}
                          />
                        </button>
                        <div className="faq-collapse" data-open={isOpen ? 'true' : 'false'}>
                          <div className="faq-collapse-inner">
                            <div className="px-5 sm:px-6 pb-4 text-xs sm:text-[13.5px] text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                              {item.a}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* 9. CLEAN CLOSING CTA & HAIRLINE STATS BAR (Jenni pre-footer rhythm) */}
            <section className="py-16 sm:py-24 bg-white border-t border-slate-200/75">
              <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
                <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.025em] text-slate-900 text-balance">
                  Hoàn thành bài làm chuẩn High Distinction ngay hôm nay
                </h2>
                <p className="text-sm sm:text-base text-slate-600">
                  Không cần đăng nhập rườm rà — gửi đề bài trong 60 giây.
                </p>

                <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Báo giá trong 15 phút</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Turnitin Non-repository</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Bảo mật thông tin 100%</span>
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleOrderNow}
                    className="btn-press inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0B2559] hover:bg-[#12489B] text-white text-sm font-semibold shadow-sm transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Đặt bài ngay</span>
                  </button>
                  <button
                    type="button"
                    onClick={openSampleLibrary}
                    className="btn-press inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-800 text-sm font-semibold transition-colors cursor-pointer"
                  >
                    <span>Xem 122+ Bài mẫu</span>
                  </button>
                </div>

                {/* Hairline Metrics Strip */}
                <div className="pt-12 mt-10 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div>
                    <div className="text-2xl sm:text-3xl font-semibold text-slate-900 font-mono">
                      5.200+
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Sinh viên đã đồng hành
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-semibold text-slate-900 font-mono">
                      100%
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Bàn giao đúng hạn Deadline
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-semibold text-slate-900 font-mono">
                      122+
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Bài mẫu điểm HD tại 25 trường
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {/* 10. GROUNDED DEEP ACADEMIC NAVY FOOTER */}
      <footer className="bg-[#071636] text-slate-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div className="md:col-span-5 space-y-3">
              <div className="text-xl font-bold tracking-tight text-white">
                Assign<span className="text-amber-400">Track</span>
              </div>
              <p className="text-xs sm:text-[13px] text-slate-400 max-w-sm leading-relaxed">
                Hệ thống hỗ trợ học thuật chuẩn Rubric quốc tế, kiểm định Turnitin chính hãng và theo dõi đơn hàng minh bạch 24/7.
              </p>
              <button
                type="button"
                onClick={handleOrderNow}
                className="btn-press inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#12489B] hover:bg-[#1D4ED8] text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <span>Đặt bài ngay</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="md:col-span-2 space-y-2.5 text-xs">
              <div className="font-semibold text-white">Điều hướng</div>
              <div className="flex flex-col items-start gap-2 text-slate-400">
                <a href="#quy-trinh" className="hover:text-white transition-colors">
                  Quy trình 3 bước
                </a>
                <a href="#cam-ket" className="hover:text-white transition-colors">
                  Gói cam kết
                </a>
                <a href="#dich-vu" className="hover:text-white transition-colors">
                  Danh mục dịch vụ
                </a>
                <a href="#faq" className="hover:text-white transition-colors">
                  Câu hỏi FAQ
                </a>
              </div>
            </div>

            <div className="md:col-span-2 space-y-2.5 text-xs">
              <div className="font-semibold text-white">Công cụ &amp; Tài liệu</div>
              <div className="flex flex-col items-start gap-2 text-slate-400">
                <button
                  type="button"
                  onClick={openSampleLibrary}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Thư viện Bài mẫu
                </button>
                <button
                  type="button"
                  onClick={() => onSelectClient({ tab: 'lookup' })}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Tra cứu Passcode
                </button>
                <button
                  type="button"
                  onClick={() => onSelectClient({ tab: 'checker' })}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Check AI Miễn phí
                </button>
              </div>
            </div>

            <div className="md:col-span-3 space-y-2.5 text-xs">
              <div className="font-semibold text-white">Chính sách &amp; Hệ thống</div>
              <div className="flex flex-col items-start gap-2 text-slate-400">
                <button
                  type="button"
                  onClick={() => setActivePolicyTab('refund')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Chính sách Hoàn tiền
                </button>
                <button
                  type="button"
                  onClick={() => setActivePolicyTab('privacy')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Chính sách Bảo mật
                </button>
                <button
                  type="button"
                  onClick={() => setActivePolicyTab('terms')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Điều khoản Sử dụng
                </button>
                <button
                  type="button"
                  onClick={onSelectAdmin}
                  className="hover:text-amber-300 transition-colors cursor-pointer"
                >
                  Đăng nhập Quản trị viên
                </button>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11.5px] text-slate-400">
            <span>
              © {new Date().getFullYear()} AssignTrack Academic Support · Zalo tư vấn 24/7: 0916.045.202
            </span>
            <span>Bảo mật danh tính · Turnitin Non-repository</span>
          </div>
        </div>
      </footer>

      <LiveConversionFomoDock onOrderNow={() => handleOrderNow()} />

      <PolicyModal
        initialTab={activePolicyTab}
        onClose={() => setActivePolicyTab(null)}
      />
    </div>
  );
}
