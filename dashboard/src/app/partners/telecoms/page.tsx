"use client";

import {
  Smartphone,
  Shield,
  Users,
  TrendingUp,
  DollarSign,
  Globe,
  Zap,
  CheckCircle2,
  ArrowRight,
  BarChart3,
  Lock,
  Phone,
  Wifi,
  Target,
  Award,
  Handshake,
} from "lucide-react";

const TELCOS = [
  {
    name: "MTN",
    marketShare: "55%",
    subscribers: "78M",
    color: "from-yellow-500 to-amber-600",
    icon: "📱",
    strengths: ["Largest network", "MoMo mobile money", "4G/5G coverage"],
  },
  {
    name: "Airtel",
    marketShare: "30%",
    subscribers: "43M",
    color: "from-red-500 to-rose-600",
    icon: "📶",
    strengths: ["Fastest growing", "SmartCash payments", "Rural coverage"],
  },
  {
    name: "Glo",
    marketShare: "12%",
    subscribers: "17M",
    color: "from-green-500 to-emerald-600",
    icon: "🌐",
    strengths: ["Data bundles", "GloCash", "Youth market"],
  },
];

const PARTNERSHIP_MODELS = [
  {
    title: "SIM Bundle",
    description: "Pre-install Magneetar on new SIM activations. Users get 1 month free premium.",
    icon: Smartphone,
    revenue: "₦50-100 per activation",
    reach: "All new SIM registrations",
    effort: "Low — API integration",
    color: "from-blue-500 to-indigo-600",
  },
  {
    title: "VAS Partnership",
    description: "Add Magneetar to the telco's Value-Added Services menu. Charge via airtime deduction.",
    icon: BarChart3,
    revenue: "15-20% revenue share",
    reach: "Existing subscribers",
    effort: "Medium — USSD menu integration",
    color: "from-purple-500 to-pink-600",
  },
  {
    title: "Data Bundle Bonus",
    description: "Include Magneetar free trial with data bundle purchases. Drive app downloads.",
    icon: Wifi,
    revenue: "Cost-per-install (CPI)",
    reach: "Data bundle buyers",
    effort: "Low — promotional partnership",
    color: "from-emerald-500 to-teal-600",
  },
  {
    title: "Enterprise Fleet",
    description: "Offer Magneetar Enterprise to telco's corporate customers (logistics, ride-hailing).",
    icon: Target,
    revenue: "30-40% revenue share",
    reach: "Enterprise clients",
    effort: "High — custom integration",
    color: "from-amber-500 to-orange-600",
  },
];

const MARKET_STATS = [
  { value: "220M+", label: "Mobile Subscribers", icon: Phone },
  { value: "85%", label: "Smartphone Penetration", icon: Smartphone },
  { value: "₦77B", label: "VAS Market Size", icon: DollarSign },
  { value: "20.89%", label: "USSD Growth YoY", icon: TrendingUp },
];

