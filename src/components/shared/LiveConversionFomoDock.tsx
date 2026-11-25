import { useEffect, useState } from 'react';
import { CheckCircle2, Flame, ShieldCheck, X } from 'lucide-react';

interface FomoActivityItem {
  uni: string;
  action: string;
  subject: string;
  timeAgo: string;
  badge: string;
}

const FOMO_ACTIVITIES: FomoActivityItem[] = [
  {
    uni: 'SV ĐH RMIT Việt Nam',
    action: 'vừa đặt gói High Distinction · 2,500 từ',
    subject: 'Strategic Management (Case Study)',
    timeAgo: '4 phút trước',
    badge: 'Đã đăng ký',
  },
  {
    uni: 'SV ĐH Kinh tế TP.HCM (UEH)',
    action: 'vừa nhận bản Final + Báo cáo Turnitin 4%',
    subject: 'Khóa luận Định lượng SPSS & Hồi quy OLS',
    timeAgo: '8 phút trước',
    badge: 'Turnitin 4%',
  },
  {
    uni: 'SV Swinburne Vietnam',
    action: 'vừa đăng ký gói cứu gấp 24h · 1,800 từ',
    subject: 'Digital Marketing & Consumer Behavior',
    timeAgo: '11 phút trước',
    badge: 'Cứu gấp 24h',
  },
  {
    uni: 'SV ĐH Kinh tế Quốc dân (NEU)',
    action: 'vừa đặt gói Luận văn Thạc sĩ + Chạy dữ liệu',
    subject: 'Quản trị Kinh doanh Quốc tế (APA 7th)',
    timeAgo: '15 phút trước',
    badge: 'Gói Toàn diện',
  },
  {
    uni: 'SV Monash University (Melbourne)',
    action: 'vừa tất toán & tải file Word chuẩn Rubric',
    subject: 'Corporate Finance & Risk Analysis (3,000w)',
    timeAgo: '19 phút trước',
    badge: 'Điểm HD',
  },
  {
    uni: 'SV ĐH Ngoại thương (FTU)',
    action: 'vừa đặt gói Giảm AI & Turnitin dưới 10%',
    subject: 'International Supply Chain & Logistics',
    timeAgo: '23 phút trước',
    badge: 'AI 0%',
  },
];

interface LiveConversionFomoDockProps {
  onOrderNow: () => void;
}

export function LiveConversionFomoDock({
  onOrderNow,
}: LiveConversionFomoDockProps) {
  const [dismissed, setDismissed] = useState(false);
  const [scrolledEnough, setScrolledEnough] = useState(false);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const docHeight = document.documentElement.scrollHeight;
      const nearFooter = y + window.innerHeight >= docHeight - 240;
      setScrolledEnough(y > 320 && !nearFooter);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (dismissed) return;
    const cycleTimer = window.setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIndex((prev) => (prev + 1) % FOMO_ACTIVITIES.length);
        setVisible(true);
      }, 450);
    }, 11500);

    return () => window.clearInterval(cycleTimer);
  }, [dismissed]);

  if (dismissed || !scrolledEnough) return null;

  const item = FOMO_ACTIVITIES[index];

  return (
    <div
      className={`hidden md:block fixed bottom-4 left-4 z-40 max-w-[330px] transition-all duration-300 ${
        visible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-3 pointer-events-none'
      }`}
    >
      <div className="relative rounded-2xl bg-white/95 backdrop-blur-md border border-blue-200/90 p-3.5 shadow-[0_14px_34px_rgba(11,37,89,0.16)] flex items-start gap-3">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Ẩn thông báo hoạt động"
          className="absolute top-2 right-2 p-1 rounded-lg text-zinc-400 hover:text-slate-700 hover:bg-zinc-100"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0B2559] to-[#12489B] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
          <ShieldCheck className="w-4 h-4 text-sky-300" />
        </div>

        <div className="min-w-0 flex-1 pr-4 space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
              <CheckCircle2 className="w-2.5 h-2.5" />
              {item.badge}
            </span>
            <span className="text-[10.5px] text-zinc-400 font-medium">
              · {item.timeAgo}
            </span>
          </div>

          <p className="text-xs text-slate-800 leading-snug">
            <strong className="text-[#0B2559]">{item.uni}</strong> {item.action}
          </p>

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="text-[11px] font-medium text-zinc-500 truncate">
              Môn: {item.subject}
            </span>
            <button
              type="button"
              onClick={onOrderNow}
              className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-[#EA580C] hover:underline"
            >
              <Flame className="w-3 h-3" />
              <span>Đặt bài</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
