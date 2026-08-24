'use client';

import { useRef, useState, MouseEvent, ReactNode } from 'react';

/**
 * MagneticButton — button that subtly drifts toward the cursor on hover,
 * with a spring-based return when the cursor leaves.
 * Pure CSS + vanilla JS, zero dependencies.
 * Inspired by Acetenity UI's Magnetic Button.
 */
export function MagneticButton({
  children,
  className = '',
  strength = 0.3,
  as: Tag = 'button',
  href,
  ...props
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
  as?: 'button' | 'a';
  href?: string;
  [key: string]: any;
}) {
  const ref = useRef<any>(null);
  const [transform, setTransform] = useState('translate(0, 0)');

  const handleMouseMove = (e: MouseEvent) => {
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    setTransform(`translate(${x * strength}px, ${y * strength}px)`);
  };

  const handleMouseLeave = () => {
    setTransform('translate(0, 0)');
  };

  return (
    // @ts-ignore — dynamic tag
    <Tag
      ref={ref}
      className={`magnetic-btn ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ transform, transition: 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)' }}
      href={href}
      {...props}
    >
      <span className="magnetic-btn-inner" style={{ transform: `translate(${-parseFloat(transform.match(/translate\((.+)px/)?.[1] || '0') * 0.15}px, ${-parseFloat(transform.match(/,\s*(.+)px\)/)?.[1] || '0') * 0.15}px)` }}>
        {children}
      </span>

      <style jsx>{`
        .magnetic-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          will-change: transform;
        }
        .magnetic-btn-inner {
          display: inline-flex;
          align-items: center;
          gap: 0.625rem;
          will-change: transform;
          transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
      `}</style>
    </Tag>
  );
}
