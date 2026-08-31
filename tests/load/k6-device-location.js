/**
 * k6 Load Test: Device Location Endpoint
 *
 * Tests the /api/device/location endpoint under realistic load.
 * This is the most critical endpoint - devices ping every ~3 seconds.
 *
 * Usage:
 *   k6 run tests/load/k6-device-location.js
 *   k6 run --vus 50 --duration 60s tests/load/k6-device-location.js
 *
 * Environment Variables:
 *   K6_BASE_URL - Server base URL (default: http://localhost:8000)
 *   K6_DEVICE_TOKEN - Device JWT token for authentication
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const errorRate = new Rate('errors');
const locationDuration = new Trend('location_duration', true);
const locationRequests = new Counter('location_requests');
const commandPollDuration = new Trend('command_poll_duration', true);

// Configuration
const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:8000';
const DEVICE_TOKEN = __ENV.K6_DEVICE_TOKEN || '';

// Simulate device location patterns (Lagos, Nigeria area)
const LAGOS_BOUNDS = {
  latMin: 6.4,
  latMax: 6.6,
  lngMin: 3.2,
  lngMax: 3.5,
};

function generateLocation() {
  return {
    lat: LAGOS_BOUNDS.latMin + Math.random() * (LAGOS_BOUNDS.latMax - LAGOS_BOUNDS.latMin),
    lng: LAGOS_BOUNDS.lngMin + Math.random() * (LAGOS_BOUNDS.lngMax - LAGOS_BOUNDS.lngMin),
  };
}

export const options = {
  scenarios: {
    // Scenario 1: Steady device pings (like real devices)
    device_pings: {
      executor: 'constant-vus',
      vus: 20,
      duration: '60s',
      exec: 'devicePing',
    },

    // Scenario 2: Dashboard users viewing devices
    dashboard_users: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '10s', target: 10 },   // Ramp up
        { duration: '30s', target: 10 },   // Steady state
        { duration: '10s', target: 20 },   // Peak
        { duration: '10s', target: 5 },    // Ramp down
      ],
      exec: 'dashboardUser',
    },
  },

  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],  // 95% < 1s, 99% < 2s
    http_req_failed: ['rate<0.05'],  // <5% error rate
    errors: ['rate<0.05'],
    location_duration: ['p(95)<500'],  // Location pings 95% < 500ms
  },
};

// Device ping scenario
export function devicePing() {
  if (!DEVICE_TOKEN) {
    console.warn('K6_DEVICE_TOKEN not set - skipping device ping');
    return;
  }

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEVICE_TOKEN}`,
    },
    tags: { name: 'device_location' },
  };

  const location = generateLocation();
  const pingId = `ping-${Date.now()}-${randomIntBetween(1000, 9999)}`;

  group('Device Location Ping', () => {
    const payload = JSON.stringify({
      device_id: `mt-loadtest-${randomIntBetween(1, 100)}`,
      lat: location.lat,
      lng: location.lng,
      accuracy: randomIntBetween(5, 50),
      speed: Math.random() * 30,
      bearing: randomIntBetween(0, 360),
      battery_percent: randomIntBetween(10, 100),
      is_charging: Math.random() > 0.8,
      network_type: ['wifi', '4g', '5g'][randomIntBetween(0, 2)],
      ping_sequence: pingId,
      device_timestamp: new Date().toISOString(),
    });

    const res = http.post(`${BASE_URL}/api/device/location`, payload, params);
    locationDuration.add(res.timings.duration);
    locationRequests.add(1);

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

    // Poll for commands (realistic: devices poll every 30s)
    if (Math.random() < 0.1) {  // 10% chance per ping
      const devicePayload = JSON.parse(payload);
      const cmdRes = http.get(
        `${BASE_URL}/api/device/commands/${devicePayload.device_id}`,
        params
      );
      commandPollDuration.add(cmdRes.timings.duration);

      check(cmdRes, {
        'command poll status is 200': (r) => r.status === 200,
        'command poll has commands array': (r) => {
          try {
            const body = JSON.parse(r.body);
            return Array.isArray(body.commands);
          } catch {
            return false;
          }
        },
      }) || errorRate.add(1);
    }
  });

  sleep(3);  // Device pings every 3 seconds
}

// Dashboard user scenario
export function dashboardUser() {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEVICE_TOKEN}`,
    },
    tags: { name: 'dashboard' },
  };

  group('Dashboard: List Devices', () => {
    const res = http.get(`${BASE_URL}/api/dashboard/devices`, params);

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
      'devices list response time < 1s': (r) => r.timings.duration < 1000,
    }) || errorRate.add(1);
  });

  sleep(2);  // User views dashboard for 2 seconds

  // Occasionally view device details
  if (Math.random() < 0.3) {
    group('Dashboard: View Device History', () => {
      const res = http.get(
        `${BASE_URL}/api/dashboard/locations/mt-loadtest-1`,
        params
      );

      check(res, {
        'device history status is 200': (r) => r.status === 200,
        'device history has locations array': (r) => {
          try {
            const body = JSON.parse(r.body);
            return Array.isArray(body.locations);
          } catch {
            return false;
          }
        },
      }) || errorRate.add(1);
    });
  }

  sleep(5);  // User stays on dashboard for 5 seconds
}

export function handleSummary(data) {
  return {
    'stdout': formatSummary(data),
    'tests/load/results/device-location-summary.json': JSON.stringify(data, null, 2),
  };
}

function formatSummary(data) {
  const metrics = data.metrics;
  const lines = [];

  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('  k6 Load Test Results: Device Location Endpoint');
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

  if (metrics.location_duration) {
    const dur = metrics.location_duration.values;
    lines.push('');
    lines.push(`  Location Ping Duration:`);
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

  return lines.join('\n');
}
