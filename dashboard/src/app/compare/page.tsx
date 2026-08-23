"use client";

import {
  ShieldCheck,
  Shield,
  ShieldAlert,
  ShieldQuestion,
  MapPin,
  Camera,
  Lock,
  Users,
  Smartphone,
  Brain,
  Zap,
  DollarSign,
  Globe,
  CheckCircle2,
  XCircle,
  Minus,
  ArrowRight,
  Star,
  Wifi,
  WifiOff,
  Bell,
  AlertTriangle,
  Eye,
  Search,
} from "lucide-react";

interface Competitor {
  name: string;
  logo: string;
  tagline: string;
  pricing: string;
  rating: number;
  ratingCount: string;
  platforms: string[];
  founded: string;
  headquartered: string;
}

interface Feature {
  category: string;
  features: {
    name: string;
    magneetar: "yes" | "no" | "partial";
    cerberus: "yes" | "no" | "partial";
    prey: "yes" | "no" | "partial";
    google: "yes" | "no" | "partial";
    description?: string;
  }[];
}

const competitors: Competitor[] = [
  {
    name: "Magneetar",
    logo: "🛡️",
    tagline: "The complete phone safety ecosystem",
    pricing: "Free (₦1,500/mo premium)",
    rating: 4.8,
    ratingCount: "New",
    platforms: ["Android"],
    founded: "2024",
    headquartered: "Nigeria",
  },
  {
    name: "Cerberus",
    logo: "🐕",
    tagline: "Anti-theft, phone tracker, MDM",
    pricing: "$5/month or $35/year",
    rating: 4.3,
    ratingCount: "2,439",
    platforms: ["Android", "iOS"],
    founded: "2011",
    headquartered: "Italy",
  },
  {
    name: "Prey",
    logo: "🦅",
    tagline: "Device tracking and security",
    pricing: "$1.30-$2.25/mo per device",
    rating: 4.7,
    ratingCount: "58 (G2)",
    platforms: ["Android", "iOS", "Windows", "Mac", "Linux"],
    founded: "2009",
    headquartered: "Chile/USA",
  },
  {
    name: "Google Find My Device",
    logo: "📍",
    tagline: "Find, lock, or erase your device",
    pricing: "Free (with Google account)",
    rating: 4.1,
    ratingCount: "Built-in",
    platforms: ["Android"],
    founded: "2013",
    headquartered: "USA",
  },
];

