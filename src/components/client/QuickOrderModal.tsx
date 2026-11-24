import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Clock, FileText, ShieldCheck, Sparkles, X } from 'lucide-react';
import type { OrderPrefillData } from '../../lib/sampleSeo';
import { ClientOrderFormView } from './ClientOrderFormView';

interface QuickOrderModalProps {
  isOpen: boolean;
  defaultServiceType?: string;
  orderPrefill?: OrderPrefillData;
  onClose: () => void;
  onGoToLookup: () => void;
  onToast: (msg: string) => void;
}

export function QuickOrderModal({
  isOpen,
  defaultServiceType,
  orderPrefill,
  onClose,
  onGoToLookup,
  onToast,
}: QuickOrderModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Phiếu đăng ký đặt bài nhanh"
      onClick={onClose}
      className="fixed inset-0 z-[110] bg-[#071A42]/60 backdrop-blur-[3px] flex items-center justify-center p-3 sm:p-5"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[92vh] bg-white rounded-3xl border border-slate-200/90 shadow-[0_24px_70px_rgba(7,26,66,0.35)] overflow-hidden flex flex-col"
      >
        {/* Crisp Compact Navy Modal Header with 1-Click Close */}
        <div className="px-5 py-4 sm:px-6 bg-gradient-to-r from-[#071A42] via-[#0B2559] to-[#12489B] text-white flex items-start justify-between gap-4 shrink-0">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15 text-[10.5px] font-semibold text-amber-300">
                <Sparkles className="w-3 h-3" />
                <span>Đặt bài nhanh · Không cần đăng nhập</span>
              </span>
              {orderPrefill?.sourceBadge && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-400/20 border border-emerald-300/35 text-[10.5px] font-bold text-emerald-200">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{orderPrefill.sourceBadge}</span>
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-bold leading-snug">
              {orderPrefill?.sourceBadge
                ? 'Nhận bài viết mới độc bản cho kỳ học hiện tại · Báo giá trong 15 phút'
                : 'Phiếu đăng ký đặt bài & Báo giá trong 15 phút'}
            </h2>
            <div className="hidden sm:flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-sky-200/90">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-300" />
                Bảo mật 100%
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-300" />
                Cứu bài gấp 12h–24h
              </span>
              <span className="inline-flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-emerald-300" />
                Tặng báo cáo Turnitin &amp; AI
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ đặt bài"
            title="Đóng (ESC) — quay lại ngay trang đang xem"
            className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-semibold shrink-0 transition-colors"
          >
            <span>Đóng</span>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Compact Form Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 bg-[#F8FAFC]">
          <ClientOrderFormView
            compactModal
            defaultServiceType={defaultServiceType}
            orderPrefill={orderPrefill}
            onGoToLookup={() => {
              onClose();
              onGoToLookup();
            }}
            onClose={onClose}
            onToast={onToast}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
