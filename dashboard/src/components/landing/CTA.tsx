'use client';

import Link from 'next/link';
import { ArrowRight, ShieldCheck, Download, Check } from 'lucide-react';

export function CTA({ authed }: { authed: boolean }) {
  return (
    <section className="relative py-32 sm:py-40 bg-gray-950 overflow-hidden">
      {/* Background accent glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-emerald-500/[0.04] rounded-full blur-[120px]" />
      </div>

      <div className="relative max-w-5xl mx-auto px-5 sm:px-8 text-center">
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-display font-extrabold tracking-tight text-white leading-[1.05]">
          Never lose track of
          <br />
          <span className="text-gray-500">what — or who — matters.</span>
        </h2>
        <p className="mt-6 text-lg text-gray-400 leading-relaxed max-w-xl mx-auto">
          Create your account, install the app, protect every device you own, and keep your people
          close — all within minutes.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          {authed ? (
            <Link href="/dashboard" className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl text-[13px] font-bold uppercase tracking-wider bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 hover:shadow-emerald-500/30 transition-all duration-200 active:scale-[0.97]">
              <ShieldCheck size={16} />
              Open Command Center
              <ArrowRight size={15} />
            </Link>
          ) : (
            <Link href="/signup" className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl text-[13px] font-bold uppercase tracking-wider bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 hover:shadow-emerald-500/30 transition-all duration-200 active:scale-[0.97]">
              Get Started Free
              <ArrowRight size={15} />
            </Link>
          )}
          <Link href="/login" className="inline-flex items-center gap-2 px-7 py-4 rounded-2xl text-[13px] font-bold uppercase tracking-wider border border-white/10 text-gray-400 hover:bg-white/5 hover:border-white/20 hover:text-white transition-all duration-200">
            I have an account
          </Link>
          <Link href="/download" className="inline-flex items-center gap-2 px-7 py-4 rounded-2xl text-[13px] font-bold uppercase tracking-wider border border-white/10 text-gray-400 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all duration-200">
            <Download size={15} />
            Download APK
          </Link>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2">
          <Check size={14} className="text-emerald-400" />
          <span className="text-[12px] font-mono font-medium tracking-wide text-gray-500">
            Free for 1 device · No credit card required
          </span>
        </div>
      </div>
    </section>
  );
}
