'use client';

import { useRef, useState, MouseEvent, ReactNode } from 'react';

/**
 * TiltCard — 3D perspective tilt effect on mouse movement.
 * The card tilts toward the cursor with a glare highlight.
 * Pure CSS + vanilla JS, zero dependencies.
 * Inspired by Aceternity UI's 3D Card Effect.
 */
export function TiltCard({
  children,
  className = '',
  glareColor = 'rgba(255,255,255,0.06)',
  maxTilt = 8,
}: {
  children: ReactNode;
  className?: string;
  glareColor?: string;
  maxTilt?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });

  const handleMouseMove = (e: MouseEvent) => {
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    const tiltX = (0.5 - y) * maxTilt;
    const tiltY = (x - 0.5) * maxTilt;

    setStyle({
      transform: `perspective(800px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale3d(1.02, 1.02, 1.02)`,
    });

    setGlare({
      x: x * 100,
      y: y * 100,
      opacity: 0.15,
    });
  };

  const handleMouseLeave = () => {
    setStyle({
      transform: 'perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
      transition: 'transform 0.5s cubic-bezier(0.03, 0.98, 0.52, 0.99)',
    });
    setGlare({ x: 50, y: 50, opacity: 0 });
  };

  return (
    <div
      ref={ref}
      className={`tilt-card ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        ...style,
        transition: style.transition || 'transform 0.15s ease-out',
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Glare overlay */}
      <div
        className="tilt-card-glare"
        style={{
          background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, ${glareColor}, transparent 60%)`,
          opacity: glare.opacity,
        }}
      />

      {/* Content */}
      <div className="relative z-10">{children}</div>

      <style jsx>{`
        .tilt-card {
          position: relative;
          overflow: hidden;
          will-change: transform;
        }
        .tilt-card-glare {
          position: absolute;
          inset: 0;
          z-index: 20;
          pointer-events: none;
          transition: opacity 0.3s ease;
          border-radius: inherit;
        }
      `}</style>
    </div>
  );
}
