import { useEffect, useRef, useState } from 'react';

const DEPTH_PARTICLES = [
  { left: '14%', top: '68%', size: 5, delay: '0s', duration: '5.8s' },
  { left: '28%', top: '42%', size: 4, delay: '1.4s', duration: '6.8s' },
  { left: '46%', top: '76%', size: 6, delay: '0.6s', duration: '6.2s' },
  { left: '64%', top: '34%', size: 4, delay: '2.2s', duration: '7.2s' },
  { left: '78%', top: '64%', size: 5, delay: '1.0s', duration: '5.5s' },
  { left: '88%', top: '46%', size: 4, delay: '2.8s', duration: '6.6s' },
];

/**
 * Multi-plane GPU-composited ambient motion backdrop for the Royal Navy Hero.
 * Features a radial depth stage, dual-layer parallax blueprint grids (96px deep +
 * 48px foreground), 3 luminous aurora orbs, horizontal + vertical light beams,
 * and rising micro-particles. Pauses off-screen via IntersectionObserver.
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
      {/* Layer 0: Deep Spatial Radial Stage Gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 85% 70% at 50% 25%, #123B82 0%, #0B2559 52%, #061433 100%)',
        }}
      />

      {/* Layer 1A (Far Plane): Slower 96px Parallax Blueprint Grid */}
      <div
        className="hero-grid-drift-deep absolute -inset-24 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #60A5FA 1px, transparent 1px), linear-gradient(to bottom, #60A5FA 1px, transparent 1px)',
          backgroundSize: '96px 96px',
        }}
      />

      {/* Layer 1B (Near Plane): Faster 48px Crisp Blueprint Grid */}
      <div
        className="hero-grid-drift absolute -inset-12 opacity-[0.13]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #93C5FD 1px, transparent 1px), linear-gradient(to bottom, #93C5FD 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Layer 2: Subtle Concentric Horizon Depth Rings behind Headline */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[920px] h-[920px] rounded-full border border-sky-300/[0.06]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[620px] h-[620px] rounded-full border border-sky-300/[0.09]" />

      {/* Layer 3: Faster, Richer Luminous Aurora Orbs */}
      <div
        className="hero-orb-1 absolute -top-28 left-1/2 w-[820px] h-[440px] rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(circle, rgba(56,189,248,0.34) 0%, rgba(29,78,216,0.18) 52%, transparent 74%)',
        }}
      />
      <div
        className="hero-orb-2 absolute -bottom-36 -right-24 w-[580px] h-[580px] rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(circle, rgba(59,130,246,0.32) 0%, rgba(14,165,233,0.14) 55%, transparent 74%)',
        }}
      />
      <div
        className="hero-orb-3 absolute top-1/4 -left-28 w-[480px] h-[480px] rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(circle, rgba(245,158,11,0.18) 0%, rgba(56,189,248,0.12) 55%, transparent 75%)',
        }}
      />

      {/* Layer 4: Multi-Axis Blueprint Shimmer Light Beams (Horizontal + Vertical) */}
      <div
        className="hero-beam-1 absolute top-[26%] left-0 w-[45%] h-[1.5px]"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(125,211,252,0.9) 50%, transparent 100%)',
          boxShadow: '0 0 16px rgba(125,211,252,0.65)',
        }}
      />
      <div
        className="hero-beam-2 absolute top-[64%] left-0 w-[38%] h-[1.5px]"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(251,191,36,0.65) 50%, transparent 100%)',
          boxShadow: '0 0 14px rgba(251,191,36,0.4)',
        }}
      />
      <div
        className="hero-beam-v absolute top-0 left-[22%] w-[1.5px] h-[42%]"
        style={{
          background:
            'linear-gradient(180deg, transparent 0%, rgba(125,211,252,0.8) 50%, transparent 100%)',
          boxShadow: '0 0 14px rgba(125,211,252,0.55)',
        }}
      />

      {/* Layer 5: Rising Luminous Depth Micro-Particles */}
      {DEPTH_PARTICLES.map((p, idx) => (
        <span
          key={idx}
          className="hero-particle absolute rounded-full bg-sky-200"
          style={{
            left: p.left,
            top: p.top,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDelay: p.delay,
            animationDuration: p.duration,
            boxShadow: '0 0 12px rgba(125,211,252,0.85)',
          }}
        />
      ))}

      {/* Layer 6: Deep Atmospheric Vignette for Executive Contrast */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 38%, transparent 38%, rgba(5,16,42,0.68) 100%)',
        }}
      />
    </div>
  );
}
