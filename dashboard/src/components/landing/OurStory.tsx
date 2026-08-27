'use client';

import { Heart, MapPin, Shield } from 'lucide-react';

/**
 * OurStory — the human reason Magneetar exists.
 * No jargon. No metrics. Just honesty about why this was built.
 */

export function OurStory() {
  return (
    <section className="relative py-28 sm:py-36 overflow-hidden bg-gray-950">
      {/* Subtle warm glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-emerald-500/[0.02] rounded-full blur-[120px] pointer-events-none" />

      <div className="relative max-w-4xl mx-auto px-5 sm:px-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 mb-8">
          <Heart size={10} className="text-emerald-400" />
          <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-emerald-400/80">OUR STORY</span>
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
          Someone stole my phone.
          <br />
          <span className="text-gray-500">I decided no one else should feel this helpless.</span>
        </h2>

        <div className="mt-10 max-w-2xl mx-auto space-y-6 text-left">
          <p className="text-[15px] leading-relaxed text-gray-400">
            In Lagos, phone theft isn't just a crime — it's an everyday reality. 25 million phones
            are stolen every year. Most are never recovered. The few that are, it's because someone
            got lucky — not because the technology helped.
          </p>

          <p className="text-[15px] leading-relaxed text-gray-400">
            Google's Find My Device doesn't work on most budget Android phones. Samsung only works
            on Samsung. The free options are unreliable. The paid options are built for the US market
            and don't understand Nigerian networks, Nigerian phones, or Nigerian reality.
          </p>

          <p className="text-[15px] leading-relaxed text-gray-400">
            So I built Magneetar. A phone tracker that works on the phones people actually use —
            Huawei, Xiaomi, Oppo, Vivo, Realme — on the networks people actually have — MTN, Airtel,
            Glo, 9mobile. It runs silently in the background, detects theft automatically, captures
            evidence, and lets you lock your phone remotely.
          </p>

          <p className="text-[15px] leading-relaxed text-gray-300 font-medium">
            It's free for your first device. Because everyone deserves to protect what they own.
          </p>
        </div>

        {/* Three pillars */}
        <div className="mt-14 grid sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
              <MapPin size={20} className="text-emerald-400/70" />
            </div>
            <div className="text-white font-semibold text-sm">Built in Lagos</div>
            <div className="text-[12px] text-gray-500 mt-1 leading-relaxed">
              By someone who understands the problem firsthand — not a Silicon Valley team guessing at what Africa needs.
            </div>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
              <Shield size={20} className="text-emerald-400/70" />
            </div>
            <div className="text-white font-semibold text-sm">For the phones people use</div>
            <div className="text-[12px] text-gray-500 mt-1 leading-relaxed">
              Not just Samsung and iPhone. Works on Huawei, Xiaomi, Oppo, Vivo, Realme — the phones in most Nigerian hands.
            </div>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
              <Heart size={20} className="text-emerald-400/70" />
            </div>
            <div className="text-white font-semibold text-sm">Free to start</div>
            <div className="text-[12px] text-gray-500 mt-1 leading-relaxed">
              Protect your main phone at no cost. Upgrade when you want to protect your family or team.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
