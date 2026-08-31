/**
 * k6 Distributed Load Test for Magneetar API
 *
 * Runs load tests from multiple regions using Grafana Cloud k6.
 *
 * Usage:
 *   # Run locally
 *   k6 run tests/load/k6-distributed.js
 *
 *   # Run in k6 Cloud (distributed)
 *   k6 cloud tests/load/k6-distributed.js
 *
 *   # Run with custom distribution
 *   K6_CLOUD_DISTRIBUTION='{"lagos":{"loadZone":"asia-south1","weight":50},"london":{"loadZone":"europe-west2","weight":50}}' k6 cloud tests/load/k6-distributed.js
 *
 * Environment Variables:
 *   K6_CLOUD_TOKEN - Grafana Cloud k6 token
 *   K6_BASE_URL - Server base URL
 *   K6_DEVICE_TOKEN - Device JWT token
 *   K6_DASHBOARD_TOKEN - Dashboard JWT token
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomIntBetween, randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const errorRate = new Rate('errors');
const apiDuration = new Trend('api_duration', true);
const apiRequests = new Counter('api_requests');

// Configuration
const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:8000';
const DEVICE_TOKEN = __ENV.K6_DEVICE_TOKEN || '';
const DASHBOARD_TOKEN = __ENV.K6_DASHBOARD_TOKEN || '';

// Cloud distribution zones
const DISTRIBUTION = __ENV.K6_CLOUD_DISTRIBUTION
  ? JSON.parse(__ENV.K6_CLOUD_DISTRIBUTION)
  : {
      'lagos': { loadZone: 'asia-south1', weight: 50 },
      'london': { loadZone: 'europe-west2', weight: 30 },
      'virginia': { loadZone: 'us-east4', weight: 20 },
    };

// Test scenarios
export const options = {
  scenarios: {
    // Scenario 1: Device registration storm
    device_registration: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },   // Ramp up
        { duration: '5m', target: 100 },  // Peak load
        { duration: '2m', target: 0 },    // Ramp down
      ],
      exec: 'registerDevices',
      tags: { scenario: 'registration' },
    },

    // Scenario 2: Location updates (most critical)
    location_updates: {
      executor: 'constant-vus',
      vus: 200,
      duration: '10m',
      exec: 'updateLocation',
      tags: { scenario: 'location' },
    },

    // Scenario 3: Dashboard users
    dashboard_users: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '1m', target: 50 },   // Ramp up
        { duration: '8m', target: 50 },   // Steady state
        { duration: '1m', target: 0 },    // Ramp down
      ],
      exec: 'useDashboard',
      tags: { scenario: 'dashboard' },
    },
  },

  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate<0.1'],
    errors: ['rate<0.1'],
    api_duration: ['p(95)<1000'],

    // Scenario-specific thresholds
    'http_req_duration{scenario:location}': ['p(95)<500'],
    'http_req_duration{scenario:dashboard}': ['p(95)<1500'],
  },

  // Cloud-specific options
  cloud: {
    distribution: DISTRIBUTION,
    name: 'Magneetar Distributed Load Test',
    projectID: __ENV.K6_CLOUD_PROJECT_ID,
    token: __ENV.K6_CLOUD_TOKEN,
  },
};

function getHeaders(token) {
  return {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    },
  };
}

function generateLocation() {
  // Simulate locations across Nigeria
  const cities = [
    { lat: 6.5244, lng: 3.3792, name: 'Lagos' },
    { lat: 9.0579, lng: 7.4951, name: 'Abuja' },
    { lat: 6.3350, lng: 5.6270, name: 'Benin City' },
    { lat: 7.3775, lng: 3.9470, name: 'Ibadan' },
    { lat: 4.8156, lng: 7.0498, name: 'Port Harcourt' },
  ];

  const city = cities[randomIntBetween(0, cities.length - 1)];

  return {
    lat: city.lat + (Math.random() - 0.5) * 0.02,
    lng: city.lng + (Math.random() - 0.5) * 0.02,
    city: city.name,
  };
}

// Scenario 1: Device Registration
export function registerDevices() {
  if (!DEVICE_TOKEN) {
    console.warn('K6_DEVICE_TOKEN not set - skipping registration');
    return;
  }

  group('Device Registration', () => {
    const deviceId = `mt-dist-${randomString(8)}`;
    const location = generateLocation();

    const regRes = http.post(`${BASE_URL}/api/device/register`,
      JSON.stringify({
        device_id: deviceId,
        fingerprint: `dist-${randomString(16)}`,
        model: 'Distributed Test Device',
        os_version: 'Android 14',
        app_version: '1.0.0',
        sim_phone: `+234${randomIntBetween(7000000000, 7999999999)}`,
      }),
      getHeaders(DEVICE_TOKEN)
    );
    apiDuration.add(regRes.timings.duration);
    apiRequests.add(1);

    check(regRes, {
      'registration status is 200': (r) => r.status === 200,
      'registration has access_token': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.access_token !== undefined;
        } catch {
          return false;
        }
      },
    }) || errorRate.add(1);

    // Send initial location
    if (regRes.status === 200) {
      const body = JSON.parse(regRes.body);
      const token = body.access_token;

      const locRes = http.post(`${BASE_URL}/api/device/location`,
        JSON.stringify({
          device_id: deviceId,
          lat: location.lat,
          lng: location.lng,
          accuracy: randomIntBetween(5, 30),
          battery_percent: randomIntBetween(50, 100),
          ping_sequence: `ping-${Date.now()}`,
          device_timestamp: new Date().toISOString(),
        }),
        getHeaders(token)
      );

      check(locRes, {
        'initial location status is 200': (r) => r.status === 200,
      }) || errorRate.add(1);
    }
  });

  sleep(1);
}

// Scenario 2: Location Updates (most critical - devices ping every 3s)
export function updateLocation() {
  if (!DEVICE_TOKEN) {
    console.warn('K6_DEVICE_TOKEN not set - skipping location updates');
    return;
  }

  const deviceId = `mt-dist-${randomIntBetween(1, 1000)}`;
  const location = generateLocation();

  group('Location Update', () => {
    const res = http.post(`${BASE_URL}/api/device/location`,
      JSON.stringify({
        device_id: deviceId,
        lat: location.lat,
        lng: location.lng,
        accuracy: randomIntBetween(5, 50),
        speed: Math.random() * 20,
        bearing: randomIntBetween(0, 360),
        battery_percent: randomIntBetween(10, 100),
        is_charging: Math.random() > 0.8,
        network_type: ['wifi', '4g', '5g'][randomIntBetween(0, 2)],
        ping_sequence: `ping-${Date.now()}-${randomIntBetween(1000, 9999)}`,
        device_timestamp: new Date().toISOString(),
      }),
      getHeaders(DEVICE_TOKEN)
    );
    apiDuration.add(res.timings.duration);
    apiRequests.add(1);

    check(res, {
      'location status is 200': (r) => r.status === 200,
      'location has commands_pending': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.commands_pending !== undefined;
        } catch {
          return false;
        }
      },
      'location response time < 500ms': (r) => r.timings.duration < 500,
    }) || errorRate.add(1);

    // Occasionally poll for commands (10% of pings)
    if (Math.random() < 0.1) {
      const cmdRes = http.get(
        `${BASE_URL}/api/device/commands/${deviceId}`,
        getHeaders(DEVICE_TOKEN)
      );

      check(cmdRes, {
        'command poll status is 200': (r) => r.status === 200,
      }) || errorRate.add(1);
    }
  });

  sleep(3);  // Device pings every 3 seconds
}

// Scenario 3: Dashboard Users
export function useDashboard() {
  if (!DASHBOARD_TOKEN) {
    console.warn('K6_DASHBOARD_TOKEN not set - skipping dashboard');
    return;
  }

  group('Dashboard: List Devices', () => {
    const res = http.get(
      `${BASE_URL}/api/dashboard/devices`,
      getHeaders(DASHBOARD_TOKEN)
    );
    apiDuration.add(res.timings.duration);
    apiRequests.add(1);

    check(res, {
      'devices list status is 200': (r) => r.status === 200,
      'devices list has devices array': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.devices);
        } catch {
          return false;
        }
      },
    }) || errorRate.add(1);
  });

  sleep(2);

  // View device details (30% of users)
  if (Math.random() < 0.3) {
    group('Dashboard: View Device', () => {
      const deviceId = `mt-dist-${randomIntBetween(1, 100)}`;

      const res = http.get(
        `${BASE_URL}/api/dashboard/locations/${deviceId}`,
        getHeaders(DASHBOARD_TOKEN)
      );
      apiDuration.add(res.timings.duration);
      apiRequests.add(1);

      check(res, {
        'device history status is 200': (r) => r.status === 200,
      }) || errorRate.add(1);
    });
  }

  sleep(3);
}

// Setup function
export function setup() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Magneetar Distributed Load Test');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(`  Base URL: ${BASE_URL}`);
  console.log(`  Distribution Zones:`);

  for (const [zone, config] of Object.entries(DISTRIBUTION)) {
    console.log(`    - ${zone}: ${config.loadZone} (${config.weight}%)`);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  return { baseUrl: BASE_URL };
}

// Summary
export function handleSummary(data) {
  const metrics = data.metrics;
  const lines = [];

  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('  Magneetar Distributed Load Test Results');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('');

  if (metrics.http_req_duration) {
    const dur = metrics.http_req_duration.values;
    lines.push(`  HTTP Request Duration:`);
    lines.push(`    Min:    ${dur.min.toFixed(2)}ms`);
    lines.push(`    Max:    ${dur.max.toFixed(2)}ms`);
    lines.push(`    Avg:    ${dur.avg.toFixed(2)}ms`);
    lines.push(`    P95:    ${dur['p(95)'].toFixed(2)}ms`);
    lines.push(`    P99:    ${dur['p(99)'].toFixed(2)}ms`);
  }

  if (metrics.http_reqs) {
    lines.push('');
    lines.push(`  Total Requests: ${metrics.http_reqs.values.count}`);
    lines.push(`  Requests/sec:   ${(metrics.http_reqs.values.rate || 0).toFixed(2)}`);
  }

  if (metrics.http_req_failed) {
    lines.push('');
    lines.push(`  Failed Requests: ${(metrics.http_req_failed.values.rate * 100).toFixed(2)}%`);
  }

  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════');

  return {
    'stdout': lines.join('\n'),
    'tests/load/results/distributed-summary.json': JSON.stringify(data, null, 2),
  };
}
