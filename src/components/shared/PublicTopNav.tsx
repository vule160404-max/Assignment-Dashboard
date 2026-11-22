import {
  ArrowUpRight,
  LogIn,
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
  const scrollToHomeSection = (sectionId: string) => {
    if (activeNav !== 'home') {
      onGoHome();
      window.setTimeout(() => {
        document
          .getElementById(sectionId)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
      return;
    }
    document
      .getElementById(sectionId)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const navLinkClass = (isActive: boolean) =>
    `relative py-5 text-[13px] font-semibold transition-colors whitespace-nowrap ${
      isActive
        ? 'text-[#0B2559] font-bold after:content-[""] after:absolute after:inset-x-0 after:bottom-0 after:h-[2.5px] after:rounded-full after:bg-[#12489B]'
        : 'text-slate-600 hover:text-[#12489B]'
    }`;

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

      {/* Unified Editorial Sticky White Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-zinc-200/85">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
          <button
            type="button"
            onClick={onGoHome}
            className="text-left focus:outline-none shrink-0"
          >
            <BrandLogo />
          </button>

          {/* Clean Editorial Navigation Links (Synchronized with Landing Page Sections + Core Services) */}
          <nav
            aria-label="Điều hướng chính"
            className="hidden lg:flex items-center gap-6 xl:gap-7"
          >
            <button
              type="button"
              onClick={onGoHome}
              className={navLinkClass(activeNav === 'home')}
            >
              Trang chủ
            </button>
            <button
              type="button"
              onClick={() => scrollToHomeSection('quy-trinh')}
              className={navLinkClass(false)}
            >
              Quy trình
            </button>
            <button
              type="button"
              onClick={() => scrollToHomeSection('cam-ket')}
              className={navLinkClass(false)}
            >
              Gói cam kết
            </button>
            <button
              type="button"
              onClick={onOpenLookup}
              className={navLinkClass(activeNav === 'lookup')}
            >
              Tra cứu đơn
            </button>
            <button
              type="button"
              onClick={onOpenChecker}
              className={navLinkClass(activeNav === 'checker')}
            >
              Check AI Free
            </button>
            <button
              type="button"
              onClick={onOpenSamples}
              className={navLinkClass(activeNav === 'samples')}
            >
              Bài mẫu
            </button>
            <button
              type="button"
              onClick={() => scrollToHomeSection('faq')}
              className={navLinkClass(false)}
            >
              FAQ
            </button>
          </nav>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onSelectAdmin}
              className="btn-press inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-zinc-200 bg-white hover:border-[#12489B]/50 hover:text-[#12489B] text-xs font-semibold text-slate-700 transition-colors whitespace-nowrap"
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

        {/* Tablet & Mobile Clean Quick Nav Bar */}
        <div className="lg:hidden border-t border-zinc-100 px-3 py-2 bg-white/95 overflow-x-auto">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-1.5 min-w-max text-xs font-semibold">
            <button
              type="button"
              onClick={onGoHome}
              className={`px-3 py-1.5 rounded-full transition-colors ${
                activeNav === 'home'
                  ? 'bg-[#0B2559] text-white'
                  : 'text-slate-600 hover:bg-zinc-100'
              }`}
            >
              Trang chủ
            </button>
            <button
              type="button"
              onClick={onOpenOrder}
              className={`px-3 py-1.5 rounded-full transition-colors ${
                activeNav === 'order'
                  ? 'bg-[#EA580C] text-white'
                  : 'text-slate-600 hover:bg-zinc-100'
              }`}
            >
              Đặt bài
            </button>
            <button
              type="button"
              onClick={onOpenLookup}
              className={`px-3 py-1.5 rounded-full transition-colors ${
                activeNav === 'lookup'
                  ? 'bg-[#0B2559] text-white'
                  : 'text-slate-600 hover:bg-zinc-100'
              }`}
            >
              Tra cứu đơn
            </button>
            <button
              type="button"
              onClick={onOpenChecker}
              className={`px-3 py-1.5 rounded-full transition-colors ${
                activeNav === 'checker'
                  ? 'bg-[#0B2559] text-white'
                  : 'text-slate-600 hover:bg-zinc-100'
              }`}
            >
              Check AI
            </button>
            <button
              type="button"
              onClick={onOpenSamples}
              className={`px-3 py-1.5 rounded-full transition-colors ${
                activeNav === 'samples'
                  ? 'bg-[#0B2559] text-white'
                  : 'text-slate-600 hover:bg-zinc-100'
              }`}
            >
              Bài mẫu
            </button>
            <button
              type="button"
              onClick={() => scrollToHomeSection('cam-ket')}
              className="px-3 py-1.5 rounded-full text-slate-600 hover:bg-zinc-100 transition-colors"
            >
              Gói cam kết
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
