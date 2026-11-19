import {
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck2,
  GraduationCap,
  PenLine,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

interface ClientLandingSectionsProps {
  onOpenChecker: (hintToast?: string) => void;
}

const ZALO_CONSULT_URL = 'https://zalo.me/0916045202';

const VALUE_PROPS = [
  {
    icon: GraduationCap,
    title: 'Hỗ trợ Tiểu luận | Báo cáo thực tập | Khóa luận',
    sub: 'Đa chuyên ngành Kinh tế, Quản trị, Tài chính, Marketing, CNTT…',
  },
  {
    icon: ShieldCheck,
    title: 'Chuẩn học thuật – Có báo cáo check đạo văn & AI (Turnitin)',
    sub: 'Trích dẫn chuẩn APA / Harvard, bàn giao kèm file đối chiếu minh bạch.',
  },
  {
    icon: Clock,
    title: 'Đúng deadline – Cập nhật tiến độ rõ ràng',
    sub: 'Theo dõi trực tiếp 6 mốc hoàn thiện bài và trao đổi ngay trên hệ thống.',
  },
] as const;

const SOCIAL_PROOF_STATS = [
  {
    value: 'Top 2 Việt Nam',
    label: 'Nền tảng hỗ trợ học thuật uy tín',
    icon: Award,
  },
  {
    value: '5.202+',
    label: 'Sinh viên đã tin dùng',
    icon: Users,
  },
  {
    value: '100%',
    label: 'Tỷ lệ sinh viên qua môn',
    icon: CheckCircle2,
  },
  {
    value: '70%',
    label: 'Bài đạt điểm xuất sắc',
    icon: Sparkles,
  },
] as const;

interface ServiceItem {
  id: 'writing' | 'turnitin' | 'reduce';
  badge?: string;
  title: string;
  price: string;
  description: string;
  ctaLabel: string;
  icon: typeof PenLine;
  featured?: boolean;
  href?: string;
}

const SERVICES: readonly ServiceItem[] = [
  {
    id: 'writing',
    title: 'Hỗ trợ viết bài & Luận văn',
    price: 'Chỉ từ 499K',
    description:
      'Hỗ trợ trọn gói Tiểu luận, Báo cáo thực tập, Khóa luận tốt nghiệp. Kèm báo cáo Turnitin minh bạch.',
    ctaLabel: 'Nhận tư vấn ngay',
    icon: PenLine,
    href: ZALO_CONSULT_URL,
  },
  {
    id: 'turnitin',
    badge: 'Phổ biến',
    title: 'Check Đạo văn & AI (Turnitin)',
    price: 'Chỉ 40K / lượt',
    description:
      'Xuất file báo cáo Turnitin chính hãng (không lưu bài vào kho dữ liệu), nhận kết quả sau 5 phút.',
    ctaLabel: 'Check ngay',
    icon: ShieldCheck,
    featured: true,
  },
  {
    id: 'reduce',
    title: 'Giảm tỷ lệ Đạo văn & AI',
    price: 'Báo giá theo số trang',
    description:
      'Biên tập thủ công chuẩn văn phong học thuật, hạ tỷ lệ AI & trùng lặp xuống mức an toàn theo yêu cầu trường.',
    ctaLabel: 'Gửi file kiểm tra',
    icon: FileCheck2,
  },
];

export function ClientLandingSections({ onOpenChecker }: ClientLandingSectionsProps) {
  const handleServiceAction = (id: ServiceItem['id']) => {
    if (id === 'turnitin') {
      onOpenChecker();
      return;
    }
    if (id === 'reduce') {
      onOpenChecker(
        'Tải file bài viết lên để kiểm tra sơ bộ tỷ lệ trùng lặp & AI trước khi nhận báo giá chỉnh sửa.'
      );
    }
  };

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* 1. Khối Cam kết cốt lõi (Value Proposition Banner) — Đồng bộ chiều rộng với thẻ Tra cứu */}
      <section
        aria-label="Cam kết cốt lõi"
        className="max-w-2xl w-full mx-auto bg-[#F5F3FF] border border-indigo-200/70 rounded-2xl px-5 py-5 sm:px-7 sm:py-6"
      >
        <div className="flex items-center justify-between gap-2 mb-4">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#4338CA]">
            <Sparkles className="w-3.5 h-3.5" />
            Cam kết dịch vụ học thuật
          </span>
          <span className="text-[11px] font-medium text-indigo-700/70 hidden sm:inline">
            Minh bạch · Bảo mật · Đúng hạn
          </span>
        </div>

        <ul className="space-y-3.5">
          {VALUE_PROPS.map((item) => {
            const Icon = item.icon;
            return (
              <li
                key={item.title}
                className="flex items-start gap-3.5 bg-white/85 border border-indigo-100/90 rounded-xl px-4 py-3"
              >
                <span className="w-8 h-8 rounded-lg bg-[#EEF2FF] text-[#4338CA] flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 leading-snug">
                    {item.title}
                  </p>
                  <p className="text-xs text-zinc-600 mt-0.5 leading-relaxed">
                    {item.sub}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 2. Dải chỉ số niềm tin (Social Proof Bar) — 4 ô ngang bằng nhau */}
      <section aria-label="Chỉ số uy tín" className="max-w-5xl w-full mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {SOCIAL_PROOF_STATS.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.value}
                className="bg-white border border-zinc-200/90 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-[0_2px_12px_rgb(15,23,42,0.02)]"
              >
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <span className="w-8 h-8 rounded-lg bg-[#F5F3FF] text-[#4338CA] flex items-center justify-center">
                    <Icon className="w-4 h-4" />
                  </span>
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                    {stat.value}
                  </p>
                  <p className="text-xs text-zinc-600 mt-1 leading-snug">
                    {stat.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Bảng dịch vụ & Bảng giá nhanh (Service Cards) — 3 thẻ ngang */}
      <section aria-label="Dịch vụ và bảng giá nhanh" className="max-w-5xl w-full mx-auto space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#4338CA]">
              Dịch vụ &amp; Bảng giá nhanh
            </p>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mt-1">
              Giải pháp trọn gói cho bài học thuật của bạn
            </h2>
          </div>
          <p className="text-xs text-zinc-500">
            Báo giá rõ ràng trước khi triển khai · Không phát sinh chi phí ẩn
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          {SERVICES.map((service) => {
            const Icon = service.icon;
            const ctaClasses = `btn-press w-full py-2.5 px-4 text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 ${
              service.featured
                ? 'bg-[#4338CA] text-white hover:bg-[#3730A3] shadow-2xs'
                : 'bg-[#EEF2FF] text-[#4338CA] hover:bg-[#4338CA] hover:text-white border border-indigo-200/80'
            }`;

            return (
              <article
                key={service.id}
                className={`card-interactive relative bg-white rounded-2xl p-6 flex flex-col justify-between ${
                  service.featured
                    ? 'border-2 border-[#4338CA]/35 shadow-[0_10px_30px_rgb(67,56,202,0.07)]'
                    : 'border border-zinc-200/90 shadow-[0_4px_20px_rgb(15,23,42,0.03)]'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <span
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        service.featured
                          ? 'bg-[#4338CA] text-white'
                          : 'bg-[#F5F3FF] text-[#4338CA]'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </span>
                    {service.badge && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#EEF2FF] text-[#4338CA] border border-indigo-200/70">
                        {service.badge}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    {service.title}
                  </h3>

                  <div className="mt-2.5 inline-flex items-baseline gap-1.5">
                    <span className="text-lg font-bold text-[#4338CA] tabular-nums">
                      {service.price}
                    </span>
                  </div>

                  <p className="mt-3 text-xs sm:text-[13px] text-zinc-600 leading-relaxed">
                    {service.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-zinc-100">
                  {service.href ? (
                    <a
                      href={service.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={ctaClasses}
                    >
                      <span>{service.ctaLabel}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleServiceAction(service.id)}
                      className={ctaClasses}
                    >
                      <span>{service.ctaLabel}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
