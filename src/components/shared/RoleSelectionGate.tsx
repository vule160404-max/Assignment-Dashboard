import { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  FileCheck2,
  FileSearch,
  GraduationCap,
  Lock,
  LogIn,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { SampleLibraryView } from './SampleLibraryView';

interface RoleSelectionGateProps {
  onSelectClient: () => void;
  onSelectAdmin: () => void;
}

const TRUST_CARDS = [
  {
    icon: FileCheck2,
    badge: 'Turnitin & AI 0%',
    title: 'An toàn tuyệt đối khi nộp bài',
    desc: 'Tặng kèm báo cáo Turnitin & kiểm tra AI rõ ràng — đạo văn dưới 10%, văn phong tự nhiên như người viết.',
  },
  {
    icon: GraduationCap,
    badge: 'Đội ngũ GPA 3.6+',
    title: 'Đúng chuyên ngành, bám sát Rubric',
    desc: 'Người viết tốt nghiệp Thạc sĩ & Đại học quốc tế, phân tích sâu từng tiêu chí chấm điểm của giảng viên.',
  },
  {
    icon: Clock,
    badge: 'Cứu gấp 12h – 24h',
    title: 'Đúng hạn 100%, không trễ Deadline',
    desc: 'Nhận xử lý bài gấp sát giờ nộp, cập nhật tiến độ liên tục giúp bạn hoàn toàn yên tâm.',
  },
  {
    icon: Lock,
    badge: 'Portal minh bạch 24/7',
    title: 'Xem trước bài trước khi thanh toán',
    desc: 'Theo dõi tiến độ trực tuyến và xem trước chất lượng bài viết trực tiếp trên Portal trước khi tất toán.',
  },
];

const ACHIEVEMENTS = [
  {
    value: '5.000+',
    label: 'Bài Assignment & Luận văn đã hoàn thành',
    sub: 'Sinh viên tại Anh · Úc · Mỹ · Canada · Việt Nam',
    accent: 'bg-white border-zinc-200/90 text-slate-900',
    valueColor: 'text-[#0B2559]',
  },
  {
    value: '98.6%',
    label: 'Tỷ lệ sinh viên hài lòng & quay lại',
    sub: 'Đánh giá 4.9/5 từ hơn 2.000 khách hàng',
    accent: 'bg-white border-zinc-200/90 text-slate-900',
    valueColor: 'text-[#12489B]',
  },
  {
    value: '72+',
    label: 'Điểm trung bình đạt Distinction / HD',
    sub: 'Đảm bảo nguồn trích dẫn thật, không bịa tài liệu',
    accent: 'bg-gradient-to-br from-amber-50 to-orange-50/80 border-amber-200/90 text-slate-900',
    valueColor: 'text-[#C2410C]',
  },
  {
    value: '100%',
    label: 'Bảo mật tuyệt đối & Sửa miễn phí',
    sub: 'Giữ kín thông tin cá nhân · Bảo hành sửa theo góp ý',
    accent: 'bg-[#0B2559] border-[#163B82] text-white',
    valueColor: 'text-sky-300',
  },
];

const PROCESS_STEPS = [
  {
    num: '01',
    title: 'Gửi đề bài, Rubric & hạn nộp',
    desc: 'Bấm "Order Now", gửi yêu cầu và file đề bài của trường — tư vấn viên báo giá minh bạch ngay trong 15 phút.',
  },
  {
    num: '02',
    title: 'Triển khai bài viết & Kiểm tra chất lượng',
    desc: 'Chuyên gia đúng ngành viết bài theo chuẩn APA / Harvard, đối chiếu 100% tài liệu tham khảo thật và rà soát kỹ từng tiêu chí điểm.',
  },
  {
    num: '03',
    title: 'Xem trước bài, nhận báo cáo Turnitin & Nộp bài',
    desc: 'Bạn xem trước chất lượng bài làm cùng báo cáo kiểm tra đạo văn — ưng ý mới tất toán để tải file hoàn chỉnh nộp ngay.',
  },
];

const PACKAGES = [
  {
    name: 'Standard',
    score: '55–64',
    gradeLabel: 'Pass / Credit',
    tagline: 'Phù hợp bài tập tuần, bài phản biện ngắn và đề bài tiêu chuẩn cần qua môn chắc chắn.',
    featured: false,
    warm: false,
    features: [
      'Đáp ứng đầy đủ yêu cầu đề bài & Rubric cơ bản',
      '100% tài liệu tham khảo thật, chuẩn APA / Harvard',
      'Miễn phí 01 lần chỉnh sửa theo góp ý của bạn',
      'Theo dõi tiến độ làm bài trực tuyến bất cứ lúc nào',
    ],
  },
  {
    name: 'Premium',
    score: '65–74',
    gradeLabel: 'Merit / Distinction',
    tagline: 'Lựa chọn phổ biến nhất cho Assignment chính, Essay học thuật & Case Study cần điểm cao.',
    featured: true,
    warm: false,
    badge: 'PHỔ BIẾN NHẤT',
    features: [
      'Phân tích phản biện sâu, lập luận sắc bén ghi điểm giảng viên',
      '100% trích dẫn từ sách & tạp chí học thuật thật — không bịa nguồn',
      'Tặng kèm báo cáo kiểm tra Đạo văn & AI Integrity (đạo văn < 10%)',
      'Miễn phí 03 lần chỉnh sửa & bổ sung theo góp ý giảng viên',
      'Được xem trước nội dung bài làm trước khi thanh toán đủ',
    ],
  },
  {
    name: 'Ultra Premium',
    score: '75+',
    gradeLabel: 'High Distinction',
    tagline: 'Dành cho Luận văn, Dissertation, Capstone & các môn chuyên sâu đòi hỏi điểm xuất sắc.',
    featured: false,
    warm: true,
    badge: 'CAM KẾT ĐIỂM HD',
    features: [
      'Chuyên gia đầu ngành (Thạc sĩ / Nghiên cứu sinh) trực tiếp viết',
      'Rà soát chéo 2 vòng + hỗ trợ chạy & phân tích dữ liệu SPSS / Stata / R',
      'Trình bày hoàn chỉnh Trang bìa, Mục lục tự động sẵn sàng nộp ngay',
      'Chỉnh sửa miễn phí không giới hạn đến khi bạn hài lòng',
      'Ưu tiên hỗ trợ 1-1 & nhận cứu bài Deadline gấp',
    ],
  },
];

const SERVICES = [
  {
    code: '01 / 04',
    icon: BookOpen,
    title: 'Viết Assignment & Essay học thuật',
    desc: 'Hỗ trợ viết mới hoặc nâng cấp bài cho các ngành Kinh doanh, Tài chính, Marketing, Ngôn ngữ Anh, Luật, CNTT và Giáo dục.',
    tags: ['Critical Review', 'Case Study', 'Reflective Essay', 'Business Report'],
  },
  {
    code: '02 / 04',
    icon: GraduationCap,
    title: 'Luận văn, Dissertation & Đồ án tốt nghiệp',
    desc: 'Đồng hành trọn gói từ lên đề cương (Proposal), tổng quan tài liệu, phương pháp nghiên cứu đến xử lý số liệu thực tế.',
    tags: ['Proposal', 'Literature Review', 'SPSS / Stata / R', 'Full Thesis'],
  },
  {
    code: '03 / 04',
    icon: FileSearch,
    title: 'Kiểm tra Đạo văn & Tối ưu AI Integrity',
    desc: 'Quét trực tuyến ngay trên Cổng Khách hàng, phát hiện đoạn trùng lặp hoặc dấu hiệu AI và diễn đạt lại tự nhiên chuẩn học thuật.',
    tags: ['Turnitin Report', 'AI Detection', 'Paraphrasing', 'Humanizer'],
  },
  {
    code: '04 / 04',
    icon: Award,
    title: 'Proofreading, Citations & Chuẩn hóa Format',
    desc: 'Rà soát ngữ pháp học thuật, chuẩn hóa trích dẫn APA 7th, Harvard, MLA, IEEE khớp 100% nguồn peer-reviewed và căn chỉnh Trang bìa, Mục lục chuẩn trường.',
    tags: ['Proofreading', 'APA 7th / Harvard', 'Peer-reviewed Sources', 'Word & PDF'],
  },
];

const FAQS = [
  {
    q: 'Làm sao để đặt bài và theo dõi tiến độ làm bài?',
    a: 'Bạn chỉ cần bấm nút "Order Now" để vào trang Khách hàng, gửi đề bài kèm hạn nộp. Sau khi xác nhận, bạn sẽ nhận một mã đơn riêng để theo dõi tiến độ hoàn thành theo từng ngày ngay trên web.',
  },
  {
    q: 'Tôi có được xem trước bài làm trước khi thanh toán đủ không?',
    a: 'Có. Khi bài hoàn thành, bạn được mở xem trước trực tiếp phần đầu bài viết (gồm Trang bìa, Mục lục và các trang mở đầu) để kiểm tra văn phong và chất lượng trước khi thanh toán phần còn lại để tải bản đầy đủ.',
  },
  {
    q: 'Bài viết có đảm bảo nguồn tài liệu thật và không bị dính đạo văn / AI không?',
    a: 'Hoàn toàn đảm bảo. Mọi trích dẫn trong bài đều lấy từ sách và tạp chí khoa học có thật, khớp 100% giữa thân bài và danh mục tài liệu tham khảo. Bài hoàn thiện luôn đi kèm báo cáo kiểm tra đạo văn và AI rõ ràng.',
  },
  {
    q: 'Thông tin cá nhân, mã sinh viên và bài làm của tôi có được giữ kín không?',
    a: 'Tuyệt đối bảo mật. Toàn bộ file đề bài, tên trường và bài làm của bạn chỉ dùng nội bộ để xử lý đơn hàng, kiểm tra đạo văn không lưu vào kho dữ liệu chung và cam kết không chia sẻ cho bất kỳ ai.',
  },
  {
    q: 'Nếu cần chỉnh sửa thêm theo góp ý của giảng viên thì có mất phí không?',
    a: 'Bạn được chỉnh sửa miễn phí theo đúng yêu cầu ban đầu của đề bài và gói dịch vụ đã chọn (1 lần với gói Standard, 3 lần với gói Premium và không giới hạn với gói Ultra Premium).',
  },
  {
    q: 'Nút "Đăng nhập" ở góc trên dành cho ai?',
    a: 'Nút Đăng nhập dành riêng cho Quản trị viên & Đội ngũ điều hành. Nếu bạn là sinh viên / khách hàng cần đặt bài, tra cứu tiến độ hoặc kiểm tra đạo văn, hãy bấm "Order Now" để vào thẳng trang Khách hàng.',
  },
];

const FORMAT_TICKER = [
  'Assignment',
  'Critical Review',
  'Academic Essay',
  'Case Study',
  'Literature Review',
  'Dissertation & Thesis',
  'Business Report',
  'Research Proposal',
  'APA 7th & Harvard',
  'Turnitin & AI Check',
];

export function RoleSelectionGate({
  onSelectClient,
  onSelectAdmin,
}: RoleSelectionGateProps) {
  const [activePage, setActivePage] = useState<'home' | 'samples'>('home');
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  const openSampleLibrary = () => {
    setActivePage('samples');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openHomePage = () => {
    setActivePage('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-[#0F172A] flex flex-col">
      {/* Top Promo Strip */}
      <div className="bg-gradient-to-r from-[#071A42] via-[#0B2559] to-[#12489B] text-white/95 text-[11.5px] font-medium py-2 px-4 text-center">
        <span className="inline-flex items-center gap-2 flex-wrap justify-center">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span>
            Ưu đãi sinh viên mới: Miễn phí báo cáo Turnitin &amp; AI Check khi đặt bài ngay hôm nay
          </span>
          <button
            type="button"
            onClick={onSelectClient}
            className="underline decoration-amber-300/80 underline-offset-2 font-semibold text-amber-300 hover:text-amber-200"
          >
            Nhận ưu đãi &amp; Đặt bài →
          </button>
        </span>
      </div>

      {/* Sticky White Single-Row Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-zinc-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={openHomePage}
            className="text-left focus:outline-none"
          >
            <BrandLogo />
          </button>

          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-slate-600">
            <button
              type="button"
              onClick={openHomePage}
              className={`hover:text-[#12489B] transition-colors ${
                activePage === 'home' ? 'text-[#12489B] font-bold' : ''
              }`}
            >
              Trang chủ
            </button>
            <button
              type="button"
              onClick={openSampleLibrary}
              className={`inline-flex items-center gap-1.5 hover:text-[#12489B] transition-colors ${
                activePage === 'samples'
                  ? 'text-[#12489B] font-bold bg-blue-50 px-3 py-1.5 rounded-full'
                  : ''
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Sample Library</span>
            </button>
            {activePage === 'home' && (
              <>
                <a href="#quy-trinh" className="hover:text-[#12489B] transition-colors">
                  Quy trình
                </a>
                <a href="#cam-ket" className="hover:text-[#12489B] transition-colors">
                  Gói cam kết
                </a>
                <a href="#dich-vu" className="hover:text-[#12489B] transition-colors">
                  Dịch vụ
                </a>
                <a href="#faq" className="hover:text-[#12489B] transition-colors">
                  FAQ
                </a>
              </>
            )}
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onSelectAdmin}
              className="btn-press inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-zinc-200 bg-white hover:border-[#12489B]/50 hover:text-[#12489B] text-xs font-semibold text-slate-700 transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Đăng nhập</span>
            </button>

            <button
              type="button"
              onClick={onSelectClient}
              className="btn-press group inline-flex items-center gap-2 pl-4 pr-1.5 py-1.5 rounded-full bg-gradient-to-r from-[#F59E0B] to-[#EA580C] hover:from-[#D97706] hover:to-[#C2410C] text-white text-xs font-bold shadow-[0_6px_20px_rgba(234,88,12,0.28)] transition-all"
            >
              <span>ORDER NOW</span>
              <span className="w-6 h-6 rounded-full bg-white/20 group-hover:bg-white group-hover:text-[#EA580C] flex items-center justify-center transition-colors">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {activePage === 'samples' ? (
          <SampleLibraryView
            onOrderNow={onSelectClient}
            onBackHome={openHomePage}
          />
        ) : (
        <>
        {/* HERO SECTION: Deep Academic Navy Canvas + Blueprint Grid + Floating Trust Cards */}
        <section className="relative overflow-hidden bg-[#0B2559] text-white pt-16 pb-20 sm:pt-20 sm:pb-24">
          {/* Subtle Architectural Blueprint Grid & Glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.09]"
            style={{
              backgroundImage:
                'linear-gradient(to right, #93C5FD 1px, transparent 1px), linear-gradient(to bottom, #93C5FD 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[780px] h-[380px] rounded-full bg-sky-400/15 blur-3xl"
          />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-sm text-[11px] font-semibold uppercase tracking-[0.1em] text-sky-200">
                <span className="w-2 h-2 rounded-full bg-sky-300 shadow-[0_0_10px_#7DD3FC]" />
                <span>Hỗ trợ Assignment &amp; Luận văn chuẩn Quốc tế · Đúng hẹn 100%</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-[54px] font-bold tracking-[-0.03em] leading-[1.1] text-white">
                Cứu cánh Deadline &amp; Chinh phục{' '}
                <span className="text-sky-300">điểm High Distinction</span> cho mọi
                bài luận của bạn
              </h1>

              <p className="text-sm sm:text-base text-slate-200/85 max-w-2xl mx-auto leading-relaxed">
                Viết bài đúng chuyên ngành, bám sát Rubric từng môn học, cam kết 100% nguồn trích dẫn thật và tặng kèm báo cáo kiểm tra Đạo văn – AI. Theo dõi tiến độ trực tuyến và xem trước bài trước khi thanh toán.
              </p>

              <div className="pt-2 flex flex-wrap items-center justify-center gap-3.5">
                <button
                  type="button"
                  onClick={onSelectClient}
                  className="btn-press group inline-flex items-center gap-3 pl-6 pr-2 py-2 rounded-full bg-gradient-to-r from-[#F59E0B] to-[#EA580C] hover:from-[#D97706] hover:to-[#C2410C] text-white text-sm font-bold shadow-[0_10px_28px_rgba(234,88,12,0.35)] transition-all"
                >
                  <span>Order Now — Đặt bài ngay</span>
                  <span className="w-8 h-8 rounded-full bg-white text-[#EA580C] flex items-center justify-center transition-transform group-hover:rotate-12">
                    <ArrowUpRight className="w-4 h-4" />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={openSampleLibrary}
                  className="btn-press group inline-flex items-center gap-2.5 pl-5 pr-2 py-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/20 text-white text-sm font-semibold backdrop-blur-sm transition-colors"
                >
                  <span>Xem Thư viện Bài mẫu (Sample Library)</span>
                  <span className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </button>
              </div>
            </div>

            {/* 4 Signature Floating Trust Cards */}
            <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {TRUST_CARDS.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.title}
                    className="rounded-2xl bg-white/[0.07] hover:bg-white/[0.11] border border-white/15 backdrop-blur-md p-5 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="w-9 h-9 rounded-xl bg-sky-400/15 border border-sky-300/25 flex items-center justify-center text-sky-300">
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="text-[10.5px] font-semibold uppercase tracking-wider text-sky-200/90 bg-white/10 px-2.5 py-0.5 rounded-full">
                        {card.badge}
                      </span>
                    </div>
                    <h2 className="text-sm font-bold text-white">{card.title}</h2>
                    <p className="text-xs text-slate-300/85 mt-1 leading-relaxed">
                      {card.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ACADEMIC FORMATS TICKER STRIP */}
        <div className="bg-white border-b border-zinc-200/80 py-3.5 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-semibold text-slate-500">
            {FORMAT_TICKER.map((item, idx) => (
              <span key={item} className="inline-flex items-center gap-2">
                {idx > 0 && (
                  <span className="w-1 h-1 rounded-full bg-[#12489B]/40 hidden sm:inline-block" />
                )}
                <span className="hover:text-[#12489B] transition-colors">{item}</span>
              </span>
            ))}
          </div>
        </div>

        {/* ACHIEVEMENTS BENTO GRID */}
        <section className="py-16 sm:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="space-y-2 max-w-2xl">
                <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#12489B]">
                  <span className="w-2 h-2 rounded-full bg-[#12489B]" />
                  <span>Con số khẳng định chất lượng</span>
                </div>
                <h2 className="text-2xl sm:text-4xl font-bold tracking-[-0.03em] text-slate-900">
                  Minh bạch từ khâu nghiên cứu đến{' '}
                  <span className="text-[#12489B]">kết quả bàn giao</span>
                </h2>
              </div>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200/80 px-3.5 py-2 rounded-full self-start md:self-auto">
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                <span>4.9/5 điểm tin cậy từ sinh viên quốc tế</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {ACHIEVEMENTS.map((stat) => (
                <div
                  key={stat.label}
                  className={`rounded-3xl border p-6 flex flex-col justify-between gap-5 shadow-[0_8px_28px_rgb(15,23,42,0.03)] ${stat.accent}`}
                >
                  <div className={`text-4xl sm:text-[42px] font-bold tracking-tight font-mono ${stat.valueColor}`}>
                    {stat.value}
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-bold leading-snug">{stat.label}</div>
                    <div className="text-xs opacity-75">{stat.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3-STEP PROCESS & QUICK ORDER CTA SECTION */}
        <section id="quy-trinh" className="py-16 sm:py-20 bg-white border-y border-zinc-200/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#12489B]">
                  <span className="w-2 h-2 rounded-full bg-[#12489B]" />
                  <span>Quy trình 3 bước tinh gọn</span>
                </div>
                <h2 className="text-2xl sm:text-4xl font-bold tracking-[-0.03em] text-slate-900">
                  Đặt bài trong <span className="text-[#12489B]">60 giây</span>,
                  theo dõi trực tuyến đến lúc nhận file
                </h2>
              </div>

              <div className="space-y-4">
                {PROCESS_STEPS.map((step) => (
                  <div
                    key={step.num}
                    className="flex items-start gap-4 p-4 rounded-2xl bg-[#F4F7FB] border border-zinc-200/80"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#0B2559] text-sky-300 font-mono font-bold text-sm flex items-center justify-center shrink-0">
                      {step.num}
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-slate-900">{step.title}</h3>
                      <p className="text-xs text-zinc-600 leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Conversion Card */}
            <div className="lg:col-span-5">
              <div className="rounded-3xl bg-[#0B2559] text-white p-7 sm:p-8 shadow-xl border border-[#163B82] space-y-6">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-200 bg-white/10 px-3 py-1 rounded-full">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Hỗ trợ tư vấn 24/7</span>
                  </span>
                  <span className="text-[11px] font-mono text-sky-300/90">
                    Phản hồi &lt; 15 phút
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-bold tracking-tight">
                    Sẵn sàng bắt đầu bài làm của bạn?
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Chuyển ngay sang Cổng Khách hàng để gửi đề bài, nhận báo giá minh bạch theo từng mốc điểm, hoặc quét thử Đạo văn &amp; AI miễn phí.
                  </p>
                </div>

                <ul className="space-y-2.5 text-xs text-slate-200">
                  {[
                    'Gửi đề bài nhanh, nhận báo giá minh bạch chỉ sau 15 phút',
                    'Đính kèm trực tiếp đề bài, Rubric và bản nháp (nếu có)',
                    'Cam kết 100% nguồn trích dẫn thật & tặng kèm báo cáo Turnitin',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={onSelectClient}
                  className="btn-press group w-full flex items-center justify-between pl-6 pr-2 py-2.5 rounded-full bg-gradient-to-r from-[#F59E0B] to-[#EA580C] hover:from-[#D97706] hover:to-[#C2410C] text-white text-sm font-bold shadow-[0_8px_24px_rgba(234,88,12,0.35)] transition-all"
                >
                  <span>ORDER NOW · Vào Cổng Khách hàng</span>
                  <span className="w-8 h-8 rounded-full bg-white text-[#EA580C] flex items-center justify-center">
                    <ArrowUpRight className="w-4 h-4" />
                  </span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 3 GRADE-COMMITMENT PACKAGES */}
        <section id="cam-ket" className="py-16 sm:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="text-center max-w-2xl mx-auto space-y-2.5">
              <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#12489B]">
                <span className="w-2 h-2 rounded-full bg-[#12489B]" />
                <span>Gói cam kết chuẩn đầu ra</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-bold tracking-[-0.03em] text-slate-900">
                Chọn mốc điểm mục tiêu phù hợp với{' '}
                <span className="text-[#12489B]">Rubric của bạn</span>
              </h2>
              <p className="text-sm text-zinc-600">
                Mọi gói đều đảm bảo đúng hạn, bảo mật thông tin tuyệt đối và đối chiếu trích dẫn học thuật chuẩn mực.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
              {PACKAGES.map((pkg) => (
                <div
                  key={pkg.name}
                  className={`rounded-3xl p-7 flex flex-col justify-between gap-6 border transition-all ${
                    pkg.featured
                      ? 'bg-[#0B2559] text-white border-[#1D4ED8]/60 shadow-[0_20px_50px_rgba(11,37,89,0.25)] lg:-translate-y-2'
                      : pkg.warm
                      ? 'bg-gradient-to-b from-amber-50/90 to-white text-slate-900 border-amber-200/90 shadow-sm'
                      : 'bg-white text-slate-900 border-zinc-200/90 shadow-sm'
                  }`}
                >
                  <div className="space-y-5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold tracking-tight">
                        {pkg.name}
                      </span>
                      {pkg.badge && (
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                            pkg.featured
                              ? 'bg-sky-400/20 text-sky-200 border border-sky-300/30'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {pkg.badge}
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline gap-2.5">
                      <span
                        className={`text-4xl font-black font-mono tracking-tight ${
                          pkg.featured
                            ? 'text-sky-300'
                            : pkg.warm
                            ? 'text-[#C2410C]'
                            : 'text-[#0B2559]'
                        }`}
                      >
                        {pkg.score}
                      </span>
                      <span
                        className={`text-xs font-semibold ${
                          pkg.featured ? 'text-slate-300' : 'text-zinc-500'
                        }`}
                      >
                        {pkg.gradeLabel}
                      </span>
                    </div>

                    <p
                      className={`text-xs leading-relaxed ${
                        pkg.featured ? 'text-slate-300' : 'text-zinc-600'
                      }`}
                    >
                      {pkg.tagline}
                    </p>

                    <ul className="space-y-2.5 pt-2 border-t border-current/10">
                      {pkg.features.map((feat) => (
                        <li
                          key={feat}
                          className="flex items-start gap-2.5 text-xs leading-relaxed"
                        >
                          <span
                            className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                              pkg.featured
                                ? 'bg-sky-400/20 text-sky-300'
                                : pkg.warm
                                ? 'bg-amber-100 text-[#C2410C]'
                                : 'bg-blue-50 text-[#12489B]'
                            }`}
                          >
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                          <span className={pkg.featured ? 'text-slate-100' : 'text-slate-700'}>
                            {feat}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={onSelectClient}
                    className={`btn-press w-full py-2.5 px-4 rounded-full text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors ${
                      pkg.featured
                        ? 'bg-sky-300 hover:bg-sky-200 text-[#0B2559]'
                        : pkg.warm
                        ? 'bg-gradient-to-r from-[#F59E0B] to-[#EA580C] hover:from-[#D97706] hover:to-[#C2410C] text-white shadow-sm'
                        : 'bg-[#0B2559] hover:bg-[#12489B] text-white'
                    }`}
                  >
                    <span>Order Now · Chọn gói {pkg.name}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 2x2 SERVICE CATALOG */}
        <section id="dich-vu" className="py-16 sm:py-20 bg-white border-y border-zinc-200/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="space-y-2 max-w-2xl">
                <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#12489B]">
                  <span className="w-2 h-2 rounded-full bg-[#12489B]" />
                  <span>Hệ sinh thái dịch vụ</span>
                </div>
                <h2 className="text-2xl sm:text-4xl font-bold tracking-[-0.03em] text-slate-900">
                  Giải pháp trọn gói cho mọi giai đoạn{' '}
                  <span className="text-[#12489B]">học tập &amp; nghiên cứu</span>
                </h2>
              </div>
              <button
                type="button"
                onClick={onSelectClient}
                className="btn-press self-start md:self-auto inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 hover:bg-blue-100 text-[#12489B] text-xs font-bold transition-colors"
              >
                <span>Gửi yêu cầu tư vấn</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {SERVICES.map((srv) => {
                const Icon = srv.icon;
                return (
                  <div
                    key={srv.code}
                    className="group rounded-3xl bg-[#F4F7FB] hover:bg-white border border-zinc-200/90 hover:border-[#12489B]/40 p-7 flex flex-col justify-between gap-6 transition-all shadow-[0_6px_24px_rgb(15,23,42,0.02)] hover:shadow-[0_14px_34px_rgb(15,23,42,0.06)]"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="w-11 h-11 rounded-2xl bg-[#0B2559] text-sky-300 flex items-center justify-center">
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className="font-mono text-[11px] font-bold text-[#12489B] bg-white border border-zinc-200 px-2.5 py-1 rounded-full">
                          {srv.code}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-lg font-bold text-slate-900">
                          {srv.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
                          {srv.desc}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {srv.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2.5 py-1 rounded-full bg-white border border-zinc-200/90 text-[11px] font-semibold text-slate-700"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={onSelectClient}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#12489B] group-hover:gap-2.5 transition-all self-start"
                    >
                      <span>Đặt dịch vụ này ngay</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* SPLIT FAQ ACCORDION */}
        <section id="faq" className="py-16 sm:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-4 space-y-4">
              <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#12489B]">
                <span className="w-2 h-2 rounded-full bg-[#12489B]" />
                <span>Giải đáp thắc mắc</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-[-0.03em] text-slate-900">
                Câu hỏi thường gặp trước khi đặt bài
              </h2>
              <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
                Cần tư vấn nhanh theo đúng Rubric hoặc deadline gấp của môn học? Vào Cổng Khách hàng để gửi yêu cầu trực tiếp.
              </p>
              <button
                type="button"
                onClick={onSelectClient}
                className="btn-press inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0B2559] hover:bg-[#12489B] text-white text-xs font-bold shadow-sm transition-colors"
              >
                <span>Order Now</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="lg:col-span-8 bg-white rounded-3xl border border-zinc-200/90 divide-y divide-zinc-200/80 overflow-hidden shadow-2xs">
              {FAQS.map((item, idx) => {
                const isOpen = openFaqIdx === idx;
                return (
                  <div key={item.q}>
                    <button
                      type="button"
                      onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                      className="w-full px-6 py-4.5 text-left flex items-center justify-between gap-4 hover:bg-zinc-50/80 transition-colors"
                    >
                      <span className="text-sm font-bold text-slate-900">
                        {item.q}
                      </span>
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                          isOpen
                            ? 'bg-[#12489B] text-white'
                            : 'bg-blue-50 text-[#12489B]'
                        }`}
                      >
                        {isOpen ? (
                          <Minus className="w-3.5 h-3.5" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="px-6 pb-5 text-xs sm:text-sm text-zinc-600 leading-relaxed">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* FINAL DARK CTA BANNER */}
        <section className="px-4 sm:px-6 lg:px-8 pb-16">
          <div className="max-w-7xl mx-auto rounded-3xl bg-gradient-to-br from-[#071A42] via-[#0B2559] to-[#12489B] text-white p-8 sm:p-14 text-center space-y-6 shadow-xl relative overflow-hidden">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-24 right-0 w-72 h-72 rounded-full bg-sky-400/15 blur-3xl"
            />
            <div className="relative max-w-2xl mx-auto space-y-3">
              <h2 className="text-2xl sm:text-4xl font-bold tracking-[-0.03em]">
                Sẵn sàng nâng tầm bài nghiên cứu của bạn ngay hôm nay?
              </h2>
              <p className="text-xs sm:text-sm text-slate-200/85 leading-relaxed">
                Đặt đơn trực tuyến, theo dõi tiến độ theo thời gian thực và kiểm duyệt chất lượng học thuật trên cùng một nền tảng.
              </p>
            </div>
            <div className="relative flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onSelectClient}
                className="btn-press group inline-flex items-center gap-3 pl-6 pr-2 py-2 rounded-full bg-gradient-to-r from-[#F59E0B] to-[#EA580C] hover:from-[#D97706] hover:to-[#C2410C] text-white text-sm font-bold shadow-lg"
              >
                <span>Order Now — Đặt bài ngay</span>
                <span className="w-8 h-8 rounded-full bg-white text-[#EA580C] flex items-center justify-center">
                  <ArrowUpRight className="w-4 h-4" />
                </span>
              </button>
              <button
                type="button"
                onClick={onSelectAdmin}
                className="btn-press inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-semibold"
              >
                <ShieldCheck className="w-4 h-4 text-sky-300" />
                <span>Đăng nhập Quản trị viên</span>
              </button>
            </div>
          </div>
        </section>
        </>
        )}
      </main>

      {/* CLEAN FOOTER */}
      <footer className="bg-white border-t border-zinc-200/90 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <BrandLogo />
            <p className="text-xs text-zinc-500 max-w-md">
              AssignTrack — Nền tảng hỗ trợ học thuật, kiểm định đạo văn &amp; điều phối đơn hàng minh bạch dành cho sinh viên.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-xs font-semibold text-slate-600">
            <button
              type="button"
              onClick={openSampleLibrary}
              className="hover:text-[#12489B]"
            >
              Sample Library (Bài mẫu)
            </button>
            <button
              type="button"
              onClick={onSelectClient}
              className="hover:text-[#12489B]"
            >
              Cổng Khách hàng (Order Now)
            </button>
            <button
              type="button"
              onClick={onSelectAdmin}
              className="hover:text-[#12489B]"
            >
              Đăng nhập Quản trị viên
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