export default function TelecomsPartnershipPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Hero */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 py-20 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 rounded-full text-white text-sm font-medium mb-6">
            <Handshake size={16} />
            Partnership Opportunity
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Partner with Magneetar
          </h1>
          <p className="text-xl text-white/80 max-w-2xl mx-auto mb-8">
            Add phone safety to your telco&apos;s value proposition. Protect 220M+ Nigerian
            mobile subscribers from phone theft — and earn revenue doing it.
          </p>
          <div className="flex justify-center gap-4">
            <a
              href="mailto:partnerships@magneetar.me"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-indigo-700 rounded-xl hover:bg-white/90 font-semibold text-lg transition-colors"
            >
              <Handshake size={20} />
              Contact Us
            </a>
            <a
              href="#models"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white/10 text-white rounded-xl hover:bg-white/20 font-semibold text-lg transition-colors"
            >
              View Models
              <ArrowRight size={20} />
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 -mt-8">
        {/* Market Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {MARKET_STATS.map((stat) => {
            const StatIcon = stat.icon;
            return (
              <div
                key={stat.label}
                className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 text-center"
              >
                <StatIcon size={24} className="text-indigo-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-sm text-white/60">{stat.label}</p>
              </div>
            );
          })}
        </div>

        {/* The Problem */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white text-center mb-8">
            The Problem Your Subscribers Face
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-red-500/10 rounded-2xl p-6 border border-red-500/20">
              <p className="text-4xl font-bold text-red-400 mb-2">25M</p>
              <p className="text-white/80">phones stolen in Nigeria every year</p>
            </div>
            <div className="bg-red-500/10 rounded-2xl p-6 border border-red-500/20">
              <p className="text-4xl font-bold text-red-400 mb-2">69K</p>
              <p className="text-white/80">thefts per day — one every 2 seconds</p>
            </div>
            <div className="bg-red-500/10 rounded-2xl p-6 border border-red-500/20">
              <p className="text-4xl font-bold text-red-400 mb-2">&lt;5%</p>
              <p className="text-white/80">of stolen phones are ever recovered</p>
            </div>
          </div>
        </div>

        {/* Telco Landscape */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white text-center mb-8">
            Nigeria&apos;s Telecom Landscape
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TELCOS.map((telco) => (
              <div
                key={telco.name}
                className={`bg-gradient-to-br ${telco.color} rounded-2xl p-6 text-white`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">{telco.icon}</span>
                  <div>
                    <h3 className="text-xl font-bold">{telco.name}</h3>
                    <p className="text-white/80">{telco.subscribers} subscribers</p>
                  </div>
                </div>
                <p className="text-3xl font-bold mb-2">{telco.marketShare}</p>
                <p className="text-white/80 text-sm mb-4">market share</p>
                <ul className="space-y-1">
                  {telco.strengths.map((s) => (
                    <li key={s} className="flex items-center gap-2 text-sm text-white/80">
                      <CheckCircle2 size={14} />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Partnership Models */}
        <div id="models" className="mb-12">
          <h2 className="text-3xl font-bold text-white text-center mb-4">
            Partnership Models
          </h2>
          <p className="text-white/60 text-center mb-8">
            Choose the model that fits your strategy. All models include revenue sharing.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {PARTNERSHIP_MODELS.map((model) => {
              const ModelIcon = model.icon;
              return (
                <div
                  key={model.title}
                  className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-colors"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${model.color} flex items-center justify-center mb-4`}>
                    <ModelIcon size={24} className="text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{model.title}</h3>
                  <p className="text-white/60 mb-4">{model.description}</p>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-white/40">Revenue</p>
                      <p className="font-medium text-emerald-400">{model.revenue}</p>
                    </div>
                    <div>
                      <p className="text-white/40">Reach</p>
                      <p className="font-medium text-white/80">{model.reach}</p>
                    </div>
                    <div>
                      <p className="text-white/40">Effort</p>
                      <p className="font-medium text-white/80">{model.effort}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Value Proposition for Telcos */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white text-center mb-8">
            Why Partner with Magneetar
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-4">
                <TrendingUp size={24} className="text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Reduce Churn</h3>
              <p className="text-sm text-white/60">
                Phone theft is the #1 reason subscribers switch carriers. Magneetar reduces
                churn by giving subscribers a reason to stay.
              </p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-4">
                <DollarSign size={24} className="text-blue-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">New Revenue Stream</h3>
              <p className="text-sm text-white/60">
                VAS revenue grew 20% YoY. Magneetar adds a high-value service to your
                portfolio with minimal integration effort.
              </p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mb-4">
                <Award size={24} className="text-purple-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Brand Differentiation</h3>
              <p className="text-sm text-white/60">
                Be the first telco to offer phone safety as a service. Position your brand
                as the subscriber&apos;s champion.
              </p>
            </div>
          </div>
        </div>

        {/* Technical Integration */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white text-center mb-8">
            Technical Integration
          </h2>
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-lg font-bold text-white mb-4">Integration Options</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 size={18} className="text-emerald-400 mt-0.5" />
                    <div>
                      <p className="text-white font-medium">USSD Gateway</p>
                      <p className="text-sm text-white/60">
                        Connect Magneetar USSD menu to your short code (*123*5#)
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 size={18} className="text-emerald-400 mt-0.5" />
                    <div>
                      <p className="text-white font-medium">REST API</p>
                      <p className="text-sm text-white/60">
                        Integrate subscription management via our developer API
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 size={18} className="text-emerald-400 mt-0.5" />
                    <div>
                      <p className="text-white font-medium">Airtime Billing</p>
                      <p className="text-sm text-white/60">
                        Charge subscriptions directly from subscriber airtime
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 size={18} className="text-emerald-400 mt-0.5" />
                    <div>
                      <p className="text-white font-medium">MoMo / SmartCash</p>
                      <p className="text-sm text-white/60">
                        Accept payments via mobile money platforms
                      </p>
                    </div>
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-4">Timeline</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                      <span className="text-indigo-400 font-bold text-sm">1</span>
                    </div>
                    <div>
                      <p className="text-white font-medium">Week 1-2: Discovery</p>
                      <p className="text-sm text-white/60">Requirements, API access, sandbox</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                      <span className="text-indigo-400 font-bold text-sm">2</span>
                    </div>
                    <div>
                      <p className="text-white font-medium">Week 3-4: Integration</p>
                      <p className="text-sm text-white/60">USSD menu, payment flow, testing</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                      <span className="text-indigo-400 font-bold text-sm">3</span>
                    </div>
                    <div>
                      <p className="text-white font-medium">Week 5-6: Pilot</p>
                      <p className="text-sm text-white/60">Limited rollout, gather feedback</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                      <span className="text-indigo-400 font-bold text-sm">4</span>
                    </div>
                    <div>
                      <p className="text-white font-medium">Week 7-8: Launch</p>
                      <p className="text-sm text-white/60">Full rollout, marketing campaign</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center py-12">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Partner?
          </h2>
          <p className="text-white/60 mb-8 max-w-xl mx-auto">
            Join MTN, Airtel, and Glo in protecting 220M+ Nigerian mobile subscribers.
            Let&apos;s build the future of phone safety together.
          </p>
          <div className="flex justify-center gap-4">
            <a
              href="mailto:partnerships@magneetar.me"
              className="inline-flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-semibold text-lg transition-colors"
            >
              <Handshake size={20} />
              Contact Partnerships
            </a>
            <a
              href="/developers"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white/10 text-white rounded-xl hover:bg-white/20 font-semibold text-lg transition-colors"
            >
              View API Docs
              <ArrowRight size={20} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
