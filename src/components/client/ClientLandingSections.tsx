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

const ZALO_CONSULT_URL = 'https://zalo.me/0916045202';

const VALUE_PROPS = [
  {
    icon: GraduationCap,
    title: 'Hỗ trợ Tiểu luận | Báo cáo thực tập | Khóa luận',
    iconClass: 'bg-indigo-400/20 text-indigo-200 ring-1 ring-indigo-300/25',
  },
  {
    icon: ShieldCheck,
    title: 'Chuẩn học thuật – Có báo cáo check đạo văn & AI (Turnitin)',
    iconClass: 'bg-emerald-400/20 text-emerald-300 ring-1 ring-emerald-300/25',
  },
  {
    icon: Clock,
    title: 'Đúng deadline – Cập nhật tiến độ rõ ràng',
    iconClass: 'bg-amber-400/20 text-amber-300 ring-1 ring-amber-300/25',
  },
] as const;

const SOCIAL_PROOF_STATS = [
  {
    value: 'Top 2 Việt Nam',
    label: 'Nền tảng hỗ trợ học thuật uy tín',
    icon: Award,
    iconWrapClass: 'bg-amber-50 text-amber-600 ring-1 ring-amber-200/80',
    valueClass: 'text-slate-900',
  },
  {
    value: '5.202+',
    label: 'Sinh viên đã tin dùng',
    icon: Users,
    iconWrapClass: 'bg-indigo-50 text-[#4338CA] ring-1 ring-indigo-200/80',
    valueClass: 'text-[#312E81]',
  },
  {
    value: '100%',
    label: 'Tỷ lệ sinh viên qua môn',
    icon: CheckCircle2,
    iconWrapClass: 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/80',
    valueClass: 'text-emerald-700',
  },
  {
    value: '70%',
    label: 'Bài đạt điểm xuất sắc',
    icon: Sparkles,
    iconWrapClass: 'bg-violet-50 text-violet-600 ring-1 ring-violet-200/80',
    valueClass: 'text-slate-900',
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
  topBarClass: string;
  iconBoxClass: string;
  priceClass: string;
  ctaClass: string;
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
    topBarClass: 'bg-gradient-to-r from-indigo-500 to-violet-500',
    iconBoxClass: 'bg-indigo-50 text-[#4338CA] ring-1 ring-indigo-200/70',
    priceClass: 'text-[#4338CA]',
    ctaClass:
      'bg-indigo-50 text-[#4338CA] border border-indigo-200/80 hover:bg-[#4338CA] hover:text-white hover:border-[#4338CA]',
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
    topBarClass: 'bg-gradient-to-r from-[#4338CA] via-[#6366F1] to-[#10B981]',
    iconBoxClass: 'bg-gradient-to-br from-[#4338CA] to-[#6366F1] text-white shadow-sm',
    priceClass: 'text-[#4338CA]',
    ctaClass:
      'bg-gradient-to-r from-[#4338CA] to-[#4F46E5] text-white hover:from-[#3730A3] hover:to-[#4338CA] shadow-[0_6px_18px_-6px_rgba(67,56,202,0.55)]',
  },
  {
    id: 'reduce',
    title: 'Giảm tỷ lệ Đạo văn & AI',
    price: 'Báo giá theo số trang',
    description:
      'Biên tập thủ công chuẩn văn phong học thuật, hạ tỷ lệ AI & trùng lặp xuống mức an toàn theo yêu cầu trường.',
    ctaLabel: 'Gửi file kiểm tra',
    icon: FileCheck2,
    topBarClass: 'bg-gradient-to-r from-emerald-500 to-teal-500',
    iconBoxClass: 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/70',
    priceClass: 'text-emerald-700',
    ctaClass:
      'bg-emerald-50/90 text-emerald-700 border border-emerald-200/80 hover:bg-emerald-600 hover:text-white hover:border-emerald-600',
  },
];

/**
 * 1. Khối Cam kết cốt lõi — Thẻ điểm nhấn Navy-Indigo chiều sâu đặt bên phải khung Tra cứu
 */
