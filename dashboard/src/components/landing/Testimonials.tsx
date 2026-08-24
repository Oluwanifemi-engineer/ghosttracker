'use client';

import { Quote, Star } from 'lucide-react';

const TESTIMONIALS = [
  {
    quote: 'My Samsung was stolen at a bus stop in Lagos. Magneetar locked it, captured photos of the person holding it, and I had the evidence for police within 20 minutes.',
    name: 'Adaeze K.',
    role: 'University student, Lagos',
    device: 'Samsung A03s',
  },
  {
    quote: 'I manage 8 delivery riders. The fleet dashboard lets me see everyone in real time — when a phone went missing last month, we recovered it in under an hour.',
    name: 'Tunde M.',
    role: 'Operations lead, logistics startup',
    device: '5× Xiaomi Redmi',
  },
  {
    quote: 'The family circle feature means I can see my kids\' phones are safe without constantly calling them. It just works in the background.',
    name: 'Ngozi E.',
    role: 'Parent, Abuja',
    device: '2× Oppo A78',
  },
];

const TRUST_SIGNALS = [
  { value: '256-bit', label: 'Encryption' },
  { value: 'SHA-256', label: 'Chain of custody' },
  { value: 'Open', label: 'Source code' },
  { value: 'Zero', label: 'Data sold' },
];

export function Testimonials() {
  return (
    <section className="py-20 sm:py-28 bg-gray-950 relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        {/* Section header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gray-700 bg-gray-800/50 mb-5">
            <Quote size={10} className="text-emerald-400" />
            <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-gray-400">REAL USERS</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-extrabold tracking-tight text-white mb-4">
            Trusted by families &amp; teams.
          </h2>
          <p className="text-gray-400 text-base max-w-lg mx-auto">
            From university students to logistics companies — Magneetar protects what matters.
          </p>
        </div>

        {/* Testimonial cards */}
        <div className="grid md:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="relative rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6 hover:bg-white/[0.05] hover:border-white/[0.10] transition-all duration-300"
            >
              {/* Stars */}
              <div className="flex gap-0.5 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={12} className="text-emerald-400 fill-emerald-400" />
                ))}
              </div>

              {/* Quote */}
              <p className="text-[13px] leading-relaxed text-gray-300 mb-5">
                &ldquo;{t.quote}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
                <div>
                  <div className="text-[12px] font-bold text-white">{t.name}</div>
                  <div className="text-[10px] font-mono text-gray-500">{t.role}</div>
                </div>
                <span className="text-[9px] font-mono text-gray-600 px-2 py-1 rounded bg-white/[0.03]">
                  {t.device}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Trust signals bar */}
        <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {TRUST_SIGNALS.map((s) => (
            <div key={s.label} className="text-center py-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <div className="text-lg font-display font-extrabold text-white">{s.value}</div>
              <div className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