const featureComparison: Feature[] = [
  {
    category: "Tracking & Location",
    features: [
      { name: "Real-time GPS tracking", magneetar: "yes", cerberus: "yes", prey: "yes", google: "yes" },
      { name: "3-second location updates", magneetar: "yes", cerberus: "no", prey: "no", google: "no", description: "Magneetar's Sentinel mode updates every 3 seconds" },
      { name: "Offline finding (no internet)", magneetar: "partial", cerberus: "no", prey: "no", google: "yes", description: "Google uses Android mesh network; Magneetar uses P2P relay" },
      { name: "Location history", magneetar: "yes", cerberus: "partial", prey: "yes", google: "yes" },
      { name: "Geofencing", magneetar: "yes", cerberus: "yes", prey: "yes", google: "no" },
      { name: "Smart/AI geofencing", magneetar: "yes", cerberus: "no", prey: "no", google: "no", description: "Magneetar learns routines and auto-discovers zones" },
      { name: "Safe route suggestions", magneetar: "yes", cerberus: "no", prey: "no", google: "no" },
    ],
  },
  {
    category: "Anti-Theft",
    features: [
      { name: "Remote lock", magneetar: "yes", cerberus: "yes", prey: "yes", google: "yes" },
      { name: "Remote wipe", magneetar: "yes", cerberus: "yes", prey: "yes", google: "yes" },
      { name: "Thief photo capture", magneetar: "yes", cerberus: "yes", prey: "partial", google: "no" },
      { name: "Audio recording", magneetar: "yes", cerberus: "yes", prey: "no", google: "no" },
      { name: "Siren alarm", magneetar: "yes", cerberus: "yes", prey: "yes", google: "yes" },
      { name: "Fake shutdown", magneetar: "yes", cerberus: "yes", prey: "no", google: "no" },
      { name: "Motion detection alert", magneetar: "yes", cerberus: "yes", prey: "no", google: "no" },
      { name: "SMS commands", magneetar: "yes", cerberus: "yes", prey: "no", google: "no" },
    ],
  },
  {
    category: "Recovery & Community",
    features: [
      { name: "Community watch map", magneetar: "yes", cerberus: "no", prey: "no", google: "no", description: "Waze-style crowdsourced theft hotspot map" },
      { name: "Recovery bounty system", magneetar: "yes", cerberus: "no", prey: "no", google: "no", description: "Post bounties, finders claim rewards" },
      { name: "Guardian network", magneetar: "yes", cerberus: "no", prey: "no", google: "no", description: "Community helps recover stolen phones" },
      { name: "Trust score / IMEI check", magneetar: "yes", cerberus: "no", prey: "no", google: "no", description: "Verify phone authenticity before buying" },
      { name: "Evidence PDF generation", magneetar: "yes", cerberus: "partial", prey: "no", google: "no", description: "Court-admissible evidence package" },
      { name: "Police report helper", magneetar: "yes", cerberus: "no", prey: "no", google: "no" },
    ],
  },
  {
    category: "Family & Social",
    features: [
      { name: "Family safety circles", magneetar: "yes", cerberus: "partial", prey: "no", google: "no", description: "Real-time location sharing with family" },
      { name: "Panic button / SOS", magneetar: "yes", cerberus: "partial", prey: "no", google: "no", description: "One-tap emergency alert to family" },
      { name: "Digital inheritance", magneetar: "yes", cerberus: "no", prey: "no", google: "no", description: "Emergency access for trusted people" },
      { name: "Coworker/team circles", magneetar: "yes", cerberus: "no", prey: "no", google: "no" },
      { name: "Geofence alerts for family", magneetar: "yes", cerberus: "partial", prey: "no", google: "no" },
      { name: "Anomaly detection", magneetar: "yes", cerberus: "no", prey: "no", google: "no", description: "AI detects unusual behavior patterns" },
    ],
  },
  {
    category: "Device Health",
    features: [
      { name: "Battery monitoring", magneetar: "yes", cerberus: "yes", prey: "yes", google: "yes" },
      { name: "Storage analysis", magneetar: "yes", cerberus: "no", prey: "yes", google: "no" },
      { name: "Performance tracking", magneetar: "yes", cerberus: "no", prey: "no", google: "no" },
      { name: "Battery health prediction", magneetar: "yes", cerberus: "no", prey: "no", google: "no" },
      { name: "Storage cleanup suggestions", magneetar: "yes", cerberus: "no", prey: "no", google: "no" },
    ],
  },
  {
    category: "Platform & Pricing",
    features: [
      { name: "Free tier", magneetar: "yes", cerberus: "partial", prey: "no", google: "yes" },
      { name: "Naira/local pricing", magneetar: "yes", cerberus: "no", prey: "no", google: "no" },
      { name: "Multi-device support", magneetar: "yes", cerberus: "yes", prey: "yes", google: "yes" },
      { name: "Web dashboard", magneetar: "yes", cerberus: "yes", prey: "yes", google: "yes" },
      { name: "API access", magneetar: "yes", cerberus: "no", prey: "yes", google: "no" },
      { name: "Open source", magneetar: "partial", cerberus: "no", prey: "partial", google: "no" },
    ],
  },
];

const iconMap = {
  "Tracking & Location": MapPin,
  "Anti-Theft": ShieldAlert,
  "Recovery & Community": Users,
  "Family & Social": Heart,
  "Device Health": Zap,
  "Platform & Pricing": DollarSign,
};

