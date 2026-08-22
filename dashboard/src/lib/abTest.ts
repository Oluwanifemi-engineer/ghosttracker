/**
 * Lightweight A/B testing utility.
 *
 * Variants are assigned once per user (persisted in localStorage) and
 * remain stable for the duration of the experiment. No server-side
 * tracking — this is purely client-side for now.
 */

const EXPERIMENT_KEY = 'mt_ab';

export interface Experiment {
  id: string;
  variants: string[];
  weights?: number[]; // optional per-variant weights (default: equal)
}

/**
 * Get the assigned variant for an experiment.
 * Returns the variant string (e.g. 'control' or 'v2').
 * Assignment is sticky per browser (localStorage).
 */
export function getVariant(experiment: Experiment): string {
  const storageKey = `${EXPERIMENT_KEY}_${experiment.id}`;

  // Check existing assignment
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored && experiment.variants.includes(stored)) {
      return stored;
    }
  } catch {
    // SSR or localStorage unavailable
  }

  // Assign new variant (weighted random)
  const { variants, weights } = experiment;
  const totalWeight = weights
    ? weights.reduce((a, b) => a + b, 0)
    : variants.length;

  let rand = Math.random() * totalWeight;
  let assigned = variants[0];

  for (let i = 0; i < variants.length; i++) {
    const w = weights ? weights[i] : 1;
    rand -= w;
    if (rand <= 0) {
      assigned = variants[i];
      break;
    }
  }

  // Persist
  try {
    localStorage.setItem(storageKey, assigned);
  } catch {
    // Ignore
  }

  return assigned;
}

/**
 * Check if a variant is active.
 */
export function isVariant(experiment: Experiment, variant: string): boolean {
  return getVariant(experiment) === variant;
}

/**
 * Track a conversion event (for future server-side analytics).
 * Currently just logs to console — wire up to your analytics endpoint.
 */
export function trackConversion(
  experimentId: string,
  variant: string,
  event: string,
  value?: number
) {
  const payload = { experimentId, variant, event, value, ts: Date.now() };

  // Console for dev
  if (typeof window !== 'undefined') {
    console.log('[AB]', payload);

    // Fire-and-forget beacon to server analytics endpoint
    const serverUrl = sessionStorage.getItem('mt_server_url');
    if (serverUrl) {
      try {
        fetch(`${serverUrl}/metrics/ab-event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {}); // silent fail
      } catch {
        // Ignore network errors
      }
    }
  }
}

// ─── Experiment Definitions ───────────────────────────────────────────────

export const HERO_EXPERIMENT: Experiment = {
  id: 'hero_copy_v1',
  variants: ['control', 'emotional', 'data'],
  weights: [34, 33, 33], // 1/3 each
};

export const HERO_COPY = {
  control: {
    headline: 'Protect what you own.\nStay close to who you love.',
    subheadline:
      'In Nigeria, only 11.7% of stolen phones are ever recovered. Magneetar is built to change that number — real-time tracking, forensic-grade evidence, and a route that walks you straight to your device.',
  },
  emotional: {
    headline: "Your phone isn't just a phone.\nIt's your life.",
    subheadline:
      'Photos, contacts, banking, memories — everything you care about lives in your pocket. When it disappears, Magneetar brings it back. Real-time tracking, forensic evidence, and a path straight to your door.',
  },
  data: {
    headline: '87% of thefts happen in 4 seconds.\nWe respond in 3.',
    subheadline:
      '3-second GPS updates, 8-signal theft detection, SHA-256 evidence chain. Built for the reality of phone theft in Africa — where recovery rates are just 11.7% and every second counts.',
  },
} as const;
