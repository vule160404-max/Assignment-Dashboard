import { useEffect, useState } from 'react';
import { getSchoolInitials } from '../../services/sampleLibraryService';

interface SampleUniversityBadgeProps {
  logoUrl?: string;
  schoolName: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<SampleUniversityBadgeProps['size']>, string> = {
  xs: 'w-9 h-9 rounded-lg p-1',
  sm: 'w-10 h-10 rounded-xl p-1.5',
  md: 'w-14 h-14 sm:w-16 sm:h-16 rounded-2xl p-2',
  lg: 'w-18 h-18 sm:w-20 sm:h-20 rounded-2xl p-2.5',
};

export function SampleUniversityBadge({
  logoUrl,
  schoolName,
  size = 'md',
  className = '',
}: SampleUniversityBadgeProps) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [logoUrl]);

  const showImage = Boolean(logoUrl) && !imgFailed;

  return (
    <div
      className={`shrink-0 bg-white border border-slate-200/80 flex items-center justify-center overflow-hidden select-none ${SIZE_CLASSES[size]} ${className}`}
      title={schoolName}
    >
      {showImage ? (
        <img
          src={logoUrl}
          alt={schoolName}
          loading="lazy"
          decoding="async"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-contain"
        />
      ) : (
        <span className="font-mono font-bold text-[#0B2559] text-[11px] tracking-tight text-center leading-none">
          {getSchoolInitials(schoolName)}
        </span>
      )}
    </div>
  );
}
