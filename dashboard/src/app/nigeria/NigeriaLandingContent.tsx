"use client";

import { useState } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Phone,
  MapPin,
  Users,
  Search,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Download,
  Star,
  Zap,
  Lock,
  Eye,
  TrendingDown,
  TrendingUp,
  Clock,
  Wallet,
  Globe,
  Smartphone,
} from "lucide-react";

const STATS = [
  { value: "25M", label: "Phones stolen per year", icon: AlertTriangle, color: "text-red-400" },
  { value: "69K", label: "Thefts per day", icon: Clock, color: "text-amber-400" },
  { value: "<5%", label: "Recovery rate", icon: TrendingDown, color: "text-red-400" },
  { value: "172M", label: "Phone subscriptions", icon: Smartphone, color: "text-emerald-400" },
];

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Trust Score",
    description: "Check any phone's IMEI before buying. See if it's stolen, verified, or suspicious.",
    cta: "Try Free IMEI Check",
    href: "/trust",
    color: "from-emerald-500 to-teal-600",
  },
  {
    icon: MapPin,
    title: "Real-Time Tracking",
    description: "3-second GPS updates. Find your phone the moment it's lost.",
    cta: "Learn More",
    href: "/#features",
    color: "from-blue-500 to-indigo-600",
  },
  {
    icon: Users,
    title: "Community Recovery",
    description: "Post a bounty. Nearby Magneetar users help find your phone.",
    cta: "See How It Works",
    href: "/#features",
    color: "from-purple-500 to-pink-600",
  },
  {
    icon: Lock,
    title: "Panic Button",
    description: "One tap sends SOS to family, captures evidence, shares location.",
    cta: "Learn More",
    href: "/#features",
    color: "from-red-500 to-rose-600",
  },
];

const COMPARISON = [
  { feature: "Free Trust Score (IMEI Check)", magneetar: true, others: false },
  { feature: "Community Recovery Bounties", magneetar: true, others: false },
  { feature: "3-Second GPS Tracking", magneetar: true, others: false },
  { feature: "Family Safety Circles", magneetar: true, others: false },
  { feature: "Panic Button / SOS", magneetar: true, others: false },
  { feature: "Smart AI Geofencing", magneetar: true, others: false },
  { feature: "Evidence PDF for Police", magneetar: true, others: false },
  { feature: "Naira Pricing", magneetar: true, others: false },
  { feature: "SMS Commands (Low Data)", magneetar: true, others: false },
];

const TESTIMONIALS = [
  {
    name: "Chidi O.",
    location: "Lagos",
    text: "I was about to buy a used Samsung from Computer Village. Magneetar's Trust Score showed it was reported stolen. Saved me ₦150,000!",
    rating: 5,
  },
  {
    name: "Amina K.",
    location: "Abuja",
    text: "My son's phone was stolen at the market. We posted a bounty and a Magneetar user found it within 2 hours. Got it back!",
    rating: 5,
  },
  {
    name: "Emeka N.",
    location: "Port Harcourt",
    text: "The family circle feature is amazing. I can see my wife and kids are safe at home while I'm at work. Peace of mind is priceless.",
    rating: 5,
  },
];

