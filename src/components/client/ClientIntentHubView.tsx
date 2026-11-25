import {
  ArrowRight,
  ArrowUpRight,
  KeyRound,
  PenLine,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { RevealOnScroll } from '../shared/RevealOnScroll';

interface ClientIntentHubViewProps {
  onSelectOrder: (serviceType?: string) => void;
  onSelectLookup: () => void;
  onSelectChecker: () => void;
}

export function ClientIntentHubView({
  onSelectOrder,
  onSelectLookup,
  onSelectChecker,
}: ClientIntentHubViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2 max-w-xl">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#12489B]">
            Cổng dịch vụ học thuật
          </div>
          <h2 className="text-2xl sm:text-4xl font-semibold tracking-[-0.025em] text-slate-900">
            Mọi thao tác trong một điểm chạm
          </h2>
        </div>
        <p className="text-sm text-slate-600 max-w-sm">
          Chọn đúng nhu cầu để gửi đề bài, mở không gian đơn hàng hoặc kiểm tra bài làm ngay.
        </p>
      </div>

      {/* 3 Clean Jenni-style Hairline Bento Cards */}
      <RevealOnScroll>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
          {/* Card 1: Đặt bài mới */}
          <div className="motion-card-lift rounded-2xl bg-white border border-slate-200/90 hover:border-[#12489B]/40 p-6 flex flex-col justify-between gap-6 shadow-[0_1px_10px_rgba(15,23,42,0.03)]">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="w-10 h-10 rounded-xl bg-[#0B2559] text-white flex items-center justify-center">
                  <PenLine className="w-4 h-4" />
                </span>
                <span className="text-[11px] font-semibold text-[#12489B] bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-full">
                  Từ 299K
                </span>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-semibold text-slate-900">
                  Đặt bài mới chuẩn Rubric
                </h3>
                <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed">
                  Gửi đề bài để nhận báo giá trong 15 phút. Kèm báo cáo Turnitin &amp; nguồn DOI thật.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onSelectOrder()}
              className="btn-press w-full py-2.5 px-4 rounded-xl bg-[#0B2559] hover:bg-[#12489B] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Gửi đề bài ngay</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Card 2: Tra cứu đơn */}
          <div className="motion-card-lift rounded-2xl bg-white border border-slate-200/90 hover:border-[#12489B]/40 p-6 flex flex-col justify-between gap-6 shadow-[0_1px_10px_rgba(15,23,42,0.03)]">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="w-10 h-10 rounded-xl bg-slate-100 text-[#0B2559] border border-slate-200/80 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </span>
                <span className="text-[11px] font-medium text-slate-500">
                  Passcode 24/7
                </span>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-semibold text-slate-900">
                  Tra cứu đơn hàng trực tuyến
                </h3>
                <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed">
                  Nhập mã đơn để theo dõi 6 mốc tiến độ, xem trước bản nháp và tải file Final.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onSelectLookup}
              className="btn-press w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-900 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Mở mã đơn hàng</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Card 3: Giảm AI & Đạo văn */}
          <div className="motion-card-lift rounded-2xl bg-white border border-slate-200/90 hover:border-[#D97706]/50 p-6 flex flex-col justify-between gap-6 shadow-[0_1px_10px_rgba(15,23,42,0.03)]">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="w-10 h-10 rounded-xl bg-amber-50 text-[#D97706] border border-amber-200/80 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </span>
                <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200/80 px-2.5 py-0.5 rounded-full">
                  Cứu gấp 24h
                </span>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-semibold text-slate-900">
                  Giảm tỷ lệ AI &amp; Turnitin
                </h3>
                <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed">
                  Biên tập thủ công câu chữ học thuật xuống dưới 10%, giữ nguyên luận điểm gốc.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onSelectOrder('Giảm tỷ lệ đạo văn & AI (Humanize)')}
              className="btn-press w-full py-2.5 px-4 rounded-xl border border-amber-300 bg-amber-50/60 hover:bg-amber-100/80 text-amber-950 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Đặt chỉnh sửa AI ngay</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </RevealOnScroll>

      {/* Clean Single-Row Free Checker Strip */}
      <RevealOnScroll delayMs={60}>
        <div className="rounded-2xl bg-[#FCFCFF] border border-slate-200/90 px-5 py-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <span className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200/80 text-[#12489B] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900">
                  Kiểm tra Đạo văn &amp; Văn phong AI miễn phí
                </h3>
                <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Free · Tức thì
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Tải file .docx / .txt để quét nhanh từng câu — Không lưu trữ bài vào dữ liệu.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onSelectChecker}
            className="btn-press shrink-0 px-4 py-2 rounded-xl border border-slate-200 hover:border-[#12489B] bg-white hover:bg-blue-50/40 text-slate-900 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Mở công cụ Check Free</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#12489B]" />
          </button>
        </div>
      </RevealOnScroll>
    </div>
  );
}
