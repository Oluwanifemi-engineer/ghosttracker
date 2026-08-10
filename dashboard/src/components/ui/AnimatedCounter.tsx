'use client';

import { useEffect, useRef, useState } from 'react';
import { useScrollReveal } from '@/hooks/useScrollReveal';

interface AnimatedCounterProps {
  value: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  className?: string;
}

export function AnimatedCounter({
  value,
  suffix = '',
  prefix = '',
  duration = 2000,
  className = '',
}: AnimatedCounterProps) {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.5 });
  const [count, setCount] = useState(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!isVisible || hasAnimated.current) return;

    hasAnimated.current = true;
    const startTime = Date.now();
    const startValue = 0;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out cubic)
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (value - startValue) * eased);

      setCount(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [isVisible, value, duration]);

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {prefix}{count.toLocaleString()}{suffix}
    </span>
  );
}

// Stats section with animated counters
interface StatItem {
  value: number;
  suffix?: string;
  prefix?: string;
  label: string;
}

interface AnimatedStatsProps {
  stats: StatItem[];
  className?: string;
}

export function AnimatedStats({ stats, className = '' }: AnimatedStatsProps) {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-4 gap-6 ${className}`}>
      {stats.map((stat, index) => (
        <div key={stat.label} className="text-center">
          <AnimatedCounter
            value={stat.value}
            suffix={stat.suffix}
            prefix={stat.prefix}
            className="text-3xl sm:text-4xl font-extrabold font-mono text-white"
          />
          <div className="text-[10px] font-mono text-white/50 uppercase tracking-wider mt-2 font-semibold">
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  );
}
