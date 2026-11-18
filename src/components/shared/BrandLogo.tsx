interface BrandLogoProps {
  size?: 'sm' | 'md';
  showWordmark?: boolean;
  className?: string;
}

export function BrandLogo({
  size = 'sm',
  showWordmark = true,
  className = '',
}: BrandLogoProps) {
  const iconBoxClass =
    size === 'md'
      ? 'w-10 h-10 rounded-xl'
      : 'w-8 h-8 rounded-lg';

  const textClass =
    size === 'md'
      ? 'text-lg font-bold tracking-tight'
      : 'text-base font-bold tracking-tight';

  return (
    <span className={`inline-flex items-center gap-2.5 shrink-0 ${className}`}>
      <img
        src="/assets/aistudio/image_2f6c660b.png"
        alt="AssignTrack"
        className={`${iconBoxClass} object-cover object-center shrink-0 ring-1 ring-slate-900/10 shadow-xs`}
      />
      {showWordmark && (
        <span className={`${textClass} whitespace-nowrap`}>
          <span className="text-[#0F172A]">Assign</span>
          <span className="text-[#10B981]">Track</span>
        </span>
      )}
    </span>
  );
}
