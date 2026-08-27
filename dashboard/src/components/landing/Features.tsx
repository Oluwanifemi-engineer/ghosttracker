'use client';

import {
  Brain,
  MapPin,
  Camera,
  Radar,
  Zap,
  ShieldCheck,
  Smartphone,
  Lock,
  Eye,
  FileText,
  Users,
  BellRing,
} from 'lucide-react';
import { TiltCard } from '@/components/ui/TiltCard';

const FEATURES = [
  {
    icon: Brain,
    title: 'Theft Detection',
    description:
      'Weighted scoring across 8 signals — SIM change, failed unlocks, device admin disabled, location anomalies — with false-positive prevention.',
    accent: true,
  },
  {
    icon: MapPin,
    title: 'Real-time Tracking',
    description:
      'GPS + network location streamed live to your dashboard with 3-second updates.',
    accent: false,
  },
  {
    icon: Camera,
    title: 'Evidence Capture',
    description:
      'Trigger front/rear camera photos and audio captures remotely — every piece is tamper-proof.',
    accent: false,
  },
  {
    icon: Radar,
    title: 'Geofencing',
    description:
      'Define safe zones and receive instant exit alerts. Set auto-actions: capture photo, trigger siren, or alert only.',
    accent: false,
  },
  {
    icon: Zap,
    title: 'Remote Commands',
    description:
      'Lock the device, trigger a max-volume siren, capture evidence, or wipe data — all from the dashboard.',
    accent: true,
  },
  {
    icon: BellRing,
    title: 'Multi-Channel Alerts',
    description:
      'SMS, WhatsApp, and push notifications — so you know the moment something is wrong, even on slow networks.',
    accent: false,
  },
  {
    icon: Lock,
    title: 'Device Admin',
    description:
      'Remote lock and wipe via Android Device Policy Manager, plus SIM-change detection that arms theft mode.',
    accent: false,
  },
  {
    icon: Smartphone,
    title: 'Offline Queue',
    description:
      'Location pings queue when offline and upload when reconnected — no data lost during network gaps.',
    accent: false,
  },
  {
    icon: Eye,
    title: 'Works on any Android',
    description:
      'Survives battery-saving modes on Huawei, Xiaomi, Oppo, Vivo, and Realme — phones that kill most tracking apps.',
    accent: false,
  },
  {
    icon: FileText,
    title: 'Evidence Reports',
    description:
      'Generate PDF evidence reports with location history, photos, and tamper-proof records.',
    accent: false,
  },
];

function FeatureCard({ feature }: { feature: typeof FEATURES[0]; index: number }) {
  return (
    <TiltCard className="group rounded-2xl bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-white/[0.06] hover:border-emerald-500/20 transition-all duration-400">
      <div className="relative p-6 overflow-hidden">
        {/* Top accent line on hover */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/0 to-transparent group-hover:via-emerald-500/40 transition-all duration-500" />

        <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-all duration-300 ${
          feature.accent
            ? 'bg-emerald-500/10 border border-emerald-500/20'
            : 'bg-white/[0.04] border border-white/[0.06] group-hover:bg-emerald-500/8 group-hover:border-emerald-500/15'
        }`}>
          <feature.icon size={20} className={`${feature.accent ? 'text-emerald-400' : 'text-gray-400 group-hover:text-emerald-400'} transition-colors duration-300`} />
        </div>

        <h3 className="text-white font-bold text-[14px] tracking-tight group-hover:text-emerald-50 transition-colors duration-300">
          {feature.title}
        </h3>
        <p className="mt-2 text-[13px] leading-relaxed text-gray-400 group-hover:text-gray-300/80 transition-colors duration-300">
          {feature.description}
        </p>
      </div>
    </TiltCard>
  );
}

export function Features() {
  return (
    <section id="features" className="relative py-28 sm:py-36 bg-gradient-to-b from-gray-950 via-[#060a10] to-gray-950 scroll-mt-20">
      {/* Subtle grid dots */}
      <div className="absolute inset-0 bg-grid-dark bg-[size:24px_24px] opacity-40 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <div className="badge-dark mb-5 mx-auto w-fit">
            <span>CAPABILITIES</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            One command center for{' '}
            <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">what matters</span>
          </h2>
          <p className="mt-4 text-gray-400 leading-relaxed max-w-lg mx-auto">
            Protect the devices you own and stay close to the people you love — from silent background
            tracking to evidence you can take to the police.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
