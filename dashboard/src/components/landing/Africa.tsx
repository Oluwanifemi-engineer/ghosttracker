'use client';

import { Smartphone, BellRing, BatteryCharging, FileCheck2, TrendingDown } from 'lucide-react';

const AFRICA_STATS = [
  {
    value: '25M+',
    label: 'phones stolen in Nigeria',
    detail: 'Recorded across a single 12-month period',
  },
  {
    value: '1.2s',
    label: 'between phone thefts',
    detail: 'One theft roughly every second — the most common crime',
  },
  {
    value: '11.7%',
    label: 'recovery rate',
    detail: 'Fewer than 1 in 8 thefts end in recovery',
  },
];

const AFRICA_POINTS = [
  {
    icon: BellRing,
    title: 'Alerts that reach you',
    description:
      'Multi-channel alerts tuned for Nigerian networks — SMS, WhatsApp, and push — so you know the moment something is wrong.',
  },
  {
    icon: BatteryCharging,
    title: 'Survives the phones people use',
    description:
      'OEM-aware persistence engineered for Huawei, Xiaomi, Oppo, Vivo, and Realme — the battery killers that end most trackers.',
  },
  {
    icon: FileCheck2,
    title: 'Evidence that holds up',
    description:
      'SHA-256-chained photo, audio, and location evidence, packaged into PDF reports ready for law enforcement.',
  },
];

export function Africa() {
  return (
    <section
      id="africa"
      className="relative py-24 sm:py-32 bg-gray-950 scroll-mt-20 overflow-hidden"
    >
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
        <div className="max-w-3xl mx-auto text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gray-700 bg-gray-800/50 mb-5">
            <TrendingDown size={10} className="text-red-400" />
            <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-gray-400">THE PROBLEM</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-extrabold tracking-tight text-white leading-tight">
            Built for <span className="text-emerald-400">Africa.</span>
          </h2>
          <p className="mt-5 text-gray-400 leading-relaxed">
            Phone theft is the most common crime in Nigeria — and fewer than 1 in 8 reported thefts ever
            end in recovery. Magneetar was designed to change that number.
          </p>
        </div>

        {/* Stats — dark cards with accent borders */}
        <div className="grid sm:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {AFRICA_STATS.map((stat) => (
            <div
              key={stat.label}
              className="relative rounded-2xl bg-white/[0.03] border border-white/[0.06] p-7 text-center hover:bg-white/[0.05] hover:border-white/[0.10] transition-all duration-300"
            >
              {/* Top accent line */}
              <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-red-500/40 to-transparent" />
              <div className="text-4xl sm:text-5xl font-extrabold font-mono tabular-nums text-white">
                {stat.value}
              </div>
              <div className="mt-3 text-gray-300 font-semibold text-sm leading-snug">{stat.label}</div>
              <div className="mt-2 text-[12px] leading-relaxed text-gray-500">{stat.detail}</div>
            </div>
          ))}
        </div>

        {/* Points — dark cards */}
        <div className="mt-14 grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {AFRICA_POINTS.map((point) => (
            <div
              key={point.title}
              className="flex items-start gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 hover:bg-white/[0.04] hover:border-white/[0.10] transition-all duration-300"
            >
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <point.icon size={16} className="text-emerald-400" />
              </div>
              <div>
                <div className="text-white font-semibold text-sm">{point.title}</div>
                <div className="text-[12.5px] text-gray-400 leading-relaxed mt-1">{point.description}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex items-center justify-center gap-2 text-[11px] font-mono text-gray-600">
          <Smartphone size={11} />
          <span>
            Source: National Bureau of Statistics — Crime Experience &amp; Security Perception Survey, 2024
          </span>
        </div>
      </div>
    </section>
  );
}
