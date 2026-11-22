import {
  ArrowUpRight,
  BookOpen,
  FilePlus2,
  KeyRound,
  LogIn,
  ShieldCheck,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';

export type PublicNavKey = 'home' | 'order' | 'lookup' | 'checker' | 'samples';

interface PublicTopNavProps {
  activeNav: PublicNavKey;
  onGoHome: () => void;
  onOpenOrder: () => void;
  onOpenLookup: () => void;
  onOpenChecker: () => void;
  onOpenSamples: () => void;
  onSelectAdmin: () => void;
}

export function PublicTopNav({
  activeNav,
  onGoHome,
  onOpenOrder,
  onOpenLookup,
  onOpenChecker,
  onOpenSamples,
  onSelectAdmin,
}: PublicTopNavProps) {
  return (
    <>
      {/* Top Promo Strip */}
      <div className="bg-gradient-to-r from-[#071A42] via-[#0B2559] to-[#12489B] text-white/95 text-[11.5px] font-medium py-2 px-4 text-center">
        <span className="inline-flex items-center gap-2 flex-wrap justify-center">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span>
            Ưu đãi sinh viên mới: Miễn phí báo cáo Turnitin &amp; AI Check khi đặt bài ngay hôm nay
          </span>
          <button
            type="button"
            onClick={onOpenOrder}
            className="underline decoration-amber-300/80 underline-offset-2 font-semibold text-amber-300 hover:text-amber-200 transition-colors"
          >
            Nhận ưu đãi &amp; Đặt bài →
          </button>
        </span>
      </div>

      {/* Unified Sticky White Single-Row Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-zinc-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onGoHome}
            className="text-left focus:outline-none shrink-0"
          >
            <BrandLogo />
          </button>

          {/* Unified 5-Tab Navigation Bar (Always Visible on Desktop) */}
          <nav
            aria-label="Điều hướng chính"
            className="hidden lg:inline-flex items-center bg-slate-100/90 border border-slate-200/80 p-1 rounded-xl gap-0.5 text-xs font-semibold"
          >
            <button
              type="button"
              onClick={onGoHome}
              className={`btn-press px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                activeNav === 'home'
                  ? 'bg-white text-[#0B2559] font-bold shadow-xs ring-1 ring-slate-900/5'
                  : 'text-slate-600 hover:bg-white/70 hover:text-[#12489B]'
              }`}
            >
              Trang chủ
            </button>
            <button
              type="button"
              onClick={onOpenOrder}
              className={`btn-press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                activeNav === 'order'
                  ? 'bg-white text-[#EA580C] font-bold shadow-xs ring-1 ring-orange-500/20'
                  : 'text-slate-600 hover:bg-white hover:text-[#EA580C]'
              }`}
            >
              <FilePlus2 className="w-3.5 h-3.5 text-[#EA580C]" />
              <span>Đặt bài mới</span>
            </button>
            <button
              type="button"
              onClick={onOpenLookup}
              className={`btn-press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                activeNav === 'lookup'
                  ? 'bg-white text-[#12489B] font-bold shadow-xs ring-1 ring-slate-900/5'
                  : 'text-slate-600 hover:bg-white hover:text-[#12489B]'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5 text-[#12489B]" />
              <span>Tra cứu mã đơn</span>
            </button>
            <button
              type="button"
              onClick={onOpenChecker}
              className={`btn-press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                activeNav === 'checker'
                  ? 'bg-white text-[#12489B] font-bold shadow-xs ring-1 ring-slate-900/5'
                  : 'text-slate-600 hover:bg-white hover:text-[#12489B]'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#12489B]" />
              <span>Check Đạo văn &amp; AI</span>
            </button>
            <button
              type="button"
              onClick={onOpenSamples}
              className={`btn-press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                activeNav === 'samples'
                  ? 'bg-white text-[#12489B] font-bold shadow-xs ring-1 ring-slate-900/5'
                  : 'text-slate-600 hover:bg-white hover:text-[#12489B]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Sample Library</span>
            </button>
          </nav>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onSelectAdmin}
              className="btn-press inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-zinc-200 bg-white hover:border-[#12489B]/50 hover:text-[#12489B] text-xs font-semibold text-slate-700 transition-colors whitespace-nowrap"
              title="Chuyển sang cổng dành cho Admin / Nhân sự"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Đăng nhập</span>
            </button>

            <button
              type="button"
              onClick={onOpenOrder}
              className="btn-press group inline-flex items-center gap-2 pl-4 pr-1.5 py-1.5 rounded-full bg-gradient-to-r from-[#F59E0B] to-[#EA580C] hover:from-[#D97706] hover:to-[#C2410C] text-white text-xs font-bold shadow-[0_6px_20px_rgba(234,88,12,0.28)] transition-colors whitespace-nowrap"
            >
              <span>ORDER NOW</span>
              <span className="w-6 h-6 rounded-full bg-white/20 group-hover:bg-white group-hover:text-[#EA580C] flex items-center justify-center transition-colors">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </button>
          </div>
        </div>

        {/* Tablet & Mobile Quick Service Tabs Bar */}
        <div className="lg:hidden border-t border-zinc-100 px-3 py-2 bg-white/95">
          <div className="max-w-7xl mx-auto grid grid-cols-4 gap-1 bg-slate-100/90 border border-slate-200/70 p-1 rounded-xl text-[11px] font-semibold">
            <button
              type="button"
              onClick={onOpenOrder}
              className={`btn-press py-1.5 px-1.5 rounded-lg inline-flex items-center justify-center gap-1 transition-colors ${
                activeNav === 'order'
                  ? 'bg-white text-[#EA580C] font-bold shadow-2xs'
                  : 'text-slate-700 hover:bg-white hover:text-[#EA580C]'
              }`}
            >
              <FilePlus2 className="w-3.5 h-3.5 text-[#EA580C] shrink-0" />
              <span className="truncate">Đặt bài</span>
            </button>
            <button
              type="button"
              onClick={onOpenLookup}
              className={`btn-press py-1.5 px-1.5 rounded-lg inline-flex items-center justify-center gap-1 transition-colors ${
                activeNav === 'lookup'
                  ? 'bg-white text-[#12489B] font-bold shadow-2xs'
                  : 'text-slate-700 hover:bg-white hover:text-[#12489B]'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5 text-[#12489B] shrink-0" />
              <span className="truncate">Tra cứu</span>
            </button>
            <button
              type="button"
              onClick={onOpenChecker}
              className={`btn-press py-1.5 px-1.5 rounded-lg inline-flex items-center justify-center gap-1 transition-colors ${
                activeNav === 'checker'
                  ? 'bg-white text-[#12489B] font-bold shadow-2xs'
                  : 'text-slate-700 hover:bg-white hover:text-[#12489B]'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#12489B] shrink-0" />
              <span className="truncate">Check AI</span>
            </button>
            <button
              type="button"
              onClick={onOpenSamples}
              className={`btn-press py-1.5 px-1.5 rounded-lg inline-flex items-center justify-center gap-1 transition-colors ${
                activeNav === 'samples'
                  ? 'bg-white text-[#12489B] font-bold shadow-2xs'
                  : 'text-slate-700 hover:bg-white hover:text-[#12489B]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Bài mẫu</span>
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
