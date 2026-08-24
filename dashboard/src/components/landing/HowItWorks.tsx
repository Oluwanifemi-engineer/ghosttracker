'use client';

import Link from 'next/link';
import { Smartphone, Map, ShieldCheck, ArrowRight } from 'lucide-react';

const STEPS = [
  {
    icon: Smartphone,
    step: '01',
    title: 'Install & connect in minutes',
    description: (
      <>
        Download the APK from the{' '}
        <Link href="/download" className="text-emerald-400 font-semibold hover:underline transition-colors">
          official download page
        </Link>
        , sign in once, and grant permissions. Link your device to your account, then add family,
        coworkers, or your team — no configuration, no setup.
      </>
    ),
  },
  {
    icon: Map,
    step: '02',
    title: 'Stay in sync, always',
    description:
      'Live locations stream to your circles so everyone knows everyone is safe. And when a device moves, SIM-swaps, or drops battery — Sentinel scores it silently in real time.',
  },
  {
    icon: ShieldCheck,
    step: '03',
    title: 'Theft detected — recover it',
    description:
      'The moment theft is confirmed, Magneetar locks in: live tracking with a navigation route straight to the device, plus remote photo and audio capture for evidence.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-32 sm:py-40 bg-gray-950 scroll-mt-20">
      <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gray-700 bg-gray-800/50 mb-5">
            <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-gray-400">HOW IT WORKS</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-extrabold tracking-tight text-white">
            Connected in <span className="text-gray-500">three steps</span>
          </h2>
          <p className="mt-4 text-gray-400 leading-relaxed">
            From first launch to full recovery — Magneetar keeps your devices protected and your people close.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 relative">
          <div className="hidden md:block absolute top-16 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

          {STEPS.map((step, i) => (
            <div key={step.step} className="relative group">
              <div className="relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 h-full hover:bg-white/[0.04] hover:border-white/[0.10] transition-all duration-300 overflow-hidden">
                <div className="absolute top-5 right-6 text-[40px] font-mono font-bold text-white/[0.04] leading-none select-none group-hover:text-white/[0.06] transition-colors duration-300">
                  {step.step}
                </div>

                <div className="relative w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-6 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/20 transition-all duration-300">
                  <step.icon size={22} className="text-gray-400 group-hover:text-emerald-400 transition-colors duration-300" />
                </div>

                <h3 className="text-white font-bold text-lg tracking-tight">{step.title}</h3>
                <p className="mt-3 text-[13px] leading-relaxed text-gray-400">{step.description}</p>

                {i < STEPS.length - 1 && (
                  <ArrowRight
                    size={16}
                    className="hidden md:block absolute -right-[12px] top-1/2 -translate-y-1/2 text-white/[0.10] z-10"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
