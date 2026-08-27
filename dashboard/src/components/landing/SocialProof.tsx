'use client';

import { ShieldCheck, Lock, Code, EyeOff, Users, Zap, Globe } from 'lucide-react';

/**
 * SocialProof — replaces fictional testimonials with verifiable metrics.
 * No made-up names, no fake quotes. Just honest, auditable claims.
 */

const VERIFIABLE_CLAIMS = [
  {
    metric: '3s',
    label: 'GPS update intervals',
    detail: 'Accurate, street-level coordinates',
    icon: Zap,
  },
  {
    metric: 'Tamper-proof',
    label: 'evidence records',
    detail: 'Every photo and recording is verified and cannot be altered',
    icon: Lock,
  },
  {
    metric: '535',
    label: 'backend tests',
    detail: 'Automated tests covering every endpoint',
    icon: ShieldCheck,
  },
  {
    metric: 'BSL',
    label: 'source available',
    detail: 'Audit the code yourself — non-commercial use allowed',
    icon: Code,
  },
];

const ARCHITECTURE_FACTS = [
  {
    icon: Globe,
    title: 'Self-hostable',
    description: 'Run Magneetar on your own infrastructure. Docker Compose + Cloudflare Tunnel, one command to deploy.',
  },
  {
    icon: Users,
    title: 'Device sharing',
    description: 'Share devices with family or teammates. Role-based access: owner, admin, viewer.',
  },
  {
    icon: EyeOff,
    title: 'No data sales',
    description: 'We don\'t sell, share, or monetize your location data. Your data stays on your server.',
  },
];

export function SocialProof() {
  return (
    <section className="py-28 sm:py-36 bg-gray-950 relative overflow-hidden">
      <div className="relative max-w-6xl mx-auto px-5 sm:px-8">
        {/* Section header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 mb-5">
            <ShieldCheck size={10} className="text-emerald-400" />
            <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-emerald-400/80">WHY MAGNEETAR</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-4">
            Verifiable by design.
          </h2>
          <p className="text-gray-400 text-base max-w-lg mx-auto">
            Every claim on this page is auditable. Open the source code, check the API, verify the claims yourself.
          </p>
        </div>

        {/* Verifiable metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-14">
          {VERIFIABLE_CLAIMS.map((item) => (
            <div key={item.label} className="text-center py-6 rounded-xl bg-gradient-to-b from-white/[0.03] to-transparent border border-white/[0.04] hover:border-emerald-500/10 transition-all duration-300 group">
              <item.icon size={18} className="text-gray-500 mx-auto mb-3 group-hover:text-emerald-400/60 transition-colors" />
              <div className="text-2xl font-extrabold text-white font-mono tabular-nums">{item.metric}</div>
              <div className="text-[11px] font-mono text-gray-400 uppercase tracking-wider mt-1.5 font-semibold">{item.label}</div>
              <div className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">{item.detail}</div>
            </div>
          ))}
        </div>

        {/* Architecture facts */}
        <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {ARCHITECTURE_FACTS.map((fact) => (
            <div key={fact.title} className="flex items-start gap-4 rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-6 hover:border-emerald-500/15 transition-all duration-400 group">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/15 transition-all">
                <fact.icon size={16} className="text-emerald-400/70 group-hover:text-emerald-400 transition-colors" />
              </div>
              <div>
                <div className="text-white font-semibold text-sm">{fact.title}</div>
                <div className="text-[12.5px] text-gray-400 leading-relaxed mt-1">{fact.description}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Audit link */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 text-[11px] font-mono text-gray-600">
          <span>EVERY CLAIM IS AUDITABLE</span>
          <span className="w-1 h-1 rounded-full bg-emerald-500/30" />
          <a href="https://github.com/Oluwanifemi-engineer/magneetar" target="_blank" rel="noopener noreferrer" className="text-emerald-400/60 hover:text-emerald-400 transition-colors underline underline-offset-2">
            VIEW SOURCE CODE
          </a>
        </div>
      </div>
    </section>
  );
}