export function NigeriaLandingContent() {
  const [imei, setImei] = useState("");
  const [trustResult, setTrustResult] = useState<{
    score: number;
    status: string;
  } | null>(null);

  const checkIMEI = async () => {
    if (imei.length < 15) return;
    try {
      const res = await fetch("/api/trust/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imei, check_type: "full" }),
      });
      if (res.ok) {
        const data = await res.json();
        setTrustResult({ score: data.trust_score, status: data.status });
      }
    } catch {
      // silently fail
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <section className="relative py-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/20 to-teal-600/20" />
        <div className="max-w-5xl mx-auto relative">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/20 rounded-full text-emerald-400 text-sm font-medium mb-6">
              <Shield size={16} />
              Built for Nigeria · Priced in Naira
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              Protect Your Phone.
              <br />
              <span className="text-emerald-400">Stay Close to Who Matters.</span>
            </h1>
            <p className="text-xl text-white/70 max-w-2xl mx-auto mb-8">
              Nigeria loses 25 million phones every year. Only 5% are ever recovered.
              Magneetar changes that — with community recovery, Trust Scores, and real-time tracking.
            </p>
            <div className="flex justify-center gap-4">
              <a
                href="/download"
                className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-semibold text-lg transition-colors"
              >
                <Download size={20} />
                Download Free
              </a>
              <a
                href="/trust"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white/10 text-white rounded-xl hover:bg-white/20 font-semibold text-lg transition-colors"
              >
                <Search size={20} />
                Check a Phone Free
              </a>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {STATS.map((stat) => {
              const StatIcon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 text-center"
                >
                  <StatIcon size={24} className={`${stat.color} mx-auto mb-2`} />
                  <p className="text-3xl font-bold text-white">{stat.value}</p>
                  <p className="text-sm text-white/60">{stat.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* IMEI Check Section */}
      <section className="py-16 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                🔍 Free IMEI Check
              </h2>
              <p className="text-gray-600">
                Before you buy a used phone, check its Trust Score. It takes 2 seconds.
              </p>
            </div>

            <div className="flex gap-3 mb-4">
              <input
                type="text"
                value={imei}
                onChange={(e) => setImei(e.target.value.replace(/\D/g, "").slice(0, 15))}
                placeholder="Enter 15-digit IMEI"
                className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono text-lg text-center tracking-widest"
                onKeyDown={(e) => e.key === "Enter" && checkIMEI()}
              />
              <button
                onClick={checkIMEI}
                disabled={imei.length < 15}
                className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 font-semibold transition-colors"
              >
                Check
              </button>
            </div>

            <p className="text-sm text-gray-500 text-center">
              Dial <code className="bg-gray-100 px-2 py-0.5 rounded">*#06#</code> on any phone to find its IMEI
            </p>

            {trustResult && (
              <div className={`mt-6 p-4 rounded-xl ${
                trustResult.status === "clean"
                  ? "bg-emerald-50 border border-emerald-200"
                  : trustResult.status === "stolen"
                    ? "bg-red-50 border border-red-200"
                    : "bg-amber-50 border border-amber-200"
              }`}>
                <div className="flex items-center gap-3">
                  {trustResult.status === "clean" ? (
                    <CheckCircle2 size={24} className="text-emerald-600" />
                  ) : trustResult.status === "stolen" ? (
                    <AlertTriangle size={24} className="text-red-600" />
                  ) : (
                    <ShieldAlert size={24} className="text-amber-600" />
                  )}
                  <div>
                    <p className="font-bold text-gray-900">
                      Trust Score: {trustResult.score}/100
                    </p>
                    <p className="text-sm text-gray-600 capitalize">
                      Status: {trustResult.status}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            Everything You Need to Stay Safe
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FEATURES.map((feature) => {
              const FeatureIcon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-colors"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4`}>
                    <FeatureIcon size={24} className="text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-white/60 mb-4">{feature.description}</p>
                  <a
                    href={feature.href}
                    className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 font-medium"
                  >
                    {feature.cta}
                    <ArrowRight size={16} />
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Comparison vs Competitors */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-4">
            Why Magneetar is Different
          </h2>
          <p className="text-white/60 text-center mb-8">
            Other apps track your phone. Magneetar helps you get it back.
          </p>
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
            <div className="grid grid-cols-3 gap-4 p-4 border-b border-white/10">
              <div className="text-sm font-medium text-white/60">Feature</div>
              <div className="text-center text-sm font-bold text-emerald-400">Magneetar</div>
              <div className="text-center text-sm font-medium text-white/40">Others</div>
            </div>
            {COMPARISON.map((item, i) => (
              <div
                key={item.feature}
                className={`grid grid-cols-3 gap-4 p-4 ${
                  i < COMPARISON.length - 1 ? "border-b border-white/5" : ""
                }`}
              >
                <div className="text-sm text-white/80">{item.feature}</div>
                <div className="flex justify-center">
                  {item.magneetar ? (
                    <CheckCircle2 size={18} className="text-emerald-500" />
                  ) : (
                    <span className="text-white/20">—</span>
                  )}
                </div>
                <div className="flex justify-center">
                  {item.others ? (
                    <CheckCircle2 size={18} className="text-white/40" />
                  ) : (
                    <span className="text-white/20">✗</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            Real Nigerians. Real Recoveries.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10"
              >
                <div className="flex gap-1 mb-3">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} size={16} className="text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-white/80 mb-4 italic">&ldquo;{t.text}&rdquo;</p>
                <div>
                  <p className="font-medium text-white">{t.name}</p>
                  <p className="text-sm text-white/50">{t.location}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-4">
            Simple, Naira-Based Pricing
          </h2>
          <p className="text-white/60 text-center mb-8">
            No USD conversion surprises. Pay in Naira, get premium protection.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Free */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <h3 className="text-lg font-bold text-white mb-2">Free</h3>
              <p className="text-3xl font-bold text-emerald-400 mb-4">₦0</p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center gap-2 text-sm text-white/70">
                  <CheckCircle2 size={14} className="text-emerald-500" /> 1 device
                </li>
                <li className="flex items-center gap-2 text-sm text-white/70">
                  <CheckCircle2 size={14} className="text-emerald-500" /> 5-min tracking
                </li>
                <li className="flex items-center gap-2 text-sm text-white/70">
                  <CheckCircle2 size={14} className="text-emerald-500" /> Trust Score check
                </li>
                <li className="flex items-center gap-2 text-sm text-white/70">
                  <CheckCircle2 size={14} className="text-emerald-500" /> Basic anti-theft
                </li>
              </ul>
              <a
                href="/download"
                className="block text-center py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 font-medium transition-colors"
              >
                Get Started
              </a>
            </div>

            {/* Personal */}
            <div className="bg-emerald-500/20 backdrop-blur-sm rounded-2xl p-6 border-2 border-emerald-400 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-full">
                MOST POPULAR
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Personal</h3>
              <p className="text-3xl font-bold text-emerald-400 mb-4">₦1,500<span className="text-lg">/mo</span></p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center gap-2 text-sm text-white/70">
                  <CheckCircle2 size={14} className="text-emerald-500" /> 3 devices
                </li>
                <li className="flex items-center gap-2 text-sm text-white/70">
                  <CheckCircle2 size={14} className="text-emerald-500" /> 3-second tracking
                </li>
                <li className="flex items-center gap-2 text-sm text-white/70">
                  <CheckCircle2 size={14} className="text-emerald-500" /> Smart geofencing
                </li>
                <li className="flex items-center gap-2 text-sm text-white/70">
                  <CheckCircle2 size={14} className="text-emerald-500" /> 5 family members
                </li>
                <li className="flex items-center gap-2 text-sm text-white/70">
                  <CheckCircle2 size={14} className="text-emerald-500" /> Panic button
                </li>
              </ul>
              <a
                href="/download"
                className="block text-center py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium transition-colors"
              >
                Upgrade Now
              </a>
            </div>

            {/* Family */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <h3 className="text-lg font-bold text-white mb-2">Family</h3>
              <p className="text-3xl font-bold text-emerald-400 mb-4">₦3,000<span className="text-lg">/mo</span></p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center gap-2 text-sm text-white/70">
                  <CheckCircle2 size={14} className="text-emerald-500" /> 10 devices
                </li>
                <li className="flex items-center gap-2 text-sm text-white/70">
                  <CheckCircle2 size={14} className="text-emerald-500" /> Unlimited tracking
                </li>
                <li className="flex items-center gap-2 text-sm text-white/70">
                  <CheckCircle2 size={14} className="text-emerald-500" /> Unlimited family
                </li>
                <li className="flex items-center gap-2 text-sm text-white/70">
                  <CheckCircle2 size={14} className="text-emerald-500" /> Digital inheritance
                </li>
                <li className="flex items-center gap-2 text-sm text-white/70">
                  <CheckCircle2 size={14} className="text-emerald-500" /> Priority support
                </li>
              </ul>
              <a
                href="/download"
                className="block text-center py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 font-medium transition-colors"
              >
                Choose Family
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Don&apos;t Wait Until Your Phone is Stolen
          </h2>
          <p className="text-xl text-white/70 mb-8">
            Install Magneetar now. It takes 2 minutes. It could save you ₦200,000+.
          </p>
          <div className="flex justify-center gap-4">
            <a
              href="/download"
              className="inline-flex items-center gap-2 px-10 py-5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-bold text-xl transition-colors"
            >
              <Download size={24} />
              Download Free
            </a>
          </div>
          <p className="text-white/40 text-sm mt-6">
            Free forever for 1 device. Premium from ₦1,500/month.
          </p>
        </div>
      </section>

      {/* Footer */}
      <div className="text-center py-6 border-t border-white/10">
        <p className="text-white/40 text-sm">
          Built in Nigeria 🇳🇬 · For Nigerians · Priced in Naira
        </p>
      </div>
    </div>
  );
}
