import { useEffect, useState } from 'react';
import { ChevronUp } from 'lucide-react';

const ZALO_URL = 'https://zalo.me/0916045202';
const MESSENGER_URL = 'https://www.facebook.com/messages/t/61596358456580';

export function FloatingSupportDock() {
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 280);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div
      className="fixed right-3 sm:right-5 bottom-5 sm:bottom-7 z-[90] flex flex-col items-center gap-3 select-none"
      aria-label="Kênh liên hệ hỗ trợ trực tuyến"
    >
      {/* ZALO FLOATING BUTTON */}
      <a
        href={ZALO_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat Zalo hỗ trợ 0916045202"
        title="Chat Zalo: 0916.045.202"
        className="group relative flex items-center justify-center"
      >
        {/* Hover Label Pill */}
        <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-full bg-[#0B2559] px-3.5 py-1.5 text-xs font-bold text-white shadow-lg opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 border border-sky-300/30">
          Chat Zalo · 0916.045.202
        </span>

        {/* Outer Translucent Halo Ring */}
        <span className="support-halo-pulse w-15 h-15 sm:w-16 sm:h-16 rounded-full bg-[#12489B]/18 group-hover:bg-[#12489B]/28 flex items-center justify-center transition-colors duration-200 shadow-[0_6px_20px_rgba(11,37,89,0.16)]">
          {/* Inner Core Circle */}
          <span className="w-11 h-11 sm:w-11.5 sm:h-11.5 rounded-full bg-gradient-to-b from-[#12489B] to-[#0B2559] group-hover:scale-105 text-white flex items-center justify-center shadow-md border border-white/25 transition-transform duration-200">
            <span className="text-[13px] font-black tracking-tight leading-none font-sans">
              Zalo
            </span>
          </span>
        </span>
      </a>

      {/* MESSENGER FLOATING BUTTON */}
      <a
        href={MESSENGER_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat Facebook Messenger hỗ trợ"
        title="Chat Messenger hỗ trợ 24/7"
        className="group relative flex items-center justify-center"
      >
        {/* Hover Label Pill */}
        <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-full bg-[#0B2559] px-3.5 py-1.5 text-xs font-bold text-white shadow-lg opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 border border-sky-300/30">
          Chat Messenger 24/7
        </span>

        {/* Outer Translucent Halo Ring */}
        <span className="support-halo-pulse w-15 h-15 sm:w-16 sm:h-16 rounded-full bg-[#12489B]/18 group-hover:bg-[#12489B]/28 flex items-center justify-center transition-colors duration-200 shadow-[0_6px_20px_rgba(11,37,89,0.16)]">
          {/* Inner Core Circle */}
          <span className="w-11 h-11 sm:w-11.5 sm:h-11.5 rounded-full bg-gradient-to-b from-[#12489B] to-[#0B2559] group-hover:scale-105 text-white flex items-center justify-center shadow-md border border-white/25 transition-transform duration-200">
            {/* Messenger Bubble + Lightning SVG */}
            <svg
              viewBox="0 0 24 24"
              className="w-5.5 h-5.5 fill-current"
              aria-hidden="true"
            >
              <path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.912 1.447 5.51 3.713 7.206V22l3.395-1.863c.907.252 1.87.388 2.892.388 5.523 0 10-4.145 10-9.243C22 6.145 17.523 2 12 2zm1.007 12.444l-2.548-2.718-4.97 2.718 5.467-5.803 2.61 2.718 4.908-2.718-5.467 5.803z" />
            </svg>
          </span>
        </span>
      </a>

      {/* SCROLL TO TOP BUTTON */}
      {showScrollTop && (
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Cuộn lên đầu trang"
          title="Lên đầu trang"
          className="mt-1 w-11 h-11 rounded-full bg-gradient-to-b from-[#12489B] to-[#0B2559] hover:from-[#1657BA] hover:to-[#0B2559] text-white shadow-lg border border-white/25 flex items-center justify-center transition-transform duration-200 hover:scale-105 cursor-pointer"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
