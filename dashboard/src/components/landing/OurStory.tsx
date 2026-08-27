'use client';

import { Heart, MapPin, Shield, GraduationCap } from 'lucide-react';

/**
 * OurStory — the real reason Magneetar exists.
 * Written by the founder. Not a marketing team.
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
          I watched my classmates lose their phones
          <br />
          <span className="text-gray-500">and their connection to family.</span>
        </h2>

        <div className="mt-10 max-w-2xl mx-auto space-y-6 text-left">
          <p className="text-[15px] leading-relaxed text-gray-400">
            At Obafemi Awolowo University, your phone is your lifeline. It is how you talk to your
            parents. How you stay in touch with your siblings. How you feel close to home when you
            are hundreds of kilometres away. For many students, staying connected to family is what
            holds everything together.
          </p>

          <p className="text-[15px] leading-relaxed text-gray-400">
            Then one day, your phone is gone. Stolen at a bus stop, in the cafeteria, or from your
            hostel room. And you quickly learn the truth: Google Find My Device cannot help you. It
            does not work reliably on the phones most students actually use. Your only option is to
            pay someone ₦45,000 or more to try to recover it — and even then, there are no
            guarantees.
          </p>

          <p className="text-[15px] leading-relaxed text-gray-400">
            I saw this happen over and over. Students losing not just a device, but their connection
            to the people who matter most. And I realised this was not just an OAU problem — it is
            happening at every university in Nigeria, across Africa, to millions of students every
            year.
          </p>

          <p className="text-[15px] leading-relaxed text-gray-400">
            So as an Electronic and Electrical Engineering student, I decided to build the thing that
            should have existed already. A phone tracker that works on the phones students actually
            have — Huawei, Xiaomi, Oppo, Vivo, Realme. That works on MTN, Airtel, Glo, and 9mobile.
            That detects theft automatically, captures evidence, and lets you lock your phone remotely.
            And that survives every real-world scenario where other trackers fail.
          </p>

          <p className="text-[15px] leading-relaxed text-gray-300 font-medium">
            That is Magneetar. It is free for your first device. Because no student should lose
            their connection to family over a stolen phone.
          </p>
        </div>

        {/* Three pillars */}
        <div className="mt-14 grid sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
              <GraduationCap size={20} className="text-emerald-400/70" />
            </div>
            <div className="text-white font-semibold text-sm">Built by a student</div>
            <div className="text-[12px] text-gray-500 mt-1 leading-relaxed">
              An Electronic and Electrical Engineering student at OAU who lived the problem, not a
              team guessing from afar.
            </div>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
              <Shield size={20} className="text-emerald-400/70" />
            </div>
            <div className="text-white font-semibold text-sm">Built for real failure</div>
            <div className="text-[12px] text-gray-500 mt-1 leading-relaxed">
              Every scenario where other trackers fail — offline, battery saving, SIM change —
              Magneetar was designed to keep working.
            </div>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
              <Heart size={20} className="text-emerald-400/70" />
            </div>
            <div className="text-white font-semibold text-sm">Free to start</div>
            <div className="text-[12px] text-gray-500 mt-1 leading-relaxed">
              Protect your phone at no cost. Because every student deserves to stay connected to
              their family.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
