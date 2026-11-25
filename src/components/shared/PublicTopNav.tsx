import { ArrowUpRight, BookOpen, LogIn, ShieldCheck } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

export type PublicNavKey = 'home' | 'lookup' | 'order' | 'checker' | 'samples';

interface PublicTopNavProps {
  activeNav: PublicNavKey;
  onGoHome: () => void;
  onOpenOrder: () => void;
  onOpenLookup: () => void;
  onOpenChecker: () => void;
  onOpenSamples: () => void;
  onSelectAdmin: () => void;
}

function scrollToHomeSection(sectionId: string, onGoHome: () => void, isHome: boolean) {
  const hashUrl = `/#${sectionId}`;
  if (!isHome) {
    onGoHome();
    window.setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.history.replaceState({}, '', hashUrl);
    }, 120);
    return;
  }
  document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.history.replaceState({}, '', hashUrl);
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
  const isHome = activeNav === 'home';

  const navLinkClass = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
      active
        ? 'text-[#0B2559] font-semibold bg-slate-100/90'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
    }`;

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200/75">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onGoHome}
          className="text-left focus:outline-none shrink-0 cursor-pointer"
          aria-label="AssignTrack Trang chủ"
        >
          <BrandLogo size="sm" />
        </button>

        {/* Center Minimalist Nav */}
        <nav
          aria-label="Điều hướng chính"
          className="hidden lg:flex items-center gap-1"
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
            onClick={() => scrollToHomeSection('quy-trinh', onGoHome, isHome)}
            className={navLinkClass(false)}
          >
            Quy trình
          </button>
          <button
            type="button"
            onClick={() => scrollToHomeSection('cam-ket', onGoHome, isHome)}
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
            className={`px-3 py-1.5 rounded-lg text-[13px] whitespace-nowrap transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
              activeNav === 'checker'
                ? 'bg-[#0B2559] text-white font-semibold'
                : 'text-slate-600 font-medium hover:text-[#12489B] hover:bg-blue-50/70'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#12489B]" />
            <span>Check AI Free</span>
          </button>
          <button
            type="button"
            onClick={onOpenSamples}
            className={`px-3 py-1.5 rounded-lg text-[13px] whitespace-nowrap transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
              activeNav === 'samples'
                ? 'bg-[#0B2559] text-white font-semibold'
                : 'text-slate-600 font-medium hover:text-[#12489B] hover:bg-blue-50/70'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-[#12489B]" />
            <span>Bài mẫu</span>
          </button>
          <button
            type="button"
            onClick={() => scrollToHomeSection('faq', onGoHome, isHome)}
            className={navLinkClass(false)}
          >
            FAQ
          </button>
        </nav>

        {/* Clean Right Action Pair (Jenni style) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onSelectAdmin}
            className="btn-press hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5 text-slate-500" />
            <span>Đăng nhập</span>
          </button>

          <button
            type="button"
            onClick={onOpenOrder}
            className={`btn-press inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shadow-[0_1px_2px_rgba(11,37,89,0.12)] transition-colors cursor-pointer ${
              activeNav === 'order'
                ? 'bg-[#12489B] text-white'
                : 'bg-[#0B2559] hover:bg-[#12489B] text-white'
            }`}
          >
            <span>Đặt bài ngay</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Compact Mobile Bar */}
      <div className="lg:hidden border-t border-slate-100 bg-white/95">
        <div className="max-w-7xl mx-auto px-3 py-2 flex items-center gap-1 overflow-x-auto no-scrollbar text-[11.5px] font-medium whitespace-nowrap">
          <button
            type="button"
            onClick={onGoHome}
            className={`shrink-0 px-2.5 py-1.5 rounded-lg transition-colors ${
              activeNav === 'home' ? 'bg-[#0B2559] text-white font-semibold' : 'text-slate-600'
            }`}
          >
            Trang chủ
          </button>
          <button
            type="button"
            onClick={onOpenLookup}
            className={`shrink-0 px-2.5 py-1.5 rounded-lg transition-colors ${
              activeNav === 'lookup' ? 'bg-[#0B2559] text-white font-semibold' : 'text-slate-600'
            }`}
          >
            Tra cứu
          </button>
          <button
            type="button"
            onClick={onOpenChecker}
            className={`shrink-0 px-2.5 py-1.5 rounded-lg transition-colors ${
              activeNav === 'checker' ? 'bg-[#0B2559] text-white font-semibold' : 'text-slate-600'
            }`}
          >
            Check AI
          </button>
          <button
            type="button"
            onClick={onOpenSamples}
            className={`shrink-0 px-2.5 py-1.5 rounded-lg transition-colors ${
              activeNav === 'samples' ? 'bg-[#0B2559] text-white font-semibold' : 'text-slate-600'
            }`}
          >
            Bài mẫu
          </button>
          <button
            type="button"
            onClick={() => scrollToHomeSection('cam-ket', onGoHome, isHome)}
            className="shrink-0 px-2.5 py-1.5 rounded-lg text-slate-600"
          >
            Cam kết
          </button>
          <button
            type="button"
            onClick={onSelectAdmin}
            className="sm:hidden shrink-0 px-2.5 py-1.5 rounded-lg text-slate-600"
          >
            Đăng nhập
          </button>
        </div>
      </div>
    </header>
  );
}
