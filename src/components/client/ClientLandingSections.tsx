import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  FileCheck2,
  GraduationCap,
  MessageSquareText,
  PenLine,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';

interface ClientLandingSectionsProps {
  onOpenChecker: (hintToast?: string) => void;
  onToast: (msg: string) => void;
}

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

export function ClientLandingSections({
  onOpenChecker,
  onToast,
}: ClientLandingSectionsProps) {
  const [consultOpen, setConsultOpen] = useState(false);
  const [consultTopic, setConsultTopic] = useState('Tiểu luận / Báo cáo thực tập');
  const [consultDeadline, setConsultDeadline] = useState('');
  const [consultNote, setConsultNote] = useState('');
  const [copiedTemplate, setCopiedTemplate] = useState(false);

  const handleServiceAction = (id: ServiceItem['id']) => {
    if (id === 'turnitin') {
      onOpenChecker();
      return;
    }
    if (id === 'reduce') {
      onOpenChecker(
        'Tải file bài viết lên để kiểm tra sơ bộ tỷ lệ trùng lặp & AI trước khi nhận báo giá chỉnh sửa.'
      );
      return;
    }
    setConsultOpen(true);
  };

  const buildConsultMessage = () => {
    const lines = [
      'Chào đội ngũ AssignTrack, mình cần tư vấn dịch vụ học thuật:',
      `- Loại bài: ${consultTopic}`,
      consultDeadline.trim() ? `- Deadline dự kiến: ${consultDeadline.trim()}` : null,
      consultNote.trim() ? `- Yêu cầu chi tiết: ${consultNote.trim()}` : null,
      'Nhờ đội ngũ tư vấn lộ trình và báo giá giúp mình nhé!',
    ].filter(Boolean);
    return lines.join('\n');
  };

  const handleCopyConsultMessage = async () => {
    try {
      await navigator.clipboard.writeText(buildConsultMessage());
      setCopiedTemplate(true);
      onToast('Đã sao chép mẫu yêu cầu tư vấn — bạn chỉ cần dán gửi qua Zalo/Messenger.');
      window.setTimeout(() => setCopiedTemplate(false), 2500);
    } catch {
      onToast('Không thể sao chép tự động. Vui lòng chọn và sao chép nội dung mẫu.');
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
                  <button
                    type="button"
                    onClick={() => handleServiceAction(service.id)}
                    className={`btn-press w-full py-2.5 px-4 text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 ${
                      service.featured
                        ? 'bg-[#4338CA] text-white hover:bg-[#3730A3] shadow-2xs'
                        : 'bg-[#EEF2FF] text-[#4338CA] hover:bg-[#4338CA] hover:text-white border border-indigo-200/80'
                    }`}
                  >
                    <span>{service.ctaLabel}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Quick Consultation Modal (Portaled to document.body) */}
      {consultOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-[2px] flex items-center justify-center p-4"
            onClick={() => setConsultOpen(false)}
          >
            <div
              className="popover-enter bg-white border border-zinc-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-9 h-9 rounded-xl bg-[#F5F3FF] text-[#4338CA] flex items-center justify-center shrink-0">
                    <MessageSquareText className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Nhận tư vấn &amp; Báo giá nhanh
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Điền nhanh thông tin để tạo mẫu tin nhắn gửi tư vấn viên.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setConsultOpen(false)}
                  aria-label="Đóng"
                  className="btn-press p-1.5 text-zinc-400 hover:text-slate-800 hover:bg-zinc-100 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                    Loại bài cần hỗ trợ
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      'Tiểu luận / Báo cáo thực tập',
                      'Khóa luận tốt nghiệp',
                      'Check Turnitin chính hãng',
                      'Giảm tỷ lệ Đạo văn & AI',
                    ].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setConsultTopic(opt)}
                        className={`btn-press px-3 py-2 text-xs font-medium rounded-xl border text-left ${
                          consultTopic === opt
                            ? 'bg-[#EEF2FF] border-[#4338CA] text-[#4338CA]'
                            : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Deadline dự kiến (tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={consultDeadline}
                    onChange={(e) => setConsultDeadline(e.target.value)}
                    placeholder="Ví dụ: 25/11/2026 hoặc còn 5 ngày"
                    className="w-full px-3.5 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Đề tài / số trang dự kiến (tùy chọn)
                  </label>
                  <textarea
                    rows={2}
                    value={consultNote}
                    onChange={(e) => setConsultNote(e.target.value)}
                    placeholder="Ví dụ: Tiểu luận môn Marketing căn bản, khoảng 15 trang..."
                    className="w-full px-3.5 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA] resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => void handleCopyConsultMessage()}
                  className="btn-press flex-1 py-2.5 px-4 text-xs sm:text-sm font-semibold bg-[#4338CA] text-white rounded-xl hover:bg-[#3730A3] inline-flex items-center justify-center gap-1.5"
                >
                  {copiedTemplate ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Đã sao chép mẫu tin nhắn</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Sao chép mẫu gửi tư vấn</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setConsultOpen(false)}
                  className="btn-press px-4 py-2.5 text-xs sm:text-sm font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-xl"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
