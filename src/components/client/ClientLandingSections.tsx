import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck2,
  Lock,
  PenLine,
  ShieldCheck,
  Users,
} from 'lucide-react';

const ZALO_CONSULT_URL = 'https://zalo.me/0916045202';

const PORTAL_CAPABILITIES = [
  {
    step: '01',
    title: 'Theo dõi 6 mốc triển khai trực tuyến',
    detail: 'Cập nhật trạng thái thực tế từ lúc phân tích Rubric, lên dàn ý đến bản hoàn thiện cuối cùng.',
  },
  {
    step: '02',
    title: 'Xem trước bản nháp & Báo cáo kiểm định',
    detail: 'Đọc thử trực tiếp trên trình duyệt kèm tài liệu đối chiếu Đạo văn & AI trước khi tất toán.',
  },
  {
    step: '03',
    title: 'Nhắn tin riêng & Thanh toán VietQR tự động',
    detail: 'Trao đổi yêu cầu chỉnh sửa ngay trong không gian đơn hàng, bảo mật danh tính tuyệt đối.',
  },
] as const;

const OPERATIONAL_METRICS = [
  {
    value: '5.000+',
    label: 'Bài luận & Báo cáo hoàn thành',
    icon: FileCheck2,
  },
  {
    value: '98.6%',
    label: 'Tỷ lệ sinh viên hài lòng quay lại',
    icon: Users,
  },
  {
    value: '< 15 phút',
    label: 'Thời gian phản hồi & báo giá',
    icon: Clock,
  },
  {
    value: '100%',
    label: 'Đúng hạn Deadline cam kết',
    icon: CheckCircle2,
  },
] as const;