function Heart({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

function FeatureIcon({ status }: { status: "yes" | "no" | "partial" }) {
  if (status === "yes") return <CheckCircle2 size={18} className="text-emerald-500" />;
  if (status === "partial") return <Minus size={18} className="text-amber-500" />;
  return <XCircle size={18} className="text-gray-300" />;
}

export default function ComparePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Hero */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-6">
            <Shield size={40} className="text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">
            Why Magneetar is Different
          </h1>
          <p className="text-white/80 text-lg max-w-2xl mx-auto">
            Compare Magneetar with the leading anti-theft apps. We built what others didn&apos;t —
            community recovery, trust scores, and family safety.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 -mt-8">
        {/* Competitor Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
          {competitors.map((c, i) => (
            <div
              key={c.name}
              className={`rounded-2xl p-5 ${
                i === 0
                  ? "bg-emerald-50 border-2 border-emerald-400 shadow-lg shadow-emerald-500/20"
                  : "bg-white border border-gray-200"
              }`}
            >
              {i === 0 && (
                <div className="text-center mb-3">
                  <span className="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-full">
                    OUR PICK
                  </span>
                </div>
              )}
              <div className="text-center mb-4">
                <span className="text-4xl">{c.logo}</span>
                <h3 className="font-bold text-gray-900 text-lg mt-2">{c.name}</h3>
                <p className="text-sm text-gray-500">{c.tagline}</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Price</span>
                  <span className="font-medium text-gray-900">{c.pricing}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Rating</span>
                  <span className="font-medium text-gray-900">
                    ⭐ {c.rating} ({c.ratingCount})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Platforms</span>
                  <span className="font-medium text-gray-900">{c.platforms.join(", ")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Since</span>
                  <span className="font-medium text-gray-900">{c.founded}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Feature Comparison Table */}
        {featureComparison.map((section) => {
          const SectionIcon = iconMap[section.category as keyof typeof iconMap] || Shield;
          return (
            <div key={section.category} className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <SectionIcon size={20} className="text-emerald-400" />
                </div>
                <h2 className="text-xl font-bold text-white">{section.category}</h2>
              </div>

              <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-5 gap-4 p-4 border-b border-white/10">
                  <div className="text-sm font-medium text-white/60">Feature</div>
                  {competitors.map((c) => (
                    <div key={c.name} className="text-center">
                      <span className="text-lg">{c.logo}</span>
                      <p className="text-xs font-medium text-white/80">{c.name}</p>
                    </div>
                  ))}
                </div>

                {/* Features */}
                {section.features.map((feature, i) => (
                  <div
                    key={feature.name}
                    className={`grid grid-cols-5 gap-4 p-4 ${
                      i < section.features.length - 1 ? "border-b border-white/5" : ""
                    }`}
                  >
                    <div>
                      <p className="text-sm text-white/90">{feature.name}</p>
                      {feature.description && (
                        <p className="text-xs text-white/40 mt-0.5">{feature.description}</p>
                      )}
                    </div>
                    <div className="flex justify-center">
                      <FeatureIcon status={feature.magneetar} />
                    </div>
                    <div className="flex justify-center">
                      <FeatureIcon status={feature.cerberus} />
                    </div>
                    <div className="flex justify-center">
                      <FeatureIcon status={feature.prey} />
                    </div>
                    <div className="flex justify-center">
                      <FeatureIcon status={feature.google} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Key Differentiators */}
        <div className="mt-12 mb-8">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            What Makes Magneetar Unique
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-2xl p-6 border border-emerald-500/30">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/30 flex items-center justify-center mb-4">
                <Users size={24} className="text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Community Recovery</h3>
              <p className="text-sm text-white/60">
                No other app lets the community help recover phones. Our bounty system and guardian
                network turn every Magneetar user into a potential phone finder.
              </p>
            </div>
            <div className="bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-2xl p-6 border border-blue-500/30">
              <div className="w-12 h-12 rounded-xl bg-blue-500/30 flex items-center justify-center mb-4">
                <Brain size={24} className="text-blue-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">AI-Powered Intelligence</h3>
              <p className="text-sm text-white/60">
                Smart geofencing learns routines, anomaly detection catches unusual behavior,
                and battery prediction prevents dead phones. No competitor does this.
              </p>
            </div>
            <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl p-6 border border-purple-500/30">
              <div className="w-12 h-12 rounded-xl bg-purple-500/30 flex items-center justify-center mb-4">
                <DollarSign size={24} className="text-purple-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Built for Africa</h3>
              <p className="text-sm text-white/60">
                Naira pricing, SMS commands for low-data areas, offline-first design,
                and a free tier that actually works. Competitors charge in USD and ignore Africa.
              </p>
            </div>
          </div>
        </div>

        {/* Pricing Comparison */}
        <div className="mt-12 mb-8">
          <h2 className="text-2xl font-bold text-white text-center mb-8">Pricing Comparison</h2>
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
            <div className="grid grid-cols-4 gap-6">
              {competitors.map((c) => (
                <div key={c.name} className="text-center">
                  <span className="text-3xl">{c.logo}</span>
                  <h3 className="font-bold text-white mt-2">{c.name}</h3>
                  <p className="text-2xl font-bold text-emerald-400 mt-2">{c.pricing}</p>
                  <p className="text-sm text-white/40 mt-1">
                    {c.name === "Magneetar"
                      ? "₦0 free tier, ₦1,500/mo premium"
                      : c.name === "Cerberus"
                        ? "$35/year = ₦55,000/year"
                        : c.name === "Prey"
                          ? "$1.30-$2.25/mo per device"
                          : "Free with Google account"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center py-12">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Protect Your Phone?
          </h2>
          <p className="text-white/60 mb-8 max-w-xl mx-auto">
            Join thousands of Nigerians who trust Magneetar to protect their phones
            and stay connected with the people who matter.
          </p>
          <div className="flex justify-center gap-4">
            <a
              href="/download"
              className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-semibold text-lg transition-colors"
            >
              Download Free
              <ArrowRight size={20} />
            </a>
            <a
              href="/trust"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white/10 text-white rounded-xl hover:bg-white/20 font-semibold text-lg transition-colors"
            >
              <Search size={20} />
              Check a Phone
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-6 border-t border-white/10">
          <p className="text-white/40 text-sm">
            Data sourced from official websites and app store listings · Last updated August 2026
          </p>
        </div>
      </div>
    </div>
  );
}
