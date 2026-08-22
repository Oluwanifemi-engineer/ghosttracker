'use client';

import { Check, X, Minus } from 'lucide-react';

/**
 * ComparisonTable — side-by-side feature comparison vs the top 3 competitors.
 * Designed to be scannable: green checks, red crosses, and a highlighted column.
 */

interface Feature {
  name: string;
  magneetar: boolean | string;
  cerberus: boolean | string;
  prey: boolean | string;
  findMy: boolean | string;
  category: string;
}

const FEATURES: Feature[] = [
  // Tracking
  { name: 'Real-time GPS tracking', magneetar: true, cerberus: true, prey: true, findMy: true, category: 'Tracking' },
  { name: '3-second location updates', magneetar: true, cerberus: false, prey: false, findMy: false, category: 'Tracking' },
  { name: 'Kalman-filtered coordinates', magneetar: true, cerberus: false, prey: false, findMy: false, category: 'Tracking' },
  { name: 'Road-snapped markers', magneetar: true, cerberus: false, prey: false, findMy: false, category: 'Tracking' },
  { name: 'Offline location queuing', magneetar: true, cerberus: false, prey: true, findMy: false, category: 'Tracking' },
  { name: 'Adaptive battery cadence', magneetar: true, cerberus: false, prey: false, findMy: false, category: 'Tracking' },

  // Security
  { name: 'Theft detection AI (8 signals)', magneetar: true, cerberus: false, prey: false, findMy: false, category: 'Security' },
  { name: 'Evidence capture (photos + audio)', magneetar: true, cerberus: true, prey: true, findMy: false, category: 'Security' },
  { name: 'SHA-256 chain of custody', magneetar: true, cerberus: false, prey: false, findMy: false, category: 'Security' },
  { name: 'Remote data wipe', magneetar: true, cerberus: true, prey: true, findMy: true, category: 'Security' },
  { name: 'Remote siren / alarm', magneetar: true, cerberus: true, prey: true, findMy: false, category: 'Security' },
  { name: 'SIM change detection', magneetar: true, cerberus: true, prey: false, findMy: false, category: 'Security' },

  // Privacy & Ownership
  { name: 'Self-hosted option', magneetar: true, cerberus: true, prey: false, findMy: false, category: 'Privacy' },
  { name: 'Zero-knowledge encryption', magneetar: true, cerberus: false, prey: false, findMy: false, category: 'Privacy' },
  { name: 'No data sold to third parties', magneetar: true, cerberus: true, prey: false, findMy: false, category: 'Privacy' },
  { name: 'Open source', magneetar: true, cerberus: true, prey: false, findMy: false, category: 'Privacy' },
  { name: 'Built for Africa', magneetar: true, cerberus: false, prey: false, findMy: false, category: 'Privacy' },

  // Platform
  { name: 'Android', magneetar: true, cerberus: true, prey: true, findMy: true, category: 'Platform' },
  { name: 'iOS', magneetar: 'Coming', cerberus: false, prey: true, findMy: true, category: 'Platform' },
  { name: 'Web dashboard', magneetar: true, cerberus: true, prey: true, findMy: false, category: 'Platform' },
  { name: 'Offline-first (no server)', magneetar: true, cerberus: true, prey: false, findMy: false, category: 'Platform' },
];

function CellValue({ value }: { value: boolean | string }) {
  if (value === true) {
    return (
      <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
        <Check size={12} className="text-emerald-500" />
      </div>
    );
  }
  if (value === false) {
    return (
      <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center">
        <X size={10} className="text-gray-600" />
      </div>
    );
  }
  return (
    <span className="text-[11px] font-mono text-amber-400 font-bold">{value}</span>
  );
}

const COMPETITORS = [
  { name: 'Magneetar', highlight: true },
  { name: 'Cerberus', highlight: false },
  { name: 'Prey', highlight: false },
  { name: 'Find My', highlight: false },
];