export function ClientValuePropCard() {
  return (
    <aside
      aria-label="Tính năng cổng theo dõi đơn hàng"
      className="relative overflow-hidden bg-[#081C44] text-white rounded-2xl p-6 sm:p-7 flex flex-col justify-between h-full border border-white/10 shadow-[0_12px_32px_rgba(8,28,68,0.2)]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 -right-16 w-48 h-48 rounded-full bg-[#1D4ED8]/25 blur-3xl"
      />

      <div className="relative z-10 flex items-center justify-between gap-2 pb-4 border-b border-white/10">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-sky-300">
          <Lock className="w-3.5 h-3.5 text-amber-300" />
          <span>Không gian đơn hàng bảo mật</span>
        </span>
        <span className="text-[11px] font-mono text-slate-300">24/7 Live</span>
      </div>

      <div className="relative z-10 py-4 space-y-3.5 flex-1 flex flex-col justify-center">
        {PORTAL_CAPABILITIES.map((item) => (
          <div key={item.step} className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-md bg-white/10 border border-white/15 font-mono text-[11px] font-bold text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
              {item.step}
            </span>
            <div className="space-y-0.5 min-w-0">
              <h3 className="text-xs sm:text-[13px] font-bold text-white leading-snug">
                {item.title}
              </h3>
              <p className="text-[11.5px] text-slate-300/90 leading-relaxed">
                {item.detail}
              </p>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

interface ClientLandingSectionsProps {
  onOpenChecker: (hintToast?: string) => void;
  onOpenOrder?: () => void;
}

export function ClientLandingSections({
  onOpenChecker,
  onOpenOrder,
}: ClientLandingSectionsProps) {
  return (
    <div className="space-y-6">
      {/* Unified Monochrome-Navy Architectural Metrics Ledger */}
      <section
        aria-label="Chỉ số vận hành thực tế"
        className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_2px_12px_rgba(15,23,42,0.03)] overflow-hidden"
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
          {OPERATIONAL_METRICS.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.value}
                className="px-4 py-4 sm:px-5 flex items-center gap-3.5"
              >
                <span className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200/80 text-[#0B2559] flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-base sm:text-lg font-bold font-mono tracking-tight tabular-nums text-slate-900 leading-tight">
                    {stat.value}
                  </p>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 leading-snug truncate">
                    {stat.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Cohesive 3-Card Service Suite (Zero Rainbow Top Bars, Honest Copy) */}
      <section aria-label="Hệ sinh thái dịch vụ học thuật" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Dịch vụ hỗ trợ học thuật
            </h2>
            <span className="hidden sm:inline text-xs text-slate-300">·</span>
            <span className="hidden sm:inline text-xs text-slate-500">
              Báo giá chi tiết theo từng Rubric môn học trước khi triển khai
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Custom Writing */}
          <article className="card-interactive rounded-2xl bg-white border border-slate-200/90 p-5 flex flex-col justify-between shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-slate-100 text-[#0B2559] flex items-center justify-center shrink-0">
                  <PenLine className="w-4 h-4" />
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[11px] font-semibold">
                  Theo Rubric môn
                </span>
              </div>

              <div className="space-y-1">
                <h3 className="text-sm sm:text-[15px] font-bold text-slate-900">
                  Viết mới Assignment &amp; Luận văn
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Triển khai độc bản Tiểu luận, Essay, Report, SPSS &amp; Dissertation chuẩn Đại học Quốc tế. Tặng kèm báo cáo kiểm định.
                </p>
              </div>
            </div>

            <div className="mt-5 pt-3.5 border-t border-slate-100">
              {onOpenOrder ? (
                <button
                  type="button"
                  onClick={onOpenOrder}
                  className="btn-press w-full py-2.5 px-3.5 rounded-xl bg-slate-900 hover:bg-[#0B2559] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Gửi đề bài &amp; Nhận báo giá</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <a
                  href={ZALO_CONSULT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-press w-full py-2.5 px-3.5 rounded-xl bg-slate-900 hover:bg-[#0B2559] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Nhận tư vấn ngay</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </article>

          {/* Card 2: Free Web Preliminary Scan (Featured Navy Card) */}
          <article className="card-interactive rounded-2xl bg-[#0B2559] text-white border border-[#163B82] p-5 flex flex-col justify-between shadow-[0_10px_28px_rgba(11,37,89,0.18)]">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-white/12 text-sky-300 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-amber-400/20 border border-amber-300/30 text-amber-300 font-mono text-[11px] font-bold">
                  Miễn phí trên Web
                </span>
              </div>

              <div className="space-y-1">
                <h3 className="text-sm sm:text-[15px] font-bold text-white">
                  Quét sơ bộ Đạo văn &amp; Dấu vết AI
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Tự kiểm tra nhanh từng câu trên trình duyệt hoàn toàn miễn phí trước khi nộp bài, không lưu trữ tài liệu của bạn.
                </p>
              </div>
            </div>

            <div className="mt-5 pt-3.5 border-t border-white/10">
              <button
                type="button"
                onClick={() => onOpenChecker()}
                className="btn-press w-full py-2.5 px-3.5 rounded-xl bg-white text-[#0B2559] hover:bg-sky-50 text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Mở công cụ quét miễn phí</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </article>

          {/* Card 3: Academic Paraphrasing & AI/Similarity Reduction */}
          <article className="card-interactive rounded-2xl bg-white border border-slate-200/90 p-5 flex flex-col justify-between shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-slate-100 text-[#0B2559] flex items-center justify-center shrink-0">
                  <FileCheck2 className="w-4 h-4" />
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200/80 text-emerald-800 font-mono text-[11px] font-semibold">
                  Xử lý gấp 6h–24h
                </span>
              </div>

              <div className="space-y-1">
                <h3 className="text-sm sm:text-[15px] font-bold text-slate-900">
                  Biên tập hạ tỷ lệ AI &amp; Trùng lặp
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Chuyên gia hiệu đính thủ công chuẩn văn phong học thuật, kéo chỉ số AI &amp; Similarity xuống ngưỡng an toàn của trường.
                </p>
              </div>
            </div>

            <div className="mt-5 pt-3.5 border-t border-slate-100">
              <a
                href={ZALO_CONSULT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-press w-full py-2.5 px-3.5 rounded-xl bg-slate-100 hover:bg-[#0B2559] text-slate-900 hover:text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Nhận báo giá sửa bài qua Zalo</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
