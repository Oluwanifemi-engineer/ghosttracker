'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * BlurText — text that fades in letter-by-letter with a blur-to-focus effect.
 * Pure CSS animations, zero dependencies beyond React.
 * Inspired by React Bits' BlurText but simplified for zero bundle cost.
 */
export function BlurText({
  text,
  className = '',
  delay = 0,
  staggerDelay = 30,
  as: Tag = 'span',
}: {
  text: string;
  className?: string;
  delay?: number;
  staggerDelay?: number;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'span' | 'p';
}) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // IntersectionObserver not available in jsdom/test environments
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), delay);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <Tag ref={ref as any} className={`blur-text-container ${className}`}>
      {text.split('').map((char, i) => (
        <span
          key={i}
          className={`blur-text-char ${isVisible ? 'blur-text-visible' : ''}`}
          style={{
            animationDelay: `${i * staggerDelay}ms`,
            display: char === ' ' ? 'inline' : 'inline-block',
          }}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}

      <style jsx>{`
        .blur-text-container {
          display: inline;
        }
        .blur-text-char {
          display: inline-block;
          opacity: 0;
          filter: blur(8px);
          transform: translateY(4px);
          transition: none;
        }
        .blur-text-visible {
          animation: blur-text-reveal 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes blur-text-reveal {
          0% {
            opacity: 0;
            filter: blur(8px);
            transform: translateY(4px);
          }
          100% {
            opacity: 1;
            filter: blur(0);
            transform: translateY(0);
          }
        }
      `}</style>
    </Tag>
  );
}
