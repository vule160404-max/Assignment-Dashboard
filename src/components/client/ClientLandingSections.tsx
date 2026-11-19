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
  },
  {
    icon: ShieldCheck,
    title: 'Chuẩn học thuật – Có báo cáo check đạo văn & AI (Turnitin)',
  },
  {
    icon: Clock,
    title: 'Đúng deadline – Cập nhật tiến độ rõ ràng',
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

/**
 * 1. Khối Cam kết cốt lõi — Đặt ngang hàng bên phải khung Tra cứu trên desktop
 * để toàn bộ trang vừa gọn trong 1 màn hình.
 */
export function ClientValuePropCard() {
  return (
    <aside
      aria-label="Cam kết cốt lõi"
      className="bg-[#F5F3FF] border border-indigo-200/70 rounded-2xl p-5 flex flex-col justify-between h-full"
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#4338CA]">
          <Sparkles className="w-3.5 h-3.5" />
          Cam kết cốt lõi
        </span>
        <span className="text-[11px] font-medium text-indigo-700/70">
          Minh bạch · Bảo mật
        </span>
      </div>

      <ul className="space-y-2.5 flex-1 flex flex-col justify-center">
        {VALUE_PROPS.map((item) => {
          const Icon = item.icon;
          return (
            <li
              key={item.title}
              className="flex items-center gap-3 bg-white/90 border border-indigo-100/90 rounded-xl px-3.5 py-2.5"
            >
              <span className="w-7 h-7 rounded-lg bg-[#EEF2FF] text-[#4338CA] flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4" />
              </span>
              <p className="text-xs sm:text-[13px] font-semibold text-slate-900 leading-snug">
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
      {/* 2. Dải chỉ số niềm tin — 1 thanh ngang 4 ô tinh gọn */}
      <section
        aria-label="Chỉ số uy tín"
        className="bg-white border border-zinc-200/90 rounded-2xl shadow-[0_2px_12px_rgb(15,23,42,0.02)] overflow-hidden"
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-zinc-100">
          {SOCIAL_PROOF_STATS.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.value}
                className="px-4 py-3.5 sm:px-5 flex items-center gap-3"
              >
                <span className="w-9 h-9 rounded-xl bg-[#F5F3FF] text-[#4338CA] flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-base sm:text-lg font-bold tracking-tight text-slate-900 tabular-nums leading-tight">
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
            <span className="text-xs font-bold uppercase tracking-wider text-[#4338CA]">
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
            const ctaClasses = `btn-press w-full py-2 px-3.5 text-xs font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 ${
              service.featured
                ? 'bg-[#4338CA] text-white hover:bg-[#3730A3] shadow-2xs'
                : 'bg-[#EEF2FF] text-[#4338CA] hover:bg-[#4338CA] hover:text-white border border-indigo-200/80'
            }`;

            return (
              <article
                key={service.id}
                className={`card-interactive bg-white rounded-2xl p-4 sm:p-5 flex flex-col justify-between ${
                  service.featured
                    ? 'border-2 border-[#4338CA]/35 shadow-[0_8px_24px_rgb(67,56,202,0.06)]'
                    : 'border border-zinc-200/90 shadow-[0_2px_14px_rgb(15,23,42,0.02)]'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          service.featured
                            ? 'bg-[#4338CA] text-white'
                            : 'bg-[#F5F3FF] text-[#4338CA]'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 leading-snug">
                          {service.title}
                        </h3>
                        <p className="text-sm font-bold text-[#4338CA] tabular-nums mt-0.5">
                          {service.price}
                        </p>
                      </div>
                    </div>

                    {service.badge && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#EEF2FF] text-[#4338CA] border border-indigo-200/70 shrink-0">
                        {service.badge}
                      </span>
                    )}
                  </div>

                  <p className="mt-3 text-xs text-zinc-600 leading-relaxed">
                    {service.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-100">
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
