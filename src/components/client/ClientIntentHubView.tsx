import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  Clock,
  FileCheck2,
  KeyRound,
  PenLine,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface ClientIntentHubViewProps {
  displayName?: string;
  savedOrderCount?: number;
  onSelectOrder: (serviceType?: string) => void;
  onSelectLookup: () => void;
  onSelectChecker: () => void;
}

export function ClientIntentHubView({
  displayName,
  savedOrderCount = 0,
  onSelectOrder,
  onSelectLookup,
  onSelectChecker,
}: ClientIntentHubViewProps) {
  return (
    <div className="surface-enter w-full space-y-8">
      {/* Editorial Section Header (Synchronized with Landing Page Typography) */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2 max-w-2xl">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#12489B]">
            {displayName
              ? `Chào mừng, ${displayName}`
              : 'Dịch vụ & Tiện ích Trực tuyến'}
          </div>
          <h2 className="text-2xl sm:text-4xl font-bold tracking-[-0.03em] text-slate-900 leading-tight">
            Bạn đang cần{' '}
            <span className="text-[#12489B]">hỗ trợ việc gì</span> hôm nay?
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
            Sử dụng trực tiếp mọi dịch vụ mà không cần tạo tài khoản — gửi phiếu đặt bài, theo dõi tiến độ bằng Mã đơn hoặc kiểm tra đạo văn miễn phí.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 self-start md:self-auto px-3.5 py-2 rounded-full bg-white border border-zinc-200/90 text-xs font-semibold text-slate-700 shadow-2xs shrink-0">
          <Clock className="w-3.5 h-3.5 text-[#EA580C]" />
          <span>Báo giá minh bạch trong 15 phút</span>
        </div>
      </div>

      {/* 3 Equal-Height Architectural Service Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Card 01: Viết mới Luận văn & Báo cáo */}
        <article className="group rounded-3xl bg-white border border-zinc-200/90 hover:border-[#12489B]/45 p-7 flex flex-col justify-between gap-6 shadow-[0_10px_30px_rgba(15,23,42,0.03)] hover:shadow-[0_18px_40px_rgba(18,72,155,0.09)] transition-all">
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <span className="w-11 h-11 rounded-2xl bg-[#F4F7FB] border border-blue-200/80 text-[#12489B] flex items-center justify-center shrink-0">
                <PenLine className="w-5 h-5" />
              </span>
              <span className="font-mono text-xs font-bold text-zinc-400 tracking-wider">
                01 / ĐẶT BÀI MỚI
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-900 leading-snug">
                Hỗ trợ viết Luận văn &amp; Báo cáo
              </h3>
              <p className="text-xs sm:text-[13px] text-zinc-600 leading-relaxed">
                Biên soạn trọn gói Assignment, Essay, Case Study &amp; Dissertation đúng chuyên ngành và chuẩn trích dẫn quốc tế.
              </p>
            </div>

            <ul className="space-y-2.5 pt-1 text-xs text-slate-700">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-[#12489B] shrink-0 mt-0.5" />
                <span>Bám sát từng tiêu chí chấm điểm trong Rubric</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-[#12489B] shrink-0 mt-0.5" />
                <span>100% nguồn học thuật thật, chuẩn APA / Harvard</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-[#12489B] shrink-0 mt-0.5" />
                <span>Tặng kèm báo cáo Turnitin &amp; kiểm tra AI 0%</span>
              </li>
            </ul>
          </div>

          <div className="pt-5 border-t border-zinc-100">
            <button
              type="button"
              onClick={() =>
                onSelectOrder('Viết mới Assignment / Essay / Report')
              }
              className="btn-press w-full py-3 px-5 rounded-full bg-[#F4F7FB] hover:bg-[#0B2559] text-[#0B2559] hover:text-white border border-blue-200/90 hover:border-[#0B2559] text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors"
            >
              <span>Điền phiếu đặt bài ngay</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </article>

        {/* Card 02 (Focal Royal Navy Card): Tra cứu tiến độ bằng Mã đơn */}
        <article className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#071A42] via-[#0B2559] to-[#12489B] text-white border border-[#1E448F] p-7 flex flex-col justify-between gap-6 shadow-[0_20px_48px_-14px_rgba(11,37,89,0.45)]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full bg-sky-400/20 blur-3xl"
          />

          <div className="relative space-y-5">
            <div className="flex items-center justify-between gap-3">
              <span className="w-11 h-11 rounded-2xl bg-white/12 border border-white/20 text-sky-300 flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5" />
              </span>
              <div className="flex items-center gap-1.5">
                {savedOrderCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-white/15 text-sky-200 border border-white/15">
                    <Bookmark className="w-3 h-3" />
                    {savedOrderCount} đơn
                  </span>
                )}
                <span className="px-2.5 py-0.5 rounded-full bg-sky-400/20 border border-sky-300/30 text-sky-200 text-[10.5px] font-bold uppercase tracking-wider">
                  Đã có mã đơn
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white leading-snug">
                Tra cứu tiến độ bài làm 24/7
              </h3>
              <p className="text-xs sm:text-[13px] text-slate-200/85 leading-relaxed">
                Nhập <strong>Mã đơn hàng (Passcode)</strong> được cấp để mở khóa bảng tiến độ trực tiếp mà không cần đăng nhập.
              </p>
            </div>

            <ul className="space-y-2.5 pt-1 text-xs text-slate-100/95">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" />
                <span>Cập nhật minh bạch 6 mốc tiến độ thời gian thực</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" />
                <span>Xem trước bản nháp &amp; báo cáo Turnitin trước khi tất toán</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" />
                <span>Thanh toán VietQR &amp; gửi góp ý chỉnh sửa ngay trên trang</span>
              </li>
            </ul>
          </div>

          <div className="relative pt-5 border-t border-white/15">
            <button
              type="button"
              onClick={onSelectLookup}
              className="btn-press group w-full py-3 px-5 rounded-full bg-gradient-to-r from-[#F59E0B] to-[#EA580C] hover:from-[#D97706] hover:to-[#C2410C] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              <span>Mở khóa bằng Mã đơn</span>
              <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
          </div>
        </article>

        {/* Card 03: Giảm tỷ lệ Đạo văn & AI */}
        <article className="group rounded-3xl bg-white border border-zinc-200/90 hover:border-amber-400/60 p-7 flex flex-col justify-between gap-6 shadow-[0_10px_30px_rgba(15,23,42,0.03)] hover:shadow-[0_18px_40px_rgba(217,119,6,0.08)] transition-all">
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <span className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200/90 text-[#D97706] flex items-center justify-center shrink-0">
                <FileCheck2 className="w-5 h-5" />
              </span>
              <span className="font-mono text-xs font-bold text-zinc-400 tracking-wider">
                03 / HUMANIZE &amp; EDIT
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-900 leading-snug">
                Giảm tỷ lệ Đạo văn &amp; Chỉnh sửa AI
              </h3>
              <p className="text-xs sm:text-[13px] text-zinc-600 leading-relaxed">
                Biên tập thủ công giúp văn phong tự nhiên như người bản xứ, hạ tỷ lệ AI và trùng lặp về ngưỡng an toàn của trường.
              </p>
            </div>

            <ul className="space-y-2.5 pt-1 text-xs text-slate-700">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
                <span>Giữ nguyên lập luận, số liệu &amp; trích dẫn gốc của bài</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
                <span>Xử lý gấp trong 6h – 12h với bài sắp đến hạn nộp</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
                <span>Bàn giao kèm báo cáo kiểm định minh bạch trước – sau</span>
              </li>
            </ul>
          </div>

          <div className="pt-5 border-t border-zinc-100">
            <button
              type="button"
              onClick={() =>
                onSelectOrder('Giảm tỷ lệ đạo văn & AI (Humanize)')
              }
              className="btn-press w-full py-3 px-5 rounded-full bg-amber-50/90 hover:bg-[#D97706] text-[#92400E] hover:text-white border border-amber-200/90 hover:border-[#D97706] text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors"
            >
              <span>Đăng ký giảm Đạo văn – AI</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </article>
      </div>

      {/* Full-Width Free Plagiarism & AI Checker Spotlight Strip */}
      <section
        aria-label="Kiểm tra Đạo văn & AI miễn phí"
        className="rounded-3xl bg-white border border-blue-200/90 p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5 shadow-[0_10px_28px_rgba(18,72,155,0.06)]"
      >
        <div className="flex items-start sm:items-center gap-4 min-w-0">
          <span className="w-12 h-12 rounded-2xl bg-[#0B2559] text-sky-300 flex items-center justify-center shrink-0 shadow-sm">
            <ShieldCheck className="w-6 h-6" />
          </span>
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                Công cụ Check Đạo văn &amp; Nhận diện AI sơ bộ
              </h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
                <Sparkles className="w-3 h-3" />
                Miễn phí 100%
              </span>
            </div>
            <p className="text-xs sm:text-[13px] text-zinc-600 leading-relaxed">
              Tải tệp Word / dán văn bản để rà soát nhanh từng câu trùng lặp và dấu vết AI trước khi nộp — không cần đăng nhập, không lưu trữ bài viết của bạn.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onSelectChecker}
          className="btn-press shrink-0 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#0B2559] hover:bg-[#12489B] text-white text-xs sm:text-sm font-bold shadow-sm transition-colors whitespace-nowrap"
        >
          <span>Check miễn phí ngay</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </section>
    </div>
  );
}
