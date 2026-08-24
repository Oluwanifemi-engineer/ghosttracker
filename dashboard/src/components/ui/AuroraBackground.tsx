'use client';

import { ReactNode } from 'react';

/**
 * AuroraBackground — flowing aurora gradient background.
 * Pure CSS animation, zero dependencies, zero bundle cost.
 * Inspired by Aceternity UI's Aurora Background but simplified for performance.
 */
export function AuroraBackground({
  children,
  className = '',
  colors = ['emerald', 'teal', 'cyan'],
}: {
  children: ReactNode;
  className?: string;
  colors?: string[];
}) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Aurora blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="aurora-blob aurora-blob-1"
          style={{
            background: `radial-gradient(ellipse at center, var(--aurora-color-1, rgba(16,185,129,0.15)) 0%, transparent 70%)`,
          }}
        />
        <div
          className="aurora-blob aurora-blob-2"
          style={{
            background: `radial-gradient(ellipse at center, var(--aurora-color-2, rgba(20,184,166,0.12)) 0%, transparent 70%)`,
          }}
        />
        <div
          className="aurora-blob aurora-blob-3"
          style={{
            background: `radial-gradient(ellipse at center, var(--aurora-color-3, rgba(6,182,212,0.10)) 0%, transparent 70%)`,
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10">{children}</div>

      <style jsx>{`
        .aurora-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          animation: aurora-drift 20s ease-in-out infinite alternate;
          will-change: transform;
        }
        .aurora-blob-1 {
          width: 600px;
          height: 600px;
          top: -200px;
          left: -100px;
          animation-duration: 18s;
        }
        .aurora-blob-2 {
          width: 500px;
          height: 500px;
          top: -100px;
          right: -150px;
          animation-duration: 22s;
          animation-delay: -5s;
        }
        .aurora-blob-3 {
          width: 400px;
          height: 400px;
          bottom: -150px;
          left: 30%;
          animation-duration: 25s;
          animation-delay: -10s;
        }
        @keyframes aurora-drift {
          0% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -20px) scale(1.05);
          }
          66% {
            transform: translate(-20px, 15px) scale(0.95);
          }
          100% {
            transform: translate(10px, -10px) scale(1.02);
          }
        }
      `}</style>
    </div>
  );
}
