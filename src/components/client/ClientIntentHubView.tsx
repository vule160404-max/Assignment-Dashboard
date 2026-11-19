import {
  ArrowRight,
  Award,
  Bookmark,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  PenLine,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

const ZALO_CONSULT_URL = 'https://zalo.me/0916045202';

interface ClientIntentHubViewProps {
  displayName: string;
  savedOrderCount: number;
  onSelectLookup: () => void;
  onSelectChecker: () => void;
}

const TRUST_STATS = [
  {
    value: 'Top 2 Việt Nam',
    label: 'Nền tảng hỗ trợ học thuật',
    icon: Award,
    iconWrapClass: 'bg-amber-50 text-[#D97706] ring-1 ring-amber-200/90',
    valueClass: 'text-[#0B2559]',
  },
  {
    value: '5.202+',
    label: 'Sinh viên đã tin dùng',
    icon: Users,
    iconWrapClass: 'bg-blue-50 text-[#12489B] ring-1 ring-blue-200/90',
    valueClass: 'text-[#12489B]',
  },
  {
    value: '100%',
    label: 'Tỷ lệ qua môn',
    icon: CheckCircle2,
    iconWrapClass: 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/80',
    valueClass: 'text-emerald-700',
  },
  {
    value: '70%',
    label: 'Bài đạt xuất sắc',
    icon: Sparkles,
    iconWrapClass: 'bg-amber-50/90 text-[#B45309] ring-1 ring-amber-300/70',
    valueClass: 'text-[#0B2559]',
  },
] as const;

export function ClientIntentHubView({
  displayName,
  savedOrderCount,
  onSelectLookup,
  onSelectChecker,
}: ClientIntentHubViewProps) {
  return (
    <div className="surface-enter max-w-6xl w-full mx-auto space-y-5">
      {/* Compact Hero Greeting & Prompt */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="space-y-1.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200/80 text-[#0B2559] text-[11px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F5B700]" />
            Chào mừng, {displayName}
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Bạn muốn{' '}
            <span className="bg-gradient-to-r from-[#0B2559] via-[#12489B] to-[#D97706] bg-clip-text text-transparent">
              làm gì?
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
            Chọn nhu cầu của bạn bên dưới để được đội ngũ AssignTrack hỗ trợ nhanh hoặc theo dõi tiến độ bài làm.
          </p>
        </div>
      </div>

      {/* 3 Core Intent Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 items-stretch">
        {/* Card 1: Tư vấn làm luận văn - báo cáo */}
        <article className="card-interactive relative overflow-hidden bg-white/95 border border-slate-200/85 rounded-2xl p-5 flex flex-col justify-between shadow-[0_8px_24px_-14px_rgba(11,37,89,0.08)]">
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#0B2559] to-[#12489B]"
          />

          <div>
            <div className="flex items-start justify-between gap-2.5">
              <span className="w-10 h-10 rounded-xl bg-blue-50 text-[#12489B] ring-1 ring-blue-200/80 flex items-center justify-center shrink-0">
                <PenLine className="w-5 h-5" />
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-[#12489B] border border-blue-200/70 tabular-nums">
                Chỉ từ 299K
              </span>
            </div>

            <h2 className="mt-4 text-base font-bold text-slate-900 leading-snug">
              Nhận tư vấn hỗ trợ làm luận văn - báo cáo
            </h2>

            <p className="mt-2.5 text-xs text-zinc-600 leading-relaxed">
              Hỗ trợ trọn gói Tiểu luận, Báo cáo thực tập, Khóa luận tốt nghiệp. Chuẩn học thuật, đúng deadline, kèm báo cáo Turnitin minh bạch.
            </p>
          </div>

          <div className="mt-5 pt-3.5 border-t border-slate-100">
            <a
              href={ZALO_CONSULT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-press w-full py-2.5 px-4 text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 bg-blue-50 text-[#0B2559] border border-blue-200/90 hover:bg-[#0B2559] hover:text-white hover:border-[#0B2559]"
            >
              <span>Nhận tư vấn qua Zalo</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </article>

        {/* Card 2 (Featured Center): Kiểm tra tiến độ bài làm */}
        <article className="card-interactive relative overflow-hidden bg-gradient-to-b from-[#EFF6FF]/90 via-white to-white border border-blue-300/85 rounded-2xl p-5 flex flex-col justify-between shadow-[0_14px_34px_-14px_rgba(18,72,155,0.22)] ring-1 ring-[#12489B]/10">
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#0B2559] via-[#12489B] to-[#F5B700]"
          />

          <div>
            <div className="flex items-start justify-between gap-2.5">
              <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0B2559] to-[#12489B] text-[#FDE047] shadow-sm flex items-center justify-center shrink-0">
                <Search className="w-5 h-5" />
              </span>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                {savedOrderCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-[#12489B] border border-blue-200/80 tabular-nums">
                    <Bookmark className="w-2.5 h-2.5" />
                    {savedOrderCount} đơn đã lưu
                  </span>
                )}
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-white shadow-2xs">
                  Đã có mã đơn
                </span>
              </div>
            </div>

            <h2 className="mt-4 text-base font-bold text-slate-900 leading-snug">
              Kiểm tra tiến độ bài làm
            </h2>
            <p className="text-[11px] font-semibold text-[#12489B] mt-0.5">
              (Đối với khách đã tạo đơn thành công)
            </p>

            <p className="mt-2.5 text-xs text-zinc-600 leading-relaxed">
              Tra cứu tiến độ 6 mốc thời gian thực bằng mã đơn hàng, xem trước tài liệu &amp; báo cáo Turnitin, thanh toán QR và trao đổi trực tiếp.
            </p>
          </div>

          <div className="mt-5 pt-3.5 border-t border-blue-100/90">
            <button
              type="button"
              onClick={onSelectLookup}
              className="btn-press w-full py-2.5 px-4 text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 bg-gradient-to-r from-[#0B2559] to-[#12489B] text-white hover:from-[#081B42] hover:to-[#0E3A7D] shadow-[0_6px_18px_-6px_rgba(11,37,89,0.5)]"
            >
              <span>Kiểm tra tiến độ ngay</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </article>

        {/* Card 3: Tư vấn giảm tỉ lệ đạo văn - AI */}
        <article className="card-interactive relative overflow-hidden bg-white/95 border border-slate-200/85 rounded-2xl p-5 flex flex-col justify-between shadow-[0_8px_24px_-14px_rgba(11,37,89,0.08)]">
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#D97706] to-[#F5B700]"
          />

          <div>
            <div className="flex items-start justify-between gap-2.5">
              <span className="w-10 h-10 rounded-xl bg-amber-50 text-[#D97706] ring-1 ring-amber-200/90 flex items-center justify-center shrink-0">
                <FileCheck2 className="w-5 h-5" />
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-[#B45309] border border-amber-200/80">
                Báo giá theo số trang
              </span>
            </div>

            <h2 className="mt-4 text-base font-bold text-slate-900 leading-snug">
              Nhận tư vấn hỗ trợ giảm tỉ lệ đạo văn - AI
            </h2>

            <p className="mt-2.5 text-xs text-zinc-600 leading-relaxed">
              Biên tập thủ công chuẩn văn phong học thuật, hạ tỷ lệ AI &amp; trùng lặp xuống mức an toàn theo đúng yêu cầu trường.
            </p>
          </div>

          <div className="mt-5 pt-3.5 border-t border-slate-100">
            <a
              href={ZALO_CONSULT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-press w-full py-2.5 px-4 text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 bg-amber-50/90 text-[#92400E] border border-amber-200/90 hover:bg-[#D97706] hover:text-white hover:border-[#D97706]"
            >
              <span>Nhận tư vấn qua Zalo</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </article>
      </div>

      {/* Compact Bottom Row: Free AI/Plagiarism Quick Access (5 cols) + 4-Metric Trust Bar (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Quick Access: Check Đạo văn & AI sơ bộ (Free) */}
        <section
          aria-label="Kiểm tra Đạo văn & AI miễn phí"
          className="lg:col-span-5 relative overflow-hidden bg-gradient-to-br from-[#07183B] via-[#0B2559] to-[#12489B] text-white rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-3 shadow-[0_14px_32px_-14px_rgba(11,37,89,0.45)] ring-1 ring-white/10"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-10 -right-10 w-32 h-32 rounded-full bg-[#F5B700]/20 blur-2xl"
          />

          <div className="relative z-10 flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-[#F5B700]/20 text-[#FDE047] ring-1 ring-[#F5B700]/35 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs sm:text-sm font-bold text-white truncate">
                  Check Đạo văn &amp; AI sơ bộ
                </p>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F5B700] text-[#07183B] shrink-0">
                  Free
                </span>
              </div>
              <p className="text-[11px] text-sky-200/90 mt-0.5 truncate">
                Đối chiếu nguồn học thuật mở &amp; dấu vết AI tức thì
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onSelectChecker}
            className="relative z-10 btn-press px-3.5 py-2 text-xs font-semibold rounded-xl bg-white text-[#0B2559] hover:bg-[#EFF6FF] inline-flex items-center gap-1 shadow-xs whitespace-nowrap shrink-0"
          >
            <span>Check ngay</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </section>

        {/* 4-Metric Trust Strip */}
        <section
          aria-label="Chỉ số uy tín"
          className="lg:col-span-7 bg-white/95 backdrop-blur-xs border border-slate-200/80 rounded-2xl shadow-[0_6px_24px_-12px_rgba(11,37,89,0.09)] overflow-hidden flex items-stretch"
        >
          <div className="w-full grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
            {TRUST_STATS.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.value}
                  className="px-3.5 py-3 flex items-center gap-2.5"
                >
                  <span
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${stat.iconWrapClass}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-bold tracking-tight tabular-nums leading-tight truncate ${stat.valueClass}`}
                    >
                      {stat.value}
                    </p>
                    <p className="text-[10px] sm:text-[11px] text-zinc-500 mt-0.5 leading-snug truncate">
                      {stat.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
