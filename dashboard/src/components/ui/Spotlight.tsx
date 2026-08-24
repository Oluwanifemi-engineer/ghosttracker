'use client';

import { useRef, useState, MouseEvent, ReactNode } from 'react';

/**
 * Spotlight — cursor-following radial glow that illuminates content.
 * Pure CSS + vanilla JS, zero dependencies.
 * Inspired by Aceternity UI's Spotlight component.
 */
export function Spotlight({
  children,
  className = '',
  color = 'rgba(16,185,129,0.08)',
  size = 400,
}: {
  children: ReactNode;
  className?: string;
  color?: string;
  size?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: MouseEvent) => {
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setPos({ x, y });
    setOpacity(1);
  };

  const handleMouseLeave = () => {
    setOpacity(0);
  };

  return (
    <div
      ref={ref}
      className={`spotlight-container ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Spotlight glow */}
      <div
        className="spotlight-glow"
        style={{
          background: `radial-gradient(${size}px circle at ${pos.x}% ${pos.y}%, ${color}, transparent 60%)`,
          opacity,
        }}
      />

      {/* Content */}
      <div className="relative z-10">{children}</div>

      <style jsx>{`
        .spotlight-container {
          position: relative;
          overflow: hidden;
        }
        .spotlight-glow {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          transition: opacity 0.4s ease;
        }
      `}</style>
    </div>
  );
}