export function ClientValuePropCard() {
  return (
    <aside
      aria-label="Cam kết cốt lõi"
      className="relative overflow-hidden bg-gradient-to-br from-[#0F172A] via-[#1E1B4B] to-[#312E81] text-white rounded-2xl p-5 flex flex-col justify-between h-full shadow-[0_16px_38px_-14px_rgba(30,27,75,0.45)] ring-1 ring-white/10"
    >
      {/* Subtle ambient glow blobs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-14 -right-14 w-44 h-44 rounded-full bg-indigo-400/20 blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-16 -left-10 w-40 h-40 rounded-full bg-emerald-400/15 blur-2xl"
      />

      <div className="relative z-10 flex items-center justify-between gap-2 mb-3">
        <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/15 text-indigo-200 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          Cam kết cốt lõi
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Minh bạch · Bảo mật
        </span>
      </div>

      <ul className="relative z-10 space-y-2.5 flex-1 flex flex-col justify-center">
        {VALUE_PROPS.map((item) => {
          const Icon = item.icon;
          return (
            <li
              key={item.title}
              className="flex items-center gap-3 bg-white/[0.08] border border-white/12 hover:bg-white/[0.12] transition-colors rounded-xl px-3.5 py-2.5"
            >
              <span
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${item.iconClass}`}
              >
                <Icon className="w-4 h-4" />
              </span>
              <p className="text-xs sm:text-[13px] font-semibold text-white/95 leading-snug">
                {item.title}
              </p>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

interface ClientLandingSectionsProps {
  onOpenChecker: (hintToast?: string) => void;
}

/**
 * 2. Dải chỉ số niềm tin (compact 4-col bar) + 3. Bảng dịch vụ & Bảng giá nhanh (3 cards)
 */
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
    <div className="space-y-4">
      {/* 2. Dải chỉ số niềm tin — 1 thanh ngang 4 ô với điểm nhấn màu theo ngữ nghĩa */}
      <section
        aria-label="Chỉ số uy tín"
        className="bg-white/95 backdrop-blur-xs border border-slate-200/80 rounded-2xl shadow-[0_6px_24px_-12px_rgba(15,23,42,0.08)] overflow-hidden"
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
          {SOCIAL_PROOF_STATS.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.value}
                className="px-4 py-3.5 sm:px-5 flex items-center gap-3"
              >
                <span
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${stat.iconWrapClass}`}
                >
                  <Icon className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <p
                    className={`text-base sm:text-lg font-bold tracking-tight tabular-nums leading-tight ${stat.valueClass}`}
                  >
                    {stat.value}
                  </p>
                  <p className="text-[11px] sm:text-xs text-zinc-500 mt-0.5 leading-snug truncate">
                    {stat.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Bảng dịch vụ & Bảng giá nhanh — 3 thẻ ngang gọn, vừa 1 màn hình */}
      <section aria-label="Dịch vụ và bảng giá nhanh" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#4338CA]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4338CA]" />
              Dịch vụ &amp; Bảng giá nhanh
            </span>
            <span className="hidden sm:inline text-xs text-zinc-400">·</span>
            <span className="hidden sm:inline text-xs text-zinc-500">
              Báo giá minh bạch trước khi triển khai
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SERVICES.map((service) => {
            const Icon = service.icon;
            const ctaClasses = `btn-press w-full py-2 px-3.5 text-xs font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 ${service.ctaClass}`;

            return (
              <article
                key={service.id}
                className={`card-interactive relative overflow-hidden rounded-2xl p-4 sm:p-5 flex flex-col justify-between ${
                  service.featured
                    ? 'bg-gradient-to-b from-[#EEF2FF]/70 via-white to-white border border-indigo-300/80 shadow-[0_14px_34px_-14px_rgba(67,56,202,0.22)] ring-1 ring-indigo-500/10'
                    : 'bg-white/95 border border-slate-200/85 shadow-[0_8px_24px_-14px_rgba(15,23,42,0.08)]'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-0 top-0 h-[3px] ${service.topBarClass}`}
                />

                <div>
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${service.iconBoxClass}`}
                      >
                        <Icon className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 leading-snug">
                          {service.title}
                        </h3>
                        <p
                          className={`text-sm font-bold tabular-nums mt-0.5 ${service.priceClass}`}
                        >
                          {service.price}
                        </p>
                      </div>
                    </div>

                    {service.badge && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-r from-[#4338CA] to-[#6366F1] text-white shadow-2xs shrink-0">
                        {service.badge}
                      </span>
                    )}
                  </div>

                  <p className="mt-3 text-xs text-zinc-600 leading-relaxed">
                    {service.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100">
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
                      <ArrowRight className="w-3.5 h-3.5" />
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
