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
      ? 'w-12 h-12'
      : 'w-10 h-10';

  const textClass =
    size === 'md'
      ? 'text-lg font-bold tracking-tight'
      : 'text-base font-bold tracking-tight';

  return (
    <span className={`inline-flex items-center gap-2.5 shrink-0 ${className}`}>
      <img
        src="/assets/assigntrack-logo.png"
        alt="AssignTrack"
        className={`${iconBoxClass} object-contain shrink-0 drop-shadow-[0_1px_2px_rgba(15,23,42,0.12)]`}
      />
      {showWordmark && (
        <span className={`${textClass} whitespace-nowrap`}>
          <span className="text-[#0B2559]">Assign</span>
          <span className="text-[#D97706]">Track</span>
        </span>
      )}
    </span>
  );
}
