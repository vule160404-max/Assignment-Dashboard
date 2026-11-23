import { useEffect, useRef, useState } from 'react';

/**
 * GPU-composited ambient motion backdrop for the Royal Navy Hero section.
 * Combines a seamlessly drifting 48px blueprint grid, 3 slow-breathing aurora orbs,
 * and 2 fine horizontal light-beam sweeps. Automatically pauses off-screen via
 * IntersectionObserver to keep GPU usage at zero while scrolling lower sections.
 */
export function HeroAmbientBackground() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        setInView(entries.some((e) => e.isIntersecting));
      },
      { threshold: 0.02 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${
        inView ? '' : 'hero-ambient-paused'
      }`}
    >
      {/* Layer 1: Seamlessly Drifting Architectural Blueprint Grid (48px x 48px tile) */}
      <div
        className="hero-grid-drift absolute -inset-12 opacity-[0.11]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #93C5FD 1px, transparent 1px), linear-gradient(to bottom, #93C5FD 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Layer 2: Soft Drifting Luminous Aurora Orbs */}
      <div
        className="hero-orb-1 absolute -top-28 left-1/2 w-[760px] h-[400px] rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(circle, rgba(56,189,248,0.24) 0%, rgba(18,72,155,0.12) 55%, transparent 75%)',
        }}
      />
      <div
        className="hero-orb-2 absolute -bottom-32 -right-24 w-[520px] h-[520px] rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(circle, rgba(59,130,246,0.22) 0%, rgba(11,37,89,0.08) 60%, transparent 75%)',
        }}
      />
      <div
        className="hero-orb-3 absolute top-1/3 -left-28 w-[420px] h-[420px] rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(circle, rgba(245,158,11,0.13) 0%, rgba(56,189,248,0.08) 55%, transparent 75%)',
        }}
      />

      {/* Layer 3: Subtle Horizontal Blueprint Shimmer Light Beams */}
      <div
        className="hero-beam-1 absolute top-[28%] left-0 w-[42%] h-[1px]"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(125,211,252,0.75) 50%, transparent 100%)',
          boxShadow: '0 0 12px rgba(125,211,252,0.45)',
        }}
      />
      <div
        className="hero-beam-2 absolute top-[66%] left-0 w-[36%] h-[1px]"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(147,197,253,0.65) 50%, transparent 100%)',
          boxShadow: '0 0 10px rgba(147,197,253,0.35)',
        }}
      />

      {/* Soft Vignette Edge for Crisp Text Contrast */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 35%, transparent 45%, rgba(7,26,66,0.55) 100%)',
        }}
      />
    </div>
  );
}
