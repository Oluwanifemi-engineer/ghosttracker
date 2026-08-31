/**
 * k6 Cloud Configuration
 *
 * Configuration for running distributed load tests with Grafana Cloud k6.
 *
 * Features:
 * - Run tests from multiple regions simultaneously
 * - Scale to 1M+ virtual users
 * - Real-time Grafana dashboards
 * - Automated performance reports
 *
 * Setup:
 *   1. Sign up at grafana.com/products/cloud/
 *   2. Get your cloud token from k6 Cloud settings
 *   3. Set K6_CLOUD_TOKEN environment variable
 *   4. Run: k6 cloud tests/load/k6-full-api.js
 */

export const cloudConfig = {
  // Cloud token (required)
  token: __ENV.K6_CLOUD_TOKEN || '',

  // Project name in k6 Cloud
  name: 'Magneetar API Load Tests',

  // Project ID (optional, auto-created if not set)
  projectID: __ENV.K6_CLOUD_PROJECT_ID || undefined,

  // Distribution configuration
  distribution: {
    // Load zones - where to run from
    loadZones: {
      // Main region (Nigeria)
      'lagos': { loadZone: 'asia-south1', weight: 40 },
      // Secondary regions
      'frankfurt': { loadZone: 'europe-west3', weight: 30 },
      'virginia': { loadZone: 'us-east4', weight: 30 },
    },

    // Distribution strategy
    strategy: 'random',  // 'random' | 'per-vu' | 'per-iteration'
  },

  // Tag options for filtering in cloud UI
  tagKey: 'environment',
  tagValue: 'production',

  // Fail test on threshold violations
  failOnThreshold: true,

  // Upload source maps for better error messages
  uploadSourceMaps: true,

  // Ignore specific files
  ignoreFiles: [
    'node_modules/**',
    'tests/load/results/**',
  ],
};