export function ComparisonTable() {
  // Group features by category
  const categories = [...new Set(FEATURES.map((f) => f.category))];

  return (
    <section className="py-20 sm:py-28 bg-gray-950 relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gray-700 bg-gray-800/50 mb-5">
            <Minus size={10} className="text-gray-400" />
            <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-gray-400">HOW WE COMPARE</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-extrabold tracking-tight text-white mb-4">
            Not just another tracker.
          </h2>
          <p className="text-gray-400 text-base max-w-lg mx-auto">
            Magneetar was built from scratch for the moments other apps miss.
            Here&apos;s how we stack up.
          </p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto -mx-5 px-5 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[640px]">
            {/* Header */}
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-4 px-4 text-[10px] font-mono font-bold text-gray-500 tracking-wider w-1/3">
                  FEATURE
                </th>
                {COMPETITORS.map((c) => (
                  <th
                    key={c.name}
                    className={`py-4 px-4 text-center ${c.highlight ? 'bg-emerald-500/5' : ''}`}
                  >
                    <span className={`text-xs font-bold tracking-wide ${
                      c.highlight ? 'text-emerald-400' : 'text-gray-400'
                    }`}>
                      {c.name.toUpperCase()}
                    </span>
                    {c.highlight && (
                      <div className="mt-1">
                        <span className="text-[8px] font-mono text-emerald-500/60 tracking-wider">★ YOU</span>
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {categories.map((category) => (
                <Fragment key={category}>
                  {/* Category header */}
                  <tr>
                    <td
                      colSpan={5}
                      className="pt-6 pb-2 px-4 text-[10px] font-mono font-bold text-gray-500 tracking-[0.2em] uppercase"
                    >
                      {category}
                    </td>
                  </tr>

                  {/* Feature rows */}
                  {FEATURES.filter((f) => f.category === category).map((feature) => (
                    <tr
                      key={feature.name}
                      className="border-b border-gray-800/50 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-3 px-4 text-xs text-gray-300">{feature.name}</td>
                      <td className="py-3 px-4 text-center bg-emerald-500/[0.03]">
                        <div className="flex justify-center">
                          <CellValue value={feature.magneetar} />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex justify-center">
                          <CellValue value={feature.cerberus} />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex justify-center">
                          <CellValue value={feature.prey} />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex justify-center">
                          <CellValue value={feature.findMy} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>

            {/* Summary row */}
            <tfoot>
              <tr className="border-t-2 border-gray-700">
                <td className="py-4 px-4 text-xs font-bold text-gray-400">
                  Features we have that others don&apos;t
                </td>
                <td className="py-4 px-4 text-center bg-emerald-500/5">
                  <span className="text-lg font-display font-extrabold text-emerald-400">
                    {FEATURES.filter((f) => f.magneetar === true && (f.cerberus === false || f.prey === false || f.findMy === false)).length}
                  </span>
                </td>
                <td className="py-4 px-4 text-center">
                  <span className="text-lg font-display font-extrabold text-gray-600">
                    {FEATURES.filter((f) => f.cerberus === true && (f.magneetar === false || f.prey === false || f.findMy === false)).length}
                  </span>
                </td>
                <td className="py-4 px-4 text-center">
                  <span className="text-lg font-display font-extrabold text-gray-600">
                    {FEATURES.filter((f) => f.prey === true && (f.magneetar === false || f.cerberus === false || f.findMy === false)).length}
                  </span>
                </td>
                <td className="py-4 px-4 text-center">
                  <span className="text-lg font-display font-extrabold text-gray-600">
                    {FEATURES.filter((f) => f.findMy === true && (f.magneetar === false || f.cerberus === false || f.prey === false)).length}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Source note */}
        <p className="text-[9px] font-mono text-gray-600 text-center mt-6">
          Feature comparison based on publicly available documentation as of August 2026.{' '}
          iOS support is on the roadmap.
        </p>
      </div>
    </section>
  );
}

// Fragment import needed
import { Fragment } from 'react';
